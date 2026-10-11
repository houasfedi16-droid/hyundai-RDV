const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect, isAdmin } = require("../middleware/authMiddleware");

const paymentSchemaSql = `
  CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    currency VARCHAR(8) NOT NULL DEFAULT 'TND',
    method ENUM('card', 'mobile', 'cash') NOT NULL DEFAULT 'cash',
    status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
    transaction_ref VARCHAR(80) NOT NULL UNIQUE,
    card_last4 VARCHAR(4) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payments_appointment_id (appointment_id),
    INDEX idx_payments_user_id (user_id)
  )
`;

db.query(paymentSchemaSql, (err) => {
  if (err) {
    console.error("Payment table init failed:", err.message);
  }
});

function createTransactionRef() {
  return `HYU-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getLast4(cardNumber = "") {
  const digits = String(cardNumber).replace(/\D/g, "");
  return digits ? digits.slice(-4) : null;
}

function amountFromPrice(price) {
  const match = String(price || "").match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : 50;
}

router.post("/", protect, (req, res) => {
  const userId = req.user.id;
  const {
    appointment_id,
    currency = "TND",
    method = "cash",
    cardNumber,
  } = req.body;

  if (!appointment_id) {
    return res.status(400).json({
      success: false,
      message: "Appointment required",
    });
  }

  if (!["card", "mobile", "cash"].includes(method)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment method",
    });
  }

  const appointmentSql = `
    SELECT a.id, a.service_type, s.price,
      existing.id AS existing_payment_id
    FROM appointments a
    LEFT JOIN services s ON s.name = a.service_type
    LEFT JOIN payments existing ON
      existing.appointment_id = a.id
      AND existing.status = 'paid'
    WHERE a.id = ? AND a.user_id = ?
    LIMIT 1
  `;

  db.query(appointmentSql, [appointment_id, userId], (appointmentErr, rows) => {
    if (appointmentErr) {
      return res.status(500).json({ success: false, message: appointmentErr.message });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (rows[0].existing_payment_id) {
      return res.status(409).json({
        success: false,
        message: "This appointment is already paid",
      });
    }

    const transactionRef = createTransactionRef();
    const normalizedAmount = amountFromPrice(rows[0].price);
    const status = method === "cash" ? "pending" : "paid";

    const sql = `
      INSERT INTO payments
      (appointment_id, user_id, amount, currency, method, status, transaction_ref, card_last4)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        appointment_id,
        userId,
        normalizedAmount,
        currency,
        method,
        status,
        transactionRef,
        method === "card" ? getLast4(cardNumber) : null,
      ],
      (paymentErr, result) => {
        if (paymentErr) {
          return res.status(500).json({ success: false, message: paymentErr.message });
        }

        res.status(201).json({
          success: true,
          message: status === "paid" ? "Payment accepted" : "Payment pending on site",
          payment: {
            id: result.insertId,
            appointment_id,
            amount: normalizedAmount,
            currency,
            method,
            status,
            transaction_ref: transactionRef,
          },
        });
      }
    );
  });
});

router.get("/my", protect, (req, res) => {
  const sql = `
    SELECT p.*, a.car_model, a.service_type, a.appointment_date, a.appointment_time
    FROM payments p
    JOIN appointments a ON a.id = p.appointment_id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, payments: results });
  });
});

router.get("/", protect, isAdmin, (req, res) => {
  const sql = `
    SELECT p.*, u.email, a.car_model, a.service_type, a.appointment_date, a.appointment_time
    FROM payments p
    JOIN users u ON u.id = p.user_id
    JOIN appointments a ON a.id = p.appointment_id
    ORDER BY p.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, payments: results });
  });
});

module.exports = router;
