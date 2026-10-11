const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect, isAdmin } = require("../middleware/authMiddleware");

router.get("/me", protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.get("/", protect, isAdmin, (req, res) => {
  const sql = `
    SELECT u.id, u.email, u.role, u.created_at, u.updated_at,
      COUNT(a.id) AS appointments_count,
      SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) AS approved_count
    FROM users u
    LEFT JOIN appointments a ON a.user_id = u.id
    GROUP BY u.id, u.email, u.role, u.created_at, u.updated_at
    ORDER BY u.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, users: results });
  });
});

module.exports = router;
