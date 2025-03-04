import express from "express";
import pool from "../config/db.js"; // Your database connection file

const router = express.Router();
router.post("/create-guest", async (req, res) => {
  const {
    name,
    email,
    phone_number,
    street_address,
    city,
    county,
    postal_code,
  } = req.body;
  const result = await pool.query(
    "INSERT INTO Guests (name, email, phone_number, street_address, city, county, postal_code) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING guest_id",
    [name, email, phone_number, street_address, city, county, postal_code]
  );
  console.log("GUEST CREATED");
  res.json({ guest_id: result.rows[0].guest_id });
});

export default router;
