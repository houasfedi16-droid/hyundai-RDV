import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cancelAppointment, getMyAppointments } from "../services/api";

function statusClass(status) {
  return `status status-${status || "pending"}`;
}

function formatDate(value) {
  return value ? value.split("T")[0] : "-";
}

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const navigate = useNavigate();

  const fetchAppointments = useCallback(async () => {
    const data = await getMyAppointments();
    setAppointments(data.appointments || []);
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancel = async (id) => {
    await cancelAppointment(id);
    fetchAppointments();
  };

  return (
    <main className="main" style={{ minHeight: "100vh" }}>
      <div className="page-header">
        <div>
          <h1>Mes rendez-vous</h1>
          <p>Consultez vos demandes et annulez les rendez-vous en attente.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-light" onClick={() => navigate("/client-dashboard")}>
            Dashboard
          </button>
          <button className="btn-primary" onClick={() => navigate("/book")}>
            Nouveau RDV
          </button>
        </div>
      </div>

      <section className="table-panel">
        <div
          className="table-head"
          style={{ gridTemplateColumns: "0.5fr 1.2fr 1fr 1fr 1fr 1fr 1fr" }}
        >
          <div>#</div>
          <div>Vehicule</div>
          <div>Service</div>
          <div>Date</div>
          <div>Statut</div>
          <div>Paiement</div>
          <div>Actions</div>
        </div>

        {appointments.length === 0 ? (
          <div className="empty-state">Aucun rendez-vous trouve</div>
        ) : (
          appointments.map((a) => (
            <div
              key={a.id}
              className="table-row"
              style={{ gridTemplateColumns: "0.5fr 1.2fr 1fr 1fr 1fr 1fr 1fr" }}
            >
              <div style={{ color: "var(--muted)" }}>#{a.id}</div>
              <div>
                <strong>{a.car_model}</strong>
                <div className="mini-label">{a.plate_number || "-"}</div>
              </div>
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
              <div>
                {a.status === "pending" ? (
                  <button className="btn-danger" onClick={() => handleCancel(a.id)}>
                    Annuler
                  </button>
                ) : (
                  <button className="btn-light" disabled>
                    Verrouille
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
