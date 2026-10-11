const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const db = require("../config/db");
const { protect, isAdmin } = require("../middleware/authMiddleware");
const { dayNameFromDate } = require("./catalogRoutes");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Create appointment - user
router.post("/", protect, (req, res) => {
  const userId = req.user.id;
  const { car_model, service_type, appointment_date, appointment_time, plate_number } = req.body;

  if (!car_model || !service_type || !appointment_date || !appointment_time || !plate_number) {
    return res.status(400).json({ success: false, message: "All appointment fields are required" });
  }

  const day = dayNameFromDate(appointment_date);

  if (!day) {
    return res.status(400).json({ success: false, message: "Invalid appointment date" });
  }

  const availabilitySql = `
    SELECT s.id
    FROM slots s
    LEFT JOIN appointments a ON
      a.appointment_date = ?
      AND TIME_FORMAT(a.appointment_time, '%H:%i') = TIME_FORMAT(s.time, '%H:%i')
      AND a.status IN ('pending', 'approved')
    WHERE s.day = ?
      AND TIME_FORMAT(s.time, '%H:%i') = ?
      AND s.status = 'available'
      AND a.id IS NULL
    LIMIT 1
  `;

  db.query(availabilitySql, [appointment_date, day, appointment_time], (availabilityErr, slots) => {
    if (availabilityErr) {
      return res.status(500).json({ success: false, message: availabilityErr.message });
    }

    if (slots.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Ce creneau n'est plus disponible. Choisissez une autre heure.",
      });
    }

    const sql = `
      INSERT INTO appointments
      (user_id, car_model, service_type, appointment_date, appointment_time, plate_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [userId, car_model, service_type, appointment_date, appointment_time, plate_number],
      (err, result) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        res.json({
          success: true,
          message: "Appointment created successfully",
          appointmentId: result.insertId,
        });
      }
    );
  });
});

// Get my appointments - user
router.get("/my", protect, (req, res) => {
  const sql = `
    SELECT a.*,
      p.status AS payment_status,
      p.method AS payment_method,
      p.transaction_ref AS payment_ref,
      p.amount AS payment_amount,
      p.currency AS payment_currency
    FROM appointments a
    LEFT JOIN payments p ON p.id = (
      SELECT p2.id FROM payments p2
      WHERE p2.appointment_id = a.id
      ORDER BY p2.created_at DESC
      LIMIT 1
    )
    WHERE a.user_id = ?
    ORDER BY a.appointment_date DESC
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, appointments: results });
  });
});

// Cancel appointment
router.put("/:id/cancel", protect, (req, res) => {
  const sql = `
    UPDATE appointments
    SET status = 'cancelled'
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [req.params.id, req.user.id], (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, message: "Appointment cancelled successfully" });
  });
});

// Get all appointments - admin only
router.get("/", protect, isAdmin, (req, res) => {
  const sql = `
    SELECT a.*, u.email,
      p.status AS payment_status,
      p.method AS payment_method,
      p.transaction_ref AS payment_ref,
      p.amount AS payment_amount,
      p.currency AS payment_currency
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN payments p ON p.id = (
      SELECT p2.id FROM payments p2
      WHERE p2.appointment_id = a.id
      ORDER BY p2.created_at DESC
      LIMIT 1
    )
    ORDER BY a.appointment_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, appointments: results });
  });
});

function appointmentEmailTemplate(status, appointment) {
  const approved = status === "approved";
  const title = approved ? "Rendez-vous approuve" : "Rendez-vous refuse";
  const statusText = approved ? "approuve" : "refuse";
  const color = approved ? "#10b981" : "#ef4444";

  return {
    subject: `Hyundai RDV - ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #002c5f;">${title}</h2>
        <p>Bonjour,</p>
        <p>
          Votre rendez-vous Hyundai a ete
          <strong style="color: ${color};">${statusText}</strong>.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 18px 0;">
          <p><strong>Vehicule:</strong> ${appointment.car_model}</p>
          <p><strong>Plaque:</strong> ${appointment.plate_number || "-"}</p>
          <p><strong>Service:</strong> ${appointment.service_type}</p>
          <p><strong>Date:</strong> ${appointment.appointment_date}</p>
          <p><strong>Heure:</strong> ${String(appointment.appointment_time).slice(0, 5)}</p>
        </div>
        ${
          approved
            ? "<p>Merci de vous presenter a l'heure choisie. Vous pouvez suivre votre rendez-vous depuis votre espace client.</p>"
            : "<p>Vous pouvez reprendre un autre rendez-vous depuis votre espace client.</p>"
        }
        <p style="color: #6b7280; font-size: 12px;">Hyundai RDV</p>
      </div>
    `,
  };
}

async function sendAppointmentStatusEmail(status, appointment) {
  const email = appointment.email;

  if (!email) {
    throw new Error("Client email not found");
  }

  const template = appointmentEmailTemplate(status, appointment);

  await transporter.sendMail({
    from: `"Hyundai RDV" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: template.subject,
    html: template.html,
  });
}

function updateAppointmentStatus(req, res, status, notificationMessage, successMessage) {
  const appointmentId = req.params.id;
  const getSql = `
    SELECT a.user_id, a.car_model, a.plate_number, a.service_type,
      DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
      TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
      u.email
    FROM appointments a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ?
  `;

  db.query(getSql, [appointmentId], (getErr, rows) => {
    if (getErr) {
      return res.status(500).json({ success: false, message: getErr.message });
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const appointment = rows[0];
    const userId = appointment.user_id;
    const carModel = appointment.car_model;

    db.query(
      "UPDATE appointments SET status = ? WHERE id = ?",
      [status, appointmentId],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ success: false, message: updateErr.message });
        }

        const notifSql = `
          INSERT INTO notifications (user_id, message, is_read)
          VALUES (?, ?, 0)
        `;

        db.query(notifSql, [userId, notificationMessage(carModel)], async (notifErr) => {
          if (notifErr) {
            return res.status(500).json({ success: false, message: notifErr.message });
          }

          try {
            await sendAppointmentStatusEmail(status, appointment);
            res.json({ success: true, message: `${successMessage} and email sent` });
          } catch (mailErr) {
            res.json({
              success: true,
              message: successMessage,
              emailSent: false,
              emailWarning: mailErr.message || "Failed to send email",
            });
          }
        });
      }
    );
  });
}

// Approve appointment - admin only
router.put("/:id/approve", protect, isAdmin, (req, res) => {
  updateAppointmentStatus(
    req,
    res,
    "approved",
    (carModel) => `Votre rendez-vous pour ${carModel} a ete approuve.`,
    "Appointment approved and notification sent"
  );
});

// Reject appointment - admin only
router.put("/:id/reject", protect, isAdmin, (req, res) => {
  updateAppointmentStatus(
    req,
    res,
    "rejected",
    (carModel) => `Votre rendez-vous pour ${carModel} a ete refuse.`,
    "Appointment rejected and notification sent"
  );
});

module.exports = router;
