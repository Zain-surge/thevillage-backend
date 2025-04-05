import express from "express";
import pool from "../config/db.js"; // Your database connection file
const router = express.Router();

// Get offers from admin table
router.get("/offers", async (req, res) => {
  try {
    const result = await pool.query("SELECT offers FROM admin");
    const offersData = result.rows.map((row) => row.offers).flat(); // Flatten if offers is array in each row

    res.json(offersData);
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

export default router;
