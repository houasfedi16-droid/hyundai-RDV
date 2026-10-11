import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("client1");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await loginUser(username, password);

      if (res.success) {
        localStorage.clear();

        if (res.user.role === "admin") {
          localStorage.setItem("token", res.token);
          localStorage.setItem("refreshToken", res.refreshToken);
          localStorage.setItem("user", JSON.stringify(res.user));
          navigate("/admin-dashboard");
        } else {
          localStorage.setItem("tempToken", res.token);
          localStorage.setItem("tempRefreshToken", res.refreshToken);
          localStorage.setItem("tempUser", JSON.stringify(res.user));
          navigate("/otp-login");
        }
      } else {
        setError(res.message || "Connexion impossible");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur serveur. Reessayez.");
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
            Bienvenue sur votre
            <br />
            <span>espace service</span>
          </h1>
          <p>
            Gerez vos rendez-vous, suivez l'entretien de votre vehicule et
            restez connecte avec votre concessionnaire.
          </p>
        </div>

        <div className="auth-steps">
          <div className="auth-step">
            <b>1</b>
            <span>Creez votre compte ou connectez-vous</span>
          </div>
          <div className="auth-step">
            <b>2</b>
            <span>Verifiez votre identite par email OTP</span>
          </div>
          <div className="auth-step">
            <b>3</b>
            <span>Prenez votre rendez-vous en ligne</span>
          </div>
        </div>
      </section>

      <section className="auth-right">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="auth-tabs">
            <button className="auth-tab active" type="button">
              Connexion
            </button>
            <button
              className="auth-tab"
              type="button"
              onClick={() => navigate("/register")}
            >
              Inscription
            </button>
          </div>

          <h2 className="auth-title">Bon retour</h2>
          <p className="auth-subtitle">
            Connectez-vous pour acceder a votre espace.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label>Username ou email</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="client1"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
            />
          </div>

          <button className="btn-primary" disabled={loading}>
            {loading ? "VERIFICATION..." : "SE CONNECTER"}
          </button>

          <div className="auth-note">
            Un code OTP sera envoye par email pour confirmer l'identite des
            comptes clients a chaque connexion.
          </div>
        </form>
      </section>
    </div>
  );
}
