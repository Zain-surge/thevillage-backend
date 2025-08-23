import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Create a new driver
router.post("/create", async (req, res) => {
  const { name, email, username, password, phone_number } = req.body;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  console.log("CLIENT ID: ", clientId)

  try {
    const result = await pool.query(
      `INSERT INTO drivers (name, email, username, password, phone_number, brand_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, username, password, phone_number,clientId]
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

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const result = await pool.query(
      `UPDATE drivers SET is_active = FALSE WHERE username = $1 AND brand_name= $2 RETURNING *`,
      [username,clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.status(200).json({
      message: "Driver deactivated successfully",
      driver: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error deactivating driver:", error);
    res.status(500).json({ error: "Failed to deactivate driver" });
  }
});

// Login driver
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM drivers WHERE username = $1 AND brand_name=$2`,
      [username,clientId]
    );

    const driver = result.rows[0];

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // 🔐 In production, use bcrypt.compare(password, driver.password)
    if (driver.password !== password) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Optionally: generate JWT token here

    res.status(200).json({
      message: "Login successful",
      driver: {
        id: driver.id,
        name: driver.name,
        username: driver.username,
        email: driver.email,
        phone_number: driver.phone_number,
        is_active: driver.is_active,
      },
    });
  } catch (error) {
    console.error("❌ Error logging in driver:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Get orders with driver details for a specific date
router.get("/orders-with-driver/:date", async (req, res) => {
  const { date } = req.params;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const query = `
     SELECT 
  o.order_id,
  COALESCE(u.name, g.name) AS customer_name,
  COALESCE(u.street_address, g.street_address) AS customer_street_address,
  COALESCE(u.city, g.city) AS customer_city,
  COALESCE(u.county, g.county) AS customer_county,
  COALESCE(u.postal_code, g.postal_code) AS customer_postal_code,
  d.id AS driver_id,
  d.name AS driver_name,
  d.phone_number AS driver_phone,
  o.total_price,
  o.status,
  TO_CHAR(o.created_at, 'HH24:MI:SS') AS order_time,
  json_agg(
    json_build_object(
      'item_name', i.item_name,
      'quantity', oi.quantity,
      'total_price', oi.total_price,
      'description', oi.description
    )
  ) AS items
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id
LEFT JOIN guests g ON o.guest_id = g.guest_id
LEFT JOIN drivers d ON o.driver_id = d.id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN items i ON oi.item_id = i.item_id
WHERE o.driver_id IS NOT NULL
  AND DATE(o.created_at) = $1
  AND o.brand_name= $2
GROUP BY 
  o.order_id,
  customer_name,
  customer_street_address,
  customer_city,
  customer_county,
  customer_postal_code,
  d.id, d.name, d.phone_number,
  o.total_price, o.status, order_time
ORDER BY o.created_at DESC;

    `;

    const result = await pool.query(query, [date,clientId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching orders with driver:", error);
    res.status(500).json({ error: "Failed to fetch orders with driver" });
  }
});



export default router;
