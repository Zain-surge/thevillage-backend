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

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  const result = await pool.query(
    "INSERT INTO Guests (name, email, phone_number, street_address, city, county, postal_code, brand_name) VALUES ($1, $2, $3, $4, $5, $6, $7,$8) RETURNING guest_id",
    [name, email, phone_number, street_address, city, county, postal_code, clientId]
  );
  console.log("GUEST CREATED");
  res.json({ guest_id: result.rows[0].guest_id });
});

export default router;
