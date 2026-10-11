import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const CLIENT_ID = "hyundai-frontend";

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function getRoles(decoded) {
  const realmRoles = decoded?.realm_access?.roles || [];
  const clientRoles = decoded?.resource_access?.[CLIENT_ID]?.roles || [];
  return [...realmRoles, ...clientRoles];
}

export default function ProtectedRoute({ children, role }) {
  const [now, setNow] = useState(null);
  const token = localStorage.getItem("token");
  const decoded = token ? decodeToken(token) : null;
  const refreshToken = localStorage.getItem("refreshToken");
  const roles = getRoles(decoded);
  const isAdmin = roles.includes("admin");
  const otpVerified = localStorage.getItem("otpVerified") === "true";

  useEffect(() => {
    setNow(Date.now());
  }, []);

  if (!token || !decoded) {
    return <Navigate to="/" replace />;
  }

  if (now && decoded.exp && decoded.exp * 1000 <= now) {
    if (refreshToken) {
      return children;
    }

    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  if (decoded.email_verified === false) {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  if (role === "admin" && !isAdmin) {
    return <Navigate to="/client-dashboard" replace />;
  }

  if (!isAdmin && !otpVerified) {
    return <Navigate to="/otp-login" replace />;
  }

  return children;
}
