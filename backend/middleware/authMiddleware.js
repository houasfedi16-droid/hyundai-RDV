const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const db = require("../config/db");

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "hyundai-rdv";
const KEYCLOAK_FRONTEND_CLIENT_ID =
  process.env.KEYCLOAK_FRONTEND_CLIENT_ID || "hyundai-frontend";

const client = jwksClient({
  jwksUri: `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function getTokenRole(decoded) {
  const realmRoles = decoded.realm_access?.roles || [];
  const clientRoles =
    decoded.resource_access?.[KEYCLOAK_FRONTEND_CLIENT_ID]?.roles || [];
  const allRoles = [...realmRoles, ...clientRoles];

  return allRoles.includes("admin") ? "admin" : "client";
}

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(
    token,
    getKey,
    {
      issuer: `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: "Invalid Keycloak token",
          error: err.message,
        });
      }

      if (decoded.email_verified === false) {
        return res.status(403).json({
          success: false,
          message: "Please verify your email before continuing",
        });
      }

      const email = decoded.email || decoded.preferred_username;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Keycloak token does not contain email",
        });
      }

      const role = getTokenRole(decoded);
      const selectSql = "SELECT id, email, role FROM users WHERE email = ?";

      db.query(selectSql, [email], (dbErr, results) => {
        if (dbErr) {
          return res.status(500).json({
            success: false,
            message: dbErr.message,
          });
        }

        if (results.length > 0) {
          if (results[0].role !== role) {
            db.query("UPDATE users SET role = ? WHERE id = ?", [role, results[0].id]);
          }

          req.user = {
            id: results[0].id,
            email: results[0].email,
            role,
          };

          return next();
        }

        const insertSql = `
          INSERT INTO users (email, password, role)
          VALUES (?, ?, ?)
        `;

        db.query(insertSql, [email, "KEYCLOAK_USER", role], (insertErr, result) => {
          if (insertErr) {
            return res.status(500).json({
              success: false,
              message: insertErr.message,
            });
          }

          req.user = {
            id: result.insertId,
            email,
            role,
          };

          next();
        });
      });
    }
  );
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only.",
    });
  }

  next();
};

module.exports = { protect, isAdmin };
