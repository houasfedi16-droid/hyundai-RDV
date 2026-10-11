import { useLocation, useNavigate } from "react-router-dom";

export default function Confirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const appointment = location.state?.appointment || {};
  const appointmentId = location.state?.appointmentId;
  const payment = location.state?.payment;

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
          <div className="pstep done"><span className="pstep-num">2</span> Rendez-vous</div>
          <span className="pstep-sep" />
          <div className="pstep active"><span className="pstep-num">3</span> Confirmation</div>
        </div>
      </header>

      <main className="rdv-body" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <section className="section-card">
          <h1 className="auth-title">Rendez-vous confirme</h1>
          <p className="auth-subtitle">
            Votre demande a ete enregistree. Un administrateur peut maintenant
            l'approuver ou la refuser depuis le dashboard back-office.
          </p>

          <div className="alert alert-success">
            Reference RDV: #{appointmentId || "nouveau"}
            {payment?.transaction_ref ? ` - Transaction: ${payment.transaction_ref}` : ""}
          </div>

          <div className="service-grid" style={{ marginTop: 20 }}>
            <button className="service-item active" type="button">
              <div className="service-icon">OK</div>
              <div>Creation RDV</div>
            </button>
            <button className="service-item active" type="button">
              <div className="service-icon">@</div>
              <div>Notification email OTP active</div>
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button className="btn-primary" onClick={() => navigate("/my-appointments")}>
              Voir mes RDV
            </button>
            <button className="btn-light" onClick={() => navigate("/client-dashboard")}>
              Dashboard
            </button>
          </div>
        </section>

        <section className="section-card">
          <h2 className="section-title">
            <span className="section-num">R</span> Recapitulatif du RDV
          </h2>
          <div className="recap-list">
            <div><strong>Service:</strong> {appointment.service_type || "-"}</div>
            <div><strong>Vehicule:</strong> {appointment.car_model || "-"}</div>
            <div><strong>Plaque:</strong> {appointment.plate_number || "-"}</div>
            <div><strong>Date:</strong> {appointment.appointment_date || "-"}</div>
            <div><strong>Heure:</strong> {appointment.appointment_time || "-"}</div>
            <div><strong>Statut:</strong> En attente</div>
          </div>

          <div className="panel" style={{ boxShadow: "none", marginTop: 20 }}>
            <h3 className="panel-title">Detail indicatif</h3>
            <div className="recap-list">
              <div><strong>Concession:</strong> Hyundai Tunis Centre</div>
              <div><strong>Conseiller:</strong> Mohamed Karim</div>
              <div>
                <strong>Paiement:</strong>{" "}
                {payment
                  ? `${payment.status} - ${payment.method} - ${Number(payment.amount).toFixed(3)} ${payment.currency}`
                  : "A regler sur place"}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
