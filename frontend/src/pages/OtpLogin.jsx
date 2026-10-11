import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendOtp, verifyOtp } from "../services/api";

export default function OtpLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = useCallback(async (userEmail, token) => {
    if (!userEmail || !token) {
      setMessage("Email introuvable.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const data = await sendOtp(userEmail, token);
      setMessage(
        data.success ? "Code OTP envoye a votre email." : data.message
      );
    } catch (err) {
      console.error(err);
      setMessage("Erreur serveur lors de l'envoi du code.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tempUser = localStorage.getItem("tempUser");
    const tempToken = localStorage.getItem("tempToken");

    if (!tempUser || !tempToken) {
      navigate("/", { replace: true });
      return;
    }

    const user = JSON.parse(tempUser);
    const userEmail = user.email || user.username || "";
    setEmail(userEmail);
    sendCode(userEmail, tempToken);
  }, [navigate, sendCode]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (code.trim().length !== 6) {
      setMessage("Entrez le code OTP a 6 chiffres.");
      return;
    }

    const tempToken = localStorage.getItem("tempToken");
    const tempUser = localStorage.getItem("tempUser");
    const tempRefreshToken = localStorage.getItem("tempRefreshToken");

    if (!tempToken || !tempUser || !tempRefreshToken) {
      navigate("/", { replace: true });
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const data = await verifyOtp(email, code, tempToken);

      if (data.success) {
        const user = JSON.parse(tempUser);
        localStorage.setItem("token", tempToken);
        localStorage.setItem("refreshToken", tempRefreshToken);
        localStorage.setItem("user", tempUser);
        localStorage.setItem("otpVerified", "true");
        localStorage.removeItem("tempToken");
        localStorage.removeItem("tempRefreshToken");
        localStorage.removeItem("tempUser");
        navigate(user.role === "admin" ? "/admin-dashboard" : "/client-dashboard");
      } else {
        setMessage(data.message || "Code invalide.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Erreur serveur lors de la verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="otp-page">
      <form className="otp-card" onSubmit={handleVerifyOtp}>
        <div className="otp-icon">@</div>
        <h1 className="auth-title">Verification email</h1>
        <p className="auth-subtitle">
          Un code a 6 chiffres a ete envoye a
          <br />
          <strong>{email}</strong>
        </p>

        {message && (
          <div
            className={`alert ${
              message.toLowerCase().includes("envoye")
                ? "alert-info"
                : "alert-error"
            }`}
          >
            {message}
          </div>
        )}

        <div className="field">
          <label>Code OTP</label>
          <input
            className="otp-input"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="------"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>

        <button className="btn-primary" disabled={loading}>
          {loading ? "VERIFICATION..." : "VERIFIER LE CODE"}
        </button>

        <button
          className="btn-light"
          type="button"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => sendCode(email, localStorage.getItem("tempToken"))}
          disabled={loading}
        >
          Renvoyer le code
        </button>

        <button
          className="auth-tab"
          type="button"
          style={{ marginTop: 18 }}
          onClick={() => {
            localStorage.clear();
            navigate("/");
          }}
        >
          Retour connexion
        </button>
      </form>
    </main>
  );
}
