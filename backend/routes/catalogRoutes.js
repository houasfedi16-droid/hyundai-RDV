const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect, isAdmin } = require("../middleware/authMiddleware");

const servicesTableSql = `
  CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    price VARCHAR(80) NOT NULL DEFAULT 'Sur devis',
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`;

const slotsTableSql = `
  CREATE TABLE IF NOT EXISTS slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day VARCHAR(20) NOT NULL,
    time TIME NOT NULL,
    status ENUM('available', 'busy', 'closed') NOT NULL DEFAULT 'available',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_slot_day_time (day, time)
  )
`;

const defaultServices = [
  ["Entretien general", "85 - 150 TND", 1],
  ["Changement pneus", "60 - 120 TND", 1],
  ["Diagnostic electronique", "50 TND", 1],
  ["Revision complete", "200 - 350 TND", 1],
  ["Carrosserie / Peinture", "Sur devis", 0],
];

const defaultSlots = [
  ["Lundi", "08:00:00", "available"],
  ["Lundi", "09:00:00", "available"],
  ["Mardi", "10:00:00", "available"],
  ["Mercredi", "14:00:00", "available"],
  ["Vendredi", "15:00:00", "closed"],
];

function initTable(sql, seedSql, seedValues, label) {
  db.query(sql, (err) => {
    if (err) {
      console.error(`${label} table init failed:`, err.message);
      return;
    }

    db.query(seedSql, [seedValues], (seedErr) => {
      if (seedErr) {
        console.error(`${label} seed failed:`, seedErr.message);
      }
    });
  });
}

initTable(
  servicesTableSql,
  "INSERT IGNORE INTO services (name, price, active) VALUES ?",
  defaultServices,
  "Services"
);

initTable(
  slotsTableSql,
  "INSERT IGNORE INTO slots (day, time, status) VALUES ?",
  defaultSlots,
  "Slots"
);

function formatTime(value) {
  return String(value || "").slice(0, 5);
}

function dayNameFromDate(dateValue) {
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const parsed = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return null;
  return dayNames[parsed.getDay()];
}

router.get("/services", protect, (req, res) => {
  const includeInactive = req.user.role === "admin" && req.query.all === "true";
  const sql = `
    SELECT id, name, price, active
    FROM services
    ${includeInactive ? "" : "WHERE active = 1"}
    ORDER BY id ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, services: results });
  });
});

router.post("/services", protect, isAdmin, (req, res) => {
  const { name, price = "Sur devis" } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Service name required" });
  }

  const sql = "INSERT INTO services (name, price, active) VALUES (?, ?, 1)";

  db.query(sql, [name.trim(), price.trim() || "Sur devis"], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.status(201).json({
      success: true,
      service: {
        id: result.insertId,
        name: name.trim(),
        price: price.trim() || "Sur devis",
        active: 1,
      },
    });
  });
});

router.put("/services/:id", protect, isAdmin, (req, res) => {
  const { name, price, active } = req.body;
  const updates = [];
  const values = [];

  if (typeof name === "string" && name.trim()) {
    updates.push("name = ?");
    values.push(name.trim());
  }

  if (typeof price === "string") {
    updates.push("price = ?");
    values.push(price.trim() || "Sur devis");
  }

  if (active !== undefined) {
    updates.push("active = ?");
    values.push(active ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: "No changes provided" });
  }

  values.push(req.params.id);

  db.query(`UPDATE services SET ${updates.join(", ")} WHERE id = ?`, values, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, message: "Service updated" });
  });
});

router.delete("/services/:id", protect, isAdmin, (req, res) => {
  db.query("DELETE FROM services WHERE id = ?", [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, message: "Service deleted" });
  });
});

router.get("/slots", protect, (req, res) => {
  const { date } = req.query;
  const day = date ? dayNameFromDate(date) : null;

  if (date && !day) {
    return res.status(400).json({ success: false, message: "Invalid date" });
  }

  const sql = `
    SELECT s.id, s.day, TIME_FORMAT(s.time, '%H:%i') AS time,
      CASE
        WHEN s.status <> 'available' THEN s.status
        WHEN a.id IS NOT NULL THEN 'busy'
        ELSE 'available'
      END AS status
    FROM slots s
    LEFT JOIN appointments a ON
      ? IS NOT NULL
      AND a.appointment_date = ?
      AND TIME_FORMAT(a.appointment_time, '%H:%i') = TIME_FORMAT(s.time, '%H:%i')
      AND a.status IN ('pending', 'approved')
    ${day ? "WHERE s.day = ?" : ""}
    ORDER BY FIELD(s.day, 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'), s.time ASC
  `;

  const values = day ? [date || null, date || null, day] : [null, null];

  db.query(sql, values, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      day,
      slots: results.map((slot) => ({ ...slot, time: formatTime(slot.time) })),
    });
  });
});

router.post("/slots", protect, isAdmin, (req, res) => {
  const { day, time, status = "available" } = req.body;

  if (!day || !time) {
    return res.status(400).json({ success: false, message: "Day and time required" });
  }

  if (!["available", "busy", "closed"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid slot status" });
  }

  const sql = "INSERT INTO slots (day, time, status) VALUES (?, ?, ?)";

  db.query(sql, [day, time, status], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.status(201).json({
      success: true,
      slot: { id: result.insertId, day, time: formatTime(time), status },
    });
  });
});

router.put("/slots/:id", protect, isAdmin, (req, res) => {
  const { day, time, status } = req.body;
  const updates = [];
  const values = [];

  if (typeof day === "string" && day.trim()) {
    updates.push("day = ?");
    values.push(day.trim());
  }

  if (typeof time === "string" && time.trim()) {
    updates.push("time = ?");
    values.push(time.trim());
  }

  if (status !== undefined) {
    if (!["available", "busy", "closed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid slot status" });
    }

    updates.push("status = ?");
    values.push(status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: "No changes provided" });
  }

  values.push(req.params.id);

  db.query(`UPDATE slots SET ${updates.join(", ")} WHERE id = ?`, values, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, message: "Slot updated" });
  });
});

router.delete("/slots/:id", protect, isAdmin, (req, res) => {
  db.query("DELETE FROM slots WHERE id = ?", [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, message: "Slot deleted" });
  });
});

module.exports = {
  catalogRouter: router,
  dayNameFromDate,
};
