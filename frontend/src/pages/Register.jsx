import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.username || !form.email || !form.password) {
      setError("Veuillez remplir les champs obligatoires.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const data = await registerUser({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        password: form.password,
      });

      if (data.success) {
        setMessage(
          data.message ||
            "Compte cree avec succes. Vous pouvez maintenant vous connecter."
        );
        setTimeout(() => navigate("/"), 1800);
      } else {
        setError(data.message || "Erreur lors de la creation du compte.");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-left">
        <div className="auth-brand">
          <div className="brand-mark">H</div>
          <div>
            Hyundai <span>RDV</span>
          </div>
        </div>

        <div className="auth-hero">
          <h1>
            Creez votre
            <br />
            <span>compte client</span>
          </h1>
          <p>
            Reservez vos creneaux, suivez vos demandes et recevez vos codes de
            verification par email.
          </p>
        </div>

        <div className="auth-steps">
          <div className="auth-step">
            <b>1</b>
            <span>Renseignez vos informations</span>
          </div>
          <div className="auth-step">
            <b>2</b>
            <span>Connectez-vous avec votre mot de passe</span>
          </div>
          <div className="auth-step">
            <b>3</b>
            <span>Validez votre session par email OTP</span>
          </div>
        </div>
      </section>

      <section className="auth-right">
        <form className="auth-card" onSubmit={handleRegister}>
          <div className="auth-tabs">
            <button
              className="auth-tab"
              type="button"
              onClick={() => navigate("/")}
            >
              Connexion
            </button>
            <button className="auth-tab active" type="button">
              Inscription
            </button>
          </div>

          <h2 className="auth-title">Inscription client</h2>
          <p className="auth-subtitle">
            Votre compte sera cree dans Keycloak automatiquement.
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <div className="field">
            <label>Nom complet</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Mohamed Ali"
            />
          </div>

          <div className="field">
            <label>Username</label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="client3"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="exemple@gmail.com"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Mot de passe</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>

          <div className="field">
            <label>Confirmer le mot de passe</label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>

          <button className="btn-primary" disabled={loading}>
            {loading ? "CREATION..." : "CREER LE COMPTE"}
          </button>
        </form>
      </section>
    </div>
  );
}
