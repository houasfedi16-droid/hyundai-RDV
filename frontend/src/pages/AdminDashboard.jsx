import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approveAppointment,
  createService,
  createSlot,
  deleteService,
  deleteSlot,
  getAllAppointments,
  getAllPayments,
  getServices,
  getSlots,
  getUsers,
  rejectAppointment,
  updateService,
  updateSlot,
} from "../services/api";

function statusClass(status) {
  return `status status-${status || "pending"}`;
}

function formatDate(value) {
  return value ? value.split("T")[0] : "-";
}

function slotLabel(status) {
  if (status === "available") return "Disponible";
  if (status === "busy") return "Occupe";
  return "Ferme";
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [newService, setNewService] = useState({ name: "", price: "" });
  const [newSlot, setNewSlot] = useState({
    day: "Lundi",
    time: "08:00",
    status: "available",
  });

  const loadAppointments = useCallback(async () => {
    const data = await getAllAppointments();
    if (!data.success) {
      setError(data.message || "Impossible de charger les rendez-vous.");
      setAppointments([]);
      return;
    }

    setError("");
    setAppointments(data.appointments || []);
  }, []);

  const loadCatalog = useCallback(async () => {
    const [serviceData, slotData] = await Promise.all([
      getServices(true),
      getSlots(),
    ]);

    if (!serviceData.success) {
      setError(serviceData.message || "Impossible de charger les services.");
      setServices([]);
    } else {
      setServices(serviceData.services || []);
    }

    if (!slotData.success) {
      setError(slotData.message || "Impossible de charger les creneaux.");
      setSlots([]);
    } else {
      setSlots(slotData.slots || []);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    const [paymentData, userData] = await Promise.all([
      getAllPayments(),
      getUsers(),
    ]);

    if (!paymentData.success) {
      setError(paymentData.message || "Impossible de charger les paiements.");
      setPayments([]);
    } else {
      setPayments(paymentData.payments || []);
    }

    if (!userData.success) {
      setError(userData.message || "Impossible de charger les comptes.");
      setUsers([]);
    } else {
      setUsers(userData.users || []);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
    loadCatalog();
    loadAdminData();
  }, [loadAppointments, loadCatalog, loadAdminData]);

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleApprove = async (id) => {
    await approveAppointment(id);
    loadAppointments();
  };

  const handleReject = async (id) => {
    await rejectAppointment(id);
    loadAppointments();
  };

  const filteredAppointments = appointments.filter((a) => {
    const query = search.toLowerCase();
    const matchesSearch =
      (a.email || "").toLowerCase().includes(query) ||
      (a.plate_number || "").toLowerCase().includes(query) ||
      (a.car_model || "").toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const total = appointments.length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const approved = appointments.filter((a) => a.status === "approved").length;
  const rejected = appointments.filter((a) => a.status === "rejected").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;

  const addService = async (e) => {
    e.preventDefault();
    if (!newService.name.trim()) return;

    const data = await createService({
      name: newService.name.trim(),
      price: newService.price.trim() || "Sur devis",
    });

    if (!data.success) {
      setError(data.message || "Impossible d'ajouter le service.");
      return;
    }

    setNewService({ name: "", price: "" });
    setError("");
    loadCatalog();
  };

  const toggleService = async (service) => {
    const data = await updateService(service.id, { active: !service.active });

    if (!data.success) {
      setError(data.message || "Impossible de modifier le service.");
      return;
    }

    setError("");
    loadCatalog();
  };

  const removeService = async (id) => {
    const data = await deleteService(id);

    if (!data.success) {
      setError(data.message || "Impossible de supprimer le service.");
      return;
    }

    setError("");
    loadCatalog();
  };

  const addSlot = async (e) => {
    e.preventDefault();
    const data = await createSlot(newSlot);

    if (!data.success) {
      setError(data.message || "Impossible d'ajouter le creneau.");
      return;
    }

    setError("");
    loadCatalog();
  };

  const cycleSlotStatus = async (slot) => {
    const status =
      slot.status === "available"
        ? "busy"
        : slot.status === "busy"
          ? "closed"
          : "available";

    const data = await updateSlot(slot.id, { status });

    if (!data.success) {
      setError(data.message || "Impossible de modifier le creneau.");
      return;
    }

    setError("");
    loadCatalog();
  };

  const removeSlot = async (id) => {
    const data = await deleteSlot(id);

    if (!data.success) {
      setError(data.message || "Impossible de supprimer le creneau.");
      return;
    }

    setError("");
    loadCatalog();
  };

  const titleBySection = {
    overview: "Administration - Vue generale",
    services: "Gerer les services",
    accounts: "Gerer les comptes",
    slots: "Gerer les creneaux",
    payments: "Paiements",
    reports: "Rapports",
  };

  const subtitleBySection = {
    overview: "Validez, refusez et suivez les rendez-vous Hyundai.",
    services: "Ajoutez, activez ou desactivez les prestations proposees.",
    accounts: "Consultez les comptes synchronises avec le backend.",
    slots: "Organisez les horaires disponibles, occupes ou fermes.",
    payments: "Suivez les transactions et les paiements sur place.",
    reports: "Suivez les indicateurs de performance du service RDV.",
  };

  const navButton = (section, label, hint) => (
    <button
      className={`sidebar-item ${activeSection === section ? "active" : ""}`}
      onClick={() => setActiveSection(section)}
      title={hint}
    >
      {label}
    </button>
  );

  const renderStats = () => (
    <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
      <div className="stat-card">
        <div className="stat-icon">T</div>
        <div className="stat-value">{total}</div>
        <div className="stat-label">Rendez-vous total</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">P</div>
        <div className="stat-value">{pending}</div>
        <div className="stat-label">A valider</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">A</div>
        <div className="stat-value">{approved}</div>
        <div className="stat-label">Approuves</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">R</div>
        <div className="stat-value">{rejected}</div>
        <div className="stat-label">Rejetes</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">C</div>
        <div className="stat-value">{cancelled}</div>
        <div className="stat-label">Annules</div>
      </div>
    </div>
  );

  const renderOverview = () => (
    <>
      {renderStats()}

      <div className="filters">
        <input
          className="input"
          placeholder="Rechercher par email, plaque ou vehicule..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuve</option>
          <option value="rejected">Rejete</option>
          <option value="cancelled">Annule</option>
        </select>
      </div>

      <section className="table-panel">
        <div
          className="table-head"
          style={{ gridTemplateColumns: "1.2fr 1fr 0.8fr 1fr 0.8fr 0.9fr 0.9fr 1.3fr" }}
        >
          <div>Client</div>
          <div>Voiture</div>
          <div>Plaque</div>
          <div>Service</div>
          <div>Date</div>
          <div>Status</div>
          <div>Paiement</div>
          <div>Actions</div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="empty-state">Aucun rendez-vous trouve</div>
        ) : (
          filteredAppointments.map((a) => {
            const canReview = a.status === "pending";
            return (
              <div
                key={a.id}
                className="table-row"
                style={{
                  gridTemplateColumns:
                    "1.2fr 1fr 0.8fr 1fr 0.8fr 0.9fr 0.9fr 1.3fr",
                }}
              >
                <div>{a.email}</div>
                <div>{a.car_model}</div>
                <div>{a.plate_number || "-"}</div>
                <div>{a.service_type}</div>
                <div>
                  {formatDate(a.appointment_date)}
                  <div className="mini-label">{a.appointment_time}</div>
                </div>
                <div>
                  <span className={statusClass(a.status)}>{a.status}</span>
                </div>
                <div>
                  <span
                    className={`status ${
                      a.payment_status === "paid"
                        ? "status-approved"
                        : a.payment_status === "pending"
                          ? "status-pending"
                          : "status-cancelled"
                    }`}
                  >
                    {a.payment_status || "non paye"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-secondary"
                    disabled={!canReview}
                    onClick={() => handleApprove(a.id)}
                  >
                    Approuver
                  </button>
                  <button
                    className="btn-danger"
                    disabled={!canReview}
                    onClick={() => handleReject(a.id)}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );

  const renderServices = () => (
    <div className="rdv-body" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <section className="section-card">
        <h2 className="section-title">
          <span className="section-num">S</span> Services
        </h2>
        <p className="auth-subtitle">
          Ces services sont sauvegardes en base de donnees et affiches dans la
          prise de rendez-vous client.
        </p>
        {services.map((service) => (
          <div key={service.id} className="vehicle-card">
            <div className="service-icon">{service.name.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <strong>{service.name}</strong>
              <div className="mini-label">{service.price}</div>
            </div>
            <span className={`status ${service.active ? "status-approved" : "status-cancelled"}`}>
              {service.active ? "Actif" : "Inactif"}
            </span>
            <button
              className="btn-light"
              onClick={() => toggleService(service)}
            >
              {service.active ? "Desactiver" : "Activer"}
            </button>
            <button
              className="btn-danger"
              onClick={() => removeService(service.id)}
            >
              Supprimer
            </button>
          </div>
        ))}
      </section>

      <section className="section-card">
        <h2 className="section-title">
          <span className="section-num">+</span> Ajouter un service
        </h2>
        <form onSubmit={addService}>
          <div className="field">
            <label>Nom du service</label>
            <input
              value={newService.name}
              onChange={(e) =>
                setNewService((current) => ({
                  ...current,
                  name: e.target.value,
                }))
              }
              placeholder="Ex: Lavage premium"
            />
          </div>
          <div className="field">
            <label>Tarif</label>
            <input
              value={newService.price}
              onChange={(e) =>
                setNewService((current) => ({
                  ...current,
                  price: e.target.value,
                }))
              }
              placeholder="Ex: 40 TND"
            />
          </div>
          <button className="btn-primary" style={{ width: "100%" }}>
            Ajouter le service
          </button>
        </form>
      </section>
    </div>
  );

  const renderAccounts = () => (
    <section className="table-panel">
      <div
        className="table-head"
        style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr" }}
      >
        <div>Compte</div>
        <div>Role</div>
        <div>Total RDV</div>
        <div>En attente</div>
        <div>Approuves</div>
        <div>Statut</div>
      </div>
      {users.length === 0 ? (
        <div className="empty-state">Aucun compte trouve</div>
      ) : users.map((account) => (
        <div
          key={account.id}
          className="table-row"
          style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr" }}
        >
          <div>
            <strong>{account.email}</strong>
            <div className="mini-label">
              {account.role === "admin"
                ? "Acces complet au back-office"
                : "Compte client Keycloak"}
            </div>
          </div>
          <div>{account.role}</div>
          <div>{account.appointments_count || 0}</div>
          <div>{account.pending_count || 0}</div>
          <div>{account.approved_count || 0}</div>
          <div>
            <span className="status status-approved">Actif</span>
          </div>
        </div>
      ))}
    </section>
  );

  const renderPayments = () => (
    <section className="table-panel">
      <div
        className="table-head"
        style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.8fr 1fr" }}
      >
        <div>Client</div>
        <div>RDV</div>
        <div>Service</div>
        <div>Montant</div>
        <div>Statut</div>
        <div>Reference</div>
      </div>
      {payments.length === 0 ? (
        <div className="empty-state">Aucun paiement trouve</div>
      ) : payments.map((payment) => (
        <div
          key={payment.id}
          className="table-row"
          style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.8fr 1fr" }}
        >
          <div>{payment.email}</div>
          <div>
            #{payment.appointment_id}
            <div className="mini-label">
              {formatDate(payment.appointment_date)} {payment.appointment_time}
            </div>
          </div>
          <div>{payment.service_type}</div>
          <div>
            {Number(payment.amount).toFixed(3)} {payment.currency}
            <div className="mini-label">{payment.method}</div>
          </div>
          <div>
            <span
              className={`status ${
                payment.status === "paid"
                  ? "status-approved"
                  : payment.status === "pending"
                    ? "status-pending"
                    : "status-rejected"
              }`}
            >
              {payment.status}
            </span>
          </div>
          <div>{payment.transaction_ref}</div>
        </div>
      ))}
    </section>
  );

  const renderSlots = () => (
    <div className="rdv-body" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <section className="section-card">
        <h2 className="section-title">
          <span className="section-num">C</span> Creneaux
        </h2>
        <div className="slots" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {slots.map((slot) => (
            <div
              key={slot.id}
              role="button"
              tabIndex={0}
              className={`slot ${
                slot.status === "available" ? "active" : ""
              } ${slot.status === "busy" ? "busy" : ""}`}
              onClick={() => cycleSlotStatus(slot)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  cycleSlotStatus(slot);
                }
              }}
            >
              <strong>{slot.day}</strong>
              <div>{slot.time}</div>
              <div className="mini-label">{slotLabel(slot.status)}</div>
              <button
                className="btn-danger"
                type="button"
                style={{ marginTop: 8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSlot(slot.id);
                }}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <p className="auth-subtitle" style={{ marginTop: 14 }}>
          Cliquez sur un creneau pour passer de disponible a occupe puis ferme.
        </p>
      </section>

      <section className="section-card">
        <h2 className="section-title">
          <span className="section-num">+</span> Ajouter un creneau
        </h2>
        <form onSubmit={addSlot}>
          <div className="field">
            <label>Jour</label>
            <select
              value={newSlot.day}
              onChange={(e) =>
                setNewSlot((current) => ({ ...current, day: e.target.value }))
              }
            >
              {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map(
                (day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="field">
            <label>Heure</label>
            <input
              type="time"
              value={newSlot.time}
              onChange={(e) =>
                setNewSlot((current) => ({ ...current, time: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label>Statut</label>
            <select
              value={newSlot.status}
              onChange={(e) =>
                setNewSlot((current) => ({
                  ...current,
                  status: e.target.value,
                }))
              }
            >
              <option value="available">Disponible</option>
              <option value="busy">Occupe</option>
              <option value="closed">Ferme</option>
            </select>
          </div>
          <button className="btn-primary">Ajouter</button>
        </form>
      </section>
    </div>
  );

  const renderReports = () => {
    const mostRequested =
      Object.entries(
        appointments.reduce((acc, a) => {
          acc[a.service_type] = (acc[a.service_type] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return (
      <>
        {renderStats()}
        <div className="rdv-body" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <section className="section-card">
            <h2 className="section-title">
              <span className="section-num">R</span> Indicateurs
            </h2>
            <div className="recap-list">
              <div><strong>RDV total:</strong> {total}</div>
              <div><strong>Taux approbation:</strong> {total ? Math.round((approved / total) * 100) : 0}%</div>
              <div><strong>Taux refus:</strong> {total ? Math.round((rejected / total) * 100) : 0}%</div>
              <div><strong>Service le plus demande:</strong> {mostRequested}</div>
            </div>
          </section>
          <section className="section-card">
            <h2 className="section-title">
              <span className="section-num">PDF</span> Export
            </h2>
            <p className="auth-subtitle">
              Les rapports sont calcules depuis les rendez-vous existants. Un
              export PDF peut etre ajoute plus tard cote backend.
            </p>
            <button className="btn-light" onClick={() => window.print()}>
              Imprimer le rapport
            </button>
          </section>
        </div>
      </>
    );
  };

  const renderContent = () => {
    if (activeSection === "services") return renderServices();
    if (activeSection === "accounts") return renderAccounts();
    if (activeSection === "slots") return renderSlots();
    if (activeSection === "payments") return renderPayments();
    if (activeSection === "reports") return renderReports();
    return renderOverview();
  };

  return (
    <div className="shell">
      <aside className="sidebar admin">
        <div className="sidebar-brand">
          <div className="brand-mark">H</div>
          <div>
            <div className="sidebar-name">Hyundai RDV</div>
            <div style={{ color: "#a78bfa", fontSize: 11 }}>Back-Office</div>
          </div>
        </div>

        <div className="sidebar-section">Administration</div>
        {navButton("overview", "Vue generale", "Suivi des rendez-vous")}
        {navButton("services", "Services", "Catalogue des prestations")}
        {navButton("accounts", "Comptes", "Comptes clients et admin")}
        {navButton("slots", "Creneaux", "Disponibilites atelier")}
        {navButton("payments", "Paiements", "Transactions clients")}

        <div className="sidebar-section">Operations</div>
        {navButton("reports", "Rapports", "Indicateurs et impression")}
        <button className="sidebar-item" onClick={logout}>
          Deconnexion
        </button>

        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="sidebar-avatar">AD</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Admin</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}>
                Administrateur
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="top-row">
          <div>
            <h1>{titleBySection[activeSection]}</h1>
            <p>{subtitleBySection[activeSection]}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn-light"
              onClick={() => {
                loadAppointments();
                loadCatalog();
                loadAdminData();
              }}
            >
              Actualiser
            </button>
            <button className="btn-danger" onClick={logout}>
              Deconnexion
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {renderContent()}
      </main>
    </div>
  );
}
