const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/authMiddleware");

// GET user notifications
router.get("/", protect, (req, res) => {
  const sql = `
    SELECT * FROM notifications 
    WHERE user_id = ?
    ORDER BY created_at DESC
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
      notifications: results,
    });
  });
});

// MARK notification as read
router.put("/:id/read", protect, (req, res) => {
  const sql = `
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [req.params.id, req.user.id], (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  });
});

module.exports = router;