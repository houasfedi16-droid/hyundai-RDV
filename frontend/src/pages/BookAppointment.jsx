import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createAppointment, getServices, getSlots } from "../services/api";

export default function BookAppointment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({
    car_model: location.state?.ocrText || "Hyundai Tucson",
    plate_number: location.state?.plateNumber || "",
    service_type: "",
    appointment_date: "",
    appointment_time: "",
  });

  const today = new Date().toISOString().split("T")[0];

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  useEffect(() => {
    let mounted = true;

    getServices()
      .then((data) => {
        if (!mounted) return;

        const loadedServices = data.success ? data.services || [] : [];
        setServices(loadedServices);

        if (loadedServices.length > 0) {
          setForm((current) => ({
            ...current,
            service_type: current.service_type || loadedServices[0].name,
          }));
        } else if (!data.success) {
          setMessage(data.message || "Impossible de charger les services.");
        }
      })
      .catch(() => setMessage("Impossible de charger les services."));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form.appointment_date) {
      setSlots([]);
      return;
    }

    let mounted = true;

    getSlots(form.appointment_date)
      .then((data) => {
        if (!mounted) return;

        const loadedSlots = data.success ? data.slots || [] : [];
        setSlots(loadedSlots);

        const firstAvailable = loadedSlots.find((slot) => slot.status === "available");

        setForm((current) => {
          const selectedSlot = loadedSlots.find((slot) => slot.time === current.appointment_time);

          if (selectedSlot?.status === "available") {
            return current;
          }

          return {
            ...current,
            appointment_time: firstAvailable?.time || "",
          };
        });

        if (!data.success) {
          setMessage(data.message || "Impossible de charger les creneaux.");
        }
      })
      .catch(() => setMessage("Impossible de charger les creneaux."));

    return () => {
      mounted = false;
    };
  }, [form.appointment_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!localStorage.getItem("token")) {
      localStorage.clear();
      setMessage("Session expiree. Reconnectez-vous puis validez l'OTP email.");
      setTimeout(() => navigate("/"), 900);
      return;
    }

    if (!form.car_model.trim()) return setMessage("Le modele est obligatoire.");
    if (!form.plate_number.trim()) return setMessage("La plaque est obligatoire.");
    if (!form.service_type.trim()) return setMessage("Le service est obligatoire.");
    if (!form.appointment_date) return setMessage("La date est obligatoire.");
    if (form.appointment_date < today) {
      return setMessage("Vous ne pouvez pas choisir une date passee.");
    }
    if (!form.appointment_time) return setMessage("L'heure est obligatoire.");

    setLoading(true);
    let res;

    try {
      res = await createAppointment(form);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage("Session expiree. Reconnectez-vous puis reessayez.");
      setTimeout(() => navigate("/"), 900);
      return;
    }

    setLoading(false);

    if (res.success) {
      setMessage("Rendez-vous cree avec succes.");
      setTimeout(
        () =>
          navigate("/payment", {
            state: { appointment: form, appointmentId: res.appointmentId },
          }),
        800
      );
    } else {
      setMessage(res.message || "Erreur lors de la creation.");
    }
  };

  return (
    <div>
      <header className="rdv-topbar">
        <div className="app-brand">
          <div className="brand-mark">H</div>
          <div>Hyundai RDV</div>
        </div>
        <div className="progress-steps">
          <div className="pstep done"><span className="pstep-num">1</span> Connexion</div>
          <span className="pstep-sep" />
          <div className="pstep active"><span className="pstep-num">2</span> Rendez-vous</div>
          <span className="pstep-sep" />
          <div className="pstep"><span className="pstep-num">3</span> Confirmation</div>
        </div>
        <button className="btn-light" onClick={() => navigate("/client-dashboard")}>
          Dashboard
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="rdv-body">
          <div>
            <section className="section-card" style={{ marginBottom: 20 }}>
              <h2 className="section-title">
                <span className="section-num">1</span> Type de service
              </h2>
              <div className="service-grid">
                {services.map((service, index) => (
                  <button
                    key={service.id}
                    type="button"
                    className={`service-item ${form.service_type === service.name ? "active" : ""}`}
                    onClick={() => update("service_type", service.name)}
                  >
                    <div className="service-icon">{index + 1}</div>
                    <div>{service.name}</div>
                  </button>
                ))}
              </div>
              <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
                <label>Service personnalise</label>
                <input
                  value={form.service_type}
                  onChange={(e) => update("service_type", e.target.value)}
                  placeholder="Ex: Vidange"
                />
              </div>
            </section>

            <section className="section-card">
              <h2 className="section-title">
                <span className="section-num">2</span> Mon vehicule
              </h2>
              <div className="vehicle-card active">
                <div className="service-icon">V</div>
                <div style={{ flex: 1 }}>
                  <label className="mini-label">Modele</label>
                  <input
                    className="input"
                    value={form.car_model}
                    onChange={(e) => update("car_model", e.target.value)}
                    placeholder="Hyundai Tucson 2022"
                  />
                  <label className="mini-label">Plaque</label>
                  <input
                    className="input"
                    value={form.plate_number}
                    onChange={(e) => update("plate_number", e.target.value)}
                    placeholder="TU 245 789"
                  />
                </div>
              </div>
              <button
                className="btn-secondary"
                type="button"
                style={{ width: "100%" }}
                onClick={() => navigate("/ocr")}
              >
                Scanner le vehicule
              </button>
            </section>
          </div>

          <section className="section-card">
            <h2 className="section-title">
              <span className="section-num">3</span> Choisir une date
            </h2>
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                min={today}
                value={form.appointment_date}
                onChange={(e) => update("appointment_date", e.target.value)}
              />
            </div>

            <div className="mini-label" style={{ marginBottom: 8 }}>
              Creneaux disponibles
            </div>
            <div className="slots">
              {!form.appointment_date && (
                <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                  Choisissez une date pour afficher les creneaux.
                </div>
              )}
              {form.appointment_date && slots.length === 0 && (
                <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                  Aucun creneau disponible pour cette date.
                </div>
              )}
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  disabled={slot.status !== "available"}
                  className={`slot ${slot.status !== "available" ? "busy" : ""} ${
                    form.appointment_time === slot.time ? "active" : ""
                  }`}
                  onClick={() => update("appointment_time", slot.time)}
                >
                  {slot.time}
                  <div className="mini-label">
                    {slot.status === "available" ? "Disponible" : "Indisponible"}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="section-card">
            <h2 className="section-title">
              <span className="section-num">4</span> Conseiller
            </h2>
            <div className="advisor-card active">
              <div className="sidebar-avatar">MK</div>
              <div>
                <strong>Mohamed Karim</strong>
                <div className="mini-label">Technicien senior</div>
              </div>
            </div>
            <div className="advisor-card">
              <div className="sidebar-avatar">SA</div>
              <div>
                <strong>Sarra Amri</strong>
                <div className="mini-label">Conseillere service</div>
              </div>
            </div>

            <div className="panel" style={{ boxShadow: "none", marginTop: 18 }}>
              <h3 className="panel-title">Recapitulatif</h3>
              <div className="recap-list">
                <div><strong>Service:</strong> {form.service_type || "-"}</div>
                <div><strong>Vehicule:</strong> {form.car_model || "-"}</div>
                <div><strong>Plaque:</strong> {form.plate_number || "-"}</div>
                <div><strong>Date:</strong> {form.appointment_date || "-"}</div>
                <div><strong>Heure:</strong> {form.appointment_time || "-"}</div>
              </div>
            </div>

            {message && (
              <div
                className={`alert ${
                  message.includes("succes") ? "alert-success" : "alert-error"
                }`}
              >
                {message}
              </div>
            )}
          </section>
        </div>

        <footer className="rdv-footer">
          <div className="mini-label">
            Rendez-vous: <strong>{form.appointment_date || "date a choisir"}</strong> a{" "}
            <strong>{form.appointment_time}</strong> - {form.service_type}
          </div>
          <button className="btn-primary" disabled={loading}>
            {loading ? "CREATION..." : "CONFIRMER RDV"}
          </button>
        </footer>
      </form>
    </div>
  );
}
