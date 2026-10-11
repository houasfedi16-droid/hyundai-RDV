const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const KEYCLOAK_CLIENT_ID =
  import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "hyundai-frontend";
const KEYCLOAK_URL =
  import.meta.env.VITE_KEYCLOAK_TOKEN_URL ||
  "http://localhost:8080/realms/hyundai-rdv/protocol/openid-connect/token";

const decodeToken = (token) => {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload));
};

const getRoles = (decoded) => {
  const realmRoles = decoded.realm_access?.roles || [];
  const clientRoles =
    decoded.resource_access?.[KEYCLOAK_CLIENT_ID]?.roles || [];

  return [...realmRoles, ...clientRoles];
};

const clearSession = () => {
  localStorage.clear();
  window.location.href = "/";
};

const isTokenExpired = (token) => {
  try {
    const decoded = decodeToken(token);
    return decoded.exp && decoded.exp * 1000 <= Date.now() + 30000;
  } catch {
    return true;
  }
};

const refreshAuthToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) {
    clearSession();
    throw new Error("Session expired. Please login again.");
  }

  const body = new URLSearchParams();
  body.append("client_id", KEYCLOAK_CLIENT_ID);
  body.append("grant_type", "refresh_token");
  body.append("refresh_token", refreshToken);

  const res = await fetch(KEYCLOAK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    clearSession();
    throw new Error(data.error_description || "Session expired. Please login again.");
  }

  const decoded = decodeToken(data.access_token);
  const roles = getRoles(decoded);
  const user = {
    username: decoded.preferred_username,
    email: decoded.email || decoded.preferred_username,
    role: roles.includes("admin") ? "admin" : "client",
  };

  localStorage.setItem("token", data.access_token);
  localStorage.setItem("refreshToken", data.refresh_token || refreshToken);
  localStorage.setItem("user", JSON.stringify(user));

  return data.access_token;
};

const getAuthToken = async (token = localStorage.getItem("token")) => {
  if (!token || token === "null" || token === "undefined") {
    clearSession();
    throw new Error("Session expired. Please login again.");
  }

  if (token === localStorage.getItem("token") && isTokenExpired(token)) {
    return refreshAuthToken();
  }

  return token;
};

const authHeaders = async (token = localStorage.getItem("token")) => {
  const authToken = await getAuthToken(token);

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };
};

const handleAuthJson = async (res) => {
  const data = await res.json();
  const message = (data.message || data.error || "").toLowerCase();

  if (
    (res.status === 401 || res.status === 403) &&
    (message.includes("invalid keycloak token") ||
      message.includes("no token provided") ||
      message.includes("email before continuing"))
  ) {
    clearSession();
  }

  return data;
};

export const loginUser = async (username, password) => {
  try {
    const body = new URLSearchParams();
    body.append("client_id", KEYCLOAK_CLIENT_ID);
    body.append("grant_type", "password");
    body.append("username", username);
    body.append("password", password);

    const res = await fetch(KEYCLOAK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        message: data.error_description || "Keycloak login failed",
      };
    }

    const decoded = decodeToken(data.access_token);
    const roles = getRoles(decoded);

    if (decoded.email_verified === false) {
      return {
        success: false,
        message: "Please verify your email before logging in.",
      };
    }

    const user = {
      username: decoded.preferred_username,
      email: decoded.email || decoded.preferred_username,
      role: roles.includes("admin") ? "admin" : "client",
    };

    return {
      success: true,
      token: data.access_token,
      refreshToken: data.refresh_token,
      user,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

export const registerUser = async (data) => {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    return handleAuthJson(res);
  } catch (error) {
    return { success: false, message: error.message || "Registration failed" };
  }
};

export const sendOtp = async (email, token) => {
  const res = await fetch(`${API_URL}/otp/send`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ email }),
  });

  return handleAuthJson(res);
};

export const verifyOtp = async (email, code, token) => {
  const res = await fetch(`${API_URL}/otp/verify`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ email, code }),
  });

  return handleAuthJson(res);
};

export const getNotifications = async () => {
  const res = await fetch(`${API_URL}/notifications`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const createAppointment = async (data) => {
  const res = await fetch(`${API_URL}/appointments`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  return handleAuthJson(res);
};

export const getMyAppointments = async () => {
  const res = await fetch(`${API_URL}/appointments/my`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const cancelAppointment = async (id) => {
  const res = await fetch(`${API_URL}/appointments/${id}/cancel`, {
    method: "PUT",
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const getAllAppointments = async () => {
  const res = await fetch(`${API_URL}/appointments`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const approveAppointment = async (id) => {
  const res = await fetch(`${API_URL}/appointments/${id}/approve`, {
    method: "PUT",
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const rejectAppointment = async (id) => {
  const res = await fetch(`${API_URL}/appointments/${id}/reject`, {
    method: "PUT",
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const markNotificationAsRead = async (id) => {
  const res = await fetch(`${API_URL}/notifications/${id}/read`, {
    method: "PUT",
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const createPayment = async (data) => {
  const res = await fetch(`${API_URL}/payments`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  return handleAuthJson(res);
};

export const getMyPayments = async () => {
  const res = await fetch(`${API_URL}/payments/my`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const getAllPayments = async () => {
  const res = await fetch(`${API_URL}/payments`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const getUsers = async () => {
  const res = await fetch(`${API_URL}/users`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const getServices = async (includeInactive = false) => {
  const query = includeInactive ? "?all=true" : "";
  const res = await fetch(`${API_URL}/services${query}`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const createService = async (data) => {
  const res = await fetch(`${API_URL}/services`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  return handleAuthJson(res);
};

export const updateService = async (id, data) => {
  const res = await fetch(`${API_URL}/services/${id}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  return handleAuthJson(res);
};

export const deleteService = async (id) => {
  const res = await fetch(`${API_URL}/services/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const getSlots = async (date) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${API_URL}/slots${query}`, {
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};

export const createSlot = async (data) => {
  const res = await fetch(`${API_URL}/slots`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  return handleAuthJson(res);
};

export const updateSlot = async (id, data) => {
  const res = await fetch(`${API_URL}/slots/${id}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  return handleAuthJson(res);
};

export const deleteSlot = async (id) => {
  const res = await fetch(`${API_URL}/slots/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  return handleAuthJson(res);
};
