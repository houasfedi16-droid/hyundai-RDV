import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPayment } from "../services/api";

const servicePrices = {
  Entretien: 85,
  "Changement pneus": 60,
  Diagnostic: 50,
  Carrosserie: 120,
};

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const appointment = location.state?.appointment || {};
  const appointmentId = location.state?.appointmentId;
  const [method, setMethod] = useState("card");
  const [card, setCard] = useState({
    number: "",
    holder: "",
    expiry: "",
    cvv: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const amount = useMemo(
    () => servicePrices[appointment.service_type] || 50,
    [appointment.service_type]
  );

  const submitPayment = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!appointmentId) {
      setMessage("Rendez-vous introuvable.");
      return;
    }

    if (method === "card") {
      const digits = card.number.replace(/\D/g, "");
      if (digits.length < 12 || !card.holder.trim() || !card.expiry || !card.cvv) {
        setMessage("Veuillez completer les informations de carte.");
        return;
      }
    }

    setLoading(true);

    const data = await createPayment({
      appointment_id: appointmentId,
      amount,
      currency: "TND",
      method,
      cardNumber: card.number,
    });

    setLoading(false);

    if (!data.success) {
      setMessage(data.message || "Paiement impossible.");
      return;
    }

    navigate("/confirmation", {
      state: {
        appointment,
        appointmentId,
        payment: data.payment,
      },
    });
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
          <div className="pstep done"><span className="pstep-num">2</span> Rendez-vous</div>
          <span className="pstep-sep" />
          <div className="pstep active"><span className="pstep-num">3</span> Paiement</div>
          <span className="pstep-sep" />
          <div className="pstep"><span className="pstep-num">4</span> Confirmation</div>
        </div>
      </header>

      <main className="rdv-body" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <form className="section-card" onSubmit={submitPayment}>
          <h1 className="auth-title">Mode de paiement</h1>
          <p className="auth-subtitle">
            Choisissez un moyen de paiement. Carte et mobile sont simules et
            enregistres comme payes; paiement sur place reste en attente.
          </p>

          <div className="service-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              ["card", "Carte"],
              ["mobile", "Mobile"],
              ["cash", "Sur place"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`service-item ${method === value ? "active" : ""}`}
                onClick={() => setMethod(value)}
              >
                <div className="service-icon">{label.slice(0, 2).toUpperCase()}</div>
                <div>{label}</div>
              </button>
            ))}
          </div>

          {method === "card" && (
            <div style={{ marginTop: 22 }}>
              <div className="field">
                <label>Numero de carte</label>
                <input
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: e.target.value })}
                  placeholder="4532 0000 0000 7821"
                  inputMode="numeric"
                />
              </div>
              <div className="field">
                <label>Titulaire de la carte</label>
                <input
                  value={card.holder}
                  onChange={(e) => setCard({ ...card, holder: e.target.value })}
                  placeholder="Nom complet"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Expiration</label>
                  <input
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                    placeholder="09/27"
                  />
                </div>
                <div className="field">
                  <label>CVV</label>
                  <input
                    value={card.cvv}
                    onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                    placeholder="123"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
          )}

          {method === "mobile" && (
            <div className="alert alert-info" style={{ marginTop: 22 }}>
              Paiement mobile simule. En production, cette etape pourra etre
              branchee a Konnect, Paymee, Flouci ou un autre prestataire.
            </div>
          )}

          {method === "cash" && (
            <div className="alert alert-info" style={{ marginTop: 22 }}>
              Le rendez-vous sera enregistre avec paiement en attente sur place.
            </div>
          )}

          {message && <div className="alert alert-error">{message}</div>}

          <button className="btn-primary" disabled={loading}>
            {loading ? "TRAITEMENT..." : method === "cash" ? "CONFIRMER SUR PLACE" : "PAYER MAINTENANT"}
          </button>
        </form>

        <section className="section-card">
          <h2 className="section-title">
            <span className="section-num">R</span> Recapitulatif
          </h2>
          <div className="recap-list">
            <div><strong>RDV:</strong> #{appointmentId || "-"}</div>
            <div><strong>Service:</strong> {appointment.service_type || "-"}</div>
            <div><strong>Vehicule:</strong> {appointment.car_model || "-"}</div>
            <div><strong>Plaque:</strong> {appointment.plate_number || "-"}</div>
            <div><strong>Date:</strong> {appointment.appointment_date || "-"}</div>
            <div><strong>Heure:</strong> {appointment.appointment_time || "-"}</div>
          </div>

          <div className="panel" style={{ boxShadow: "none", marginTop: 20 }}>
            <h3 className="panel-title">Total</h3>
            <div className="stat-value">{amount.toFixed(3)} TND</div>
            <p className="auth-subtitle">Montant indicatif selon le service choisi.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
