const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/authMiddleware");

// CREATE appointment
router.post("/", protect, (req, res) => {
  const appointment_date = req.body.date || req.body.appointment_date;
  const appointment_time = req.body.time || req.body.appointment_time;
  const service_type = req.body.service || req.body.service_type;
  const car_model = req.body.car_model;
  const plate_number = req.body.plate_number || null;

  const sql = `
    INSERT INTO appointments 
    (user_id, appointment_date, appointment_time, service_type, car_model, plate_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      req.user.id,
      appointment_date,
      appointment_time,
      service_type,
      car_model,
      plate_number,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      res.json({
        success: true,
        message: "Appointment created successfully",
        appointmentId: result.insertId,
      });
    }
  );
});

// GET my appointments
router.get("/", protect, (req, res) => {
  const sql = `
    SELECT * FROM appointments 
    WHERE user_id = ? 
    ORDER BY appointment_date DESC
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    res.json({
      success: true,
      appointments: results,
    });
  });
});

module.exports = router;