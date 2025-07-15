import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Create a new driver
router.post("/create", async (req, res) => {
  const { name, email, username, password, phone_number } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO drivers (name, email, username, password, phone_number)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, username, password, phone_number]
    );

    res
      .status(201)
      .json({ message: "Driver created successfully", driver: result.rows[0] });
  } catch (error) {
    console.error("❌ Error creating driver:", error);
    res.status(500).json({ error: "Failed to create driver" });
  }
});

// Deactivate a driver by username
router.put("/deactivate/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      `UPDATE drivers SET is_active = FALSE WHERE username = $1 RETURNING *`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res
      .status(200)
      .json({
        message: "Driver deactivated successfully",
        driver: result.rows[0],
      });
  } catch (error) {
    console.error("❌ Error deactivating driver:", error);
    res.status(500).json({ error: "Failed to deactivate driver" });
  }
});

export default router;
