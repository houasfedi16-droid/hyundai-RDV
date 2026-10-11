const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const db = require("../config/db");
const { protect } = require("../middleware/authMiddleware");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function getRequestEmail(req) {
  return (req.body.email || req.user.email || "").trim().toLowerCase();
}

function ensureOwnEmail(req, res) {
  const email = getRequestEmail(req);
  const tokenEmail = (req.user.email || "").trim().toLowerCase();

  if (!email) {
    res.status(400).json({
      success: false,
      message: "Email required",
    });
    return null;
  }

  if (email !== tokenEmail) {
    res.status(403).json({
      success: false,
      message: "You can only request an OTP for your own email",
    });
    return null;
  }

  return email;
}

router.post("/send", protect, async (req, res) => {
  const email = ensureOwnEmail(req, res);
  if (!email) return;

  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const sql = `
      INSERT INTO otp_codes (email, code, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
    `;

    db.query(sql, [email, code], async (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      try {
        await transporter.sendMail({
          from: `"Hyundai RDV" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Votre code OTP",
          html: `
            <h2>Code de verification</h2>
            <p>Votre code est :</p>
            <h1>${code}</h1>
            <p>Valide pendant 5 minutes</p>
          `,
        });

        return res.json({
          success: true,
          message: "OTP sent by email",
        });
      } catch (mailErr) {
        return res.status(500).json({
          success: false,
          message: mailErr.message || "Failed to send OTP email",
        });
      }
    });
  } catch (err) {
    console.error("Email OTP error:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

router.post("/verify", protect, (req, res) => {
  const email = ensureOwnEmail(req, res);
  if (!email) return;

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "OTP code required",
    });
  }

  const selectSql = `
    SELECT id FROM otp_codes
    WHERE email = ? AND code = ? AND expires_at > NOW()
    ORDER BY id DESC LIMIT 1
  `;

  db.query(selectSql, [email, String(code)], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    db.query("DELETE FROM otp_codes WHERE id = ?", [results[0].id], (deleteErr) => {
      if (deleteErr) {
        return res.status(500).json({
          success: false,
          message: deleteErr.message,
        });
      }

      res.json({
        success: true,
        message: "OTP verified",
      });
    });
  });
});

module.exports = router;
