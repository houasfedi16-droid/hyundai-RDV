import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyAppointments,
  getNotifications,
  markNotificationAsRead,
} from "../services/api";

function statusClass(status) {
  return `status status-${status || "pending"}`;
}

function formatDate(value) {
  return value ? value.split("T")[0] : "-";
}

export default function DashboardClient() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const displayName = user.email || user.username || "Client";
  const initials = displayName.slice(0, 2).toUpperCase();

  const fetchAppointments = useCallback(async () => {
    const data = await getMyAppointments();
    setAppointments(data.appointments || []);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const data = await getNotifications();
    setNotifications(data.notifications || []);
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchNotifications();
  }, [fetchAppointments, fetchNotifications]);

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleReadNotification = async (id) => {
    await markNotificationAsRead(id);
    fetchNotifications();
  };

  const upcoming = appointments.filter((a) => a.status !== "cancelled").length;
  const done = appointments.filter((a) => a.status === "approved").length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">H</div>
          <div className="sidebar-name">
            Hyundai <span>RDV</span>
          </div>
        </div>

        <div className="sidebar-section">Navigation</div>
        <button className="sidebar-item active">Tableau de bord</button>
        <button className="sidebar-item" onClick={() => navigate("/my-appointments")}>
          Mes RDV
        </button>
        <button className="sidebar-item" onClick={() => navigate("/book")}>
          Prendre un RDV
        </button>
        <button className="sidebar-item" onClick={() => navigate("/ocr")}>
          Scanner vehicule
        </button>

        <div className="sidebar-section">Compte</div>
        <button className="sidebar-item" onClick={logout}>
          Deconnexion
        </button>

        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="sidebar-avatar">{initials}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{displayName}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}>
                Client
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="page-header">
          <div>
            <h1>Bonjour</h1>
            <p>Voici un apercu de vos rendez-vous et notifications.</p>
          </div>
          <button className="btn-primary" onClick={() => navigate("/book")}>
            Nouveau RDV
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">RDV</div>
            <div className="stat-value">{upcoming}</div>
            <div className="stat-label">RDV actifs</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">OK</div>
            <div className="stat-value">{done}</div>
            <div className="stat-label">Approuves</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">AT</div>
            <div className="stat-value">{pending}</div>
            <div className="stat-label">En attente</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">MSG</div>
            <div className="stat-value">{unread}</div>
            <div className="stat-label">Notifications non lues</div>
          </div>
        </div>

        <section className="panel">
          <h2 className="panel-title">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="mini-label">Aucune notification.</p>
          ) : (
            notifications.slice(0, 3).map((n) => (
              <button
                key={n.id}
                className="btn-light"
                style={{
                  width: "100%",
                  textAlign: "left",
                  marginBottom: 8,
                  fontWeight: n.is_read ? 500 : 700,
                }}
                onClick={() => handleReadNotification(n.id)}
              >
                {n.message}
              </button>
            ))
          )}
        </section>

        <div className="page-header" style={{ marginTop: 4 }}>
          <h2>Mes rendez-vous</h2>
          <button className="btn-secondary" onClick={() => navigate("/my-appointments")}>
            Voir tous
          </button>
        </div>

        <section className="table-panel">
          <div
            className="table-head"
            style={{ gridTemplateColumns: "0.5fr 1.2fr 1fr 1fr 1fr 0.8fr" }}
          >
            <div>#</div>
            <div>Service</div>
            <div>Vehicule</div>
            <div>Date & heure</div>
            <div>Statut</div>
            <div>Action</div>
          </div>

          {appointments.length === 0 ? (
            <div className="empty-state">Aucun rendez-vous trouve</div>
          ) : (
            appointments.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="table-row"
                style={{ gridTemplateColumns: "0.5fr 1.2fr 1fr 1fr 1fr 0.8fr" }}
              >
                <div style={{ color: "var(--muted)" }}>#{a.id}</div>
                <div>{a.service_type}</div>
                <div>
                  <strong>{a.car_model}</strong>
                  <div className="mini-label">{a.plate_number || "-"}</div>
                </div>
                <div>
                  {formatDate(a.appointment_date)}
                  <div className="mini-label">{a.appointment_time}</div>
                </div>
                <div>
                  <span className={statusClass(a.status)}>{a.status}</span>
                </div>
                <button
                  className="btn-light"
                  onClick={() => navigate("/my-appointments")}
                >
                  Details
                </button>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
