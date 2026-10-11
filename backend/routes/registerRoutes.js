const express = require("express");
const router = express.Router();
const db = require("../config/db");

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || "http://localhost:8080";
const REALM = process.env.KEYCLOAK_REALM || "hyundai-rdv";
const FRONTEND_CLIENT_ID =
  process.env.KEYCLOAK_FRONTEND_CLIENT_ID || "hyundai-frontend";
const ADMIN_REALM = process.env.KEYCLOAK_ADMIN_REALM || "master";
const ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID || "admin-cli";
const ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function getAdminToken() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error("Missing Keycloak admin credentials in backend .env");
  }

  const body = new URLSearchParams();
  body.append("client_id", ADMIN_CLIENT_ID);
  body.append("username", ADMIN_USERNAME);
  body.append("password", ADMIN_PASSWORD);
  body.append("grant_type", "password");

  const res = await fetch(
    `${KEYCLOAK_BASE_URL}/realms/${ADMIN_REALM}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || "Failed to get admin token");
  }

  return data.access_token;
}

async function keycloakJson(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.errorMessage || data?.error || text || "Keycloak request failed");
  }

  return data;
}

async function getCreatedUser(adminToken, username) {
  const users = await keycloakJson(
    `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users?username=${encodeURIComponent(
      username
    )}&exact=true`,
    adminToken,
    { method: "GET" }
  );

  return users[0];
}

async function getClientByClientId(adminToken, clientId) {
  const clients = await keycloakJson(
    `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/clients?clientId=${encodeURIComponent(
      clientId
    )}`,
    adminToken,
    { method: "GET" }
  );

  return clients[0];
}

async function assignClientRole(adminToken, userId, clientUuid, roleName) {
  const role = await keycloakJson(
    `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/clients/${clientUuid}/roles/${encodeURIComponent(
      roleName
    )}`,
    adminToken,
    { method: "GET" }
  );

  await keycloakJson(
    `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/clients/${clientUuid}`,
    adminToken,
    {
      method: "POST",
      body: JSON.stringify([role]),
    }
  );
}

function upsertLocalUser(email, role = "client") {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO users (email, password, role)
      VALUES (?, 'KEYCLOAK_USER', ?)
      ON DUPLICATE KEY UPDATE role = VALUES(role), updated_at = CURRENT_TIMESTAMP
    `;

    db.query(sql, [email, role], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email and password are required",
      });
    }

    const adminToken = await getAdminToken();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const names = (fullName || normalizedUsername).trim().split(/\s+/);
    const firstName = names[0] || normalizedUsername;
    const lastName = names.slice(1).join(" ") || normalizedUsername;

    const createUserRes = await fetch(
      `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          email: normalizedEmail,
          firstName,
          lastName,
          enabled: true,
          emailVerified: true,
          requiredActions: [],
        }),
      }
    );

    if (!createUserRes.ok) {
      const errorText = await createUserRes.text();
      return res.status(createUserRes.status).json({
        success: false,
        message: errorText || "Failed to create Keycloak user",
      });
    }

    const user = await getCreatedUser(adminToken, normalizedUsername);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User created but not found",
      });
    }

    const passwordRes = await fetch(
      `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${user.id}/reset-password`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "password",
          value: password,
          temporary: false,
        }),
      }
    );

    if (!passwordRes.ok) {
      return res.status(500).json({
        success: false,
        message: "User created but password failed",
      });
    }

    const frontendClient = await getClientByClientId(adminToken, FRONTEND_CLIENT_ID);

    if (!frontendClient) {
      throw new Error(`Keycloak client not found: ${FRONTEND_CLIENT_ID}`);
    }

    await assignClientRole(adminToken, user.id, frontendClient.id, "client");
    await upsertLocalUser(normalizedEmail, "client");

    return res.status(201).json({
      success: true,
      message: "Account created. You can now log in and verify with OTP.",
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during registration",
    });
  }
});

module.exports = router;
