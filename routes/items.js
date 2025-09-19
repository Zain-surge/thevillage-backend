import express from "express";
import pool from "../config/db.js"; // Your database connection file

const router = express.Router();

router.get("/items", async (req, res) => {
  console.log("TIME TO FETCH ITEMS NOW");
   const clientId = req.headers["x-client-id"];
  console.log("Client ID (brand_name):", clientId);

  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const result = await pool.query(
      `SELECT item_id, item_name, description, price_options, type, toppings, cheese, sauces, subtype, availability ,website 
       FROM Items 
       WHERE brand_name = $1`, 
      [clientId]
    );
    const items = result.rows.map((item) => ({
      id: item.item_id,
      title: item.item_name,
      description: item.description,
      price: item.price_options, // JSONB field
      Type: item.type,
      toppings: item.toppings,
      cheese: item.cheese,
      sauces: item.sauces,
      subType: item.subtype,
      availability: item.availability,
      website:item.website,
    }));

    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Set item availability (true/false)
router.put("/set-availability", async (req, res) => {
  console.log("AVAILABILITY");
  const { item_id, availability } = req.body;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  if (typeof item_id === "undefined" || typeof availability !== "boolean") {
    return res.status(400).json({
      error:
        "Invalid input. 'item_id' and 'availability' (boolean) are required.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE Items SET availability = $1 WHERE item_id = $2 AND brand_name = $3 RETURNING *`,
      [availability, item_id, clientId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.status(200).json({
      message: "Item availability updated successfully",
      item: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error updating availability:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Set order paid_status (true/false)
router.put("/set-paid-status", async (req, res) => {
  console.log("PAID STATUS UPDATE");

  const { order_id, paid_status } = req.body;

  // Validate headers (if you want to tie orders to a brand/client like items)
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  // Input validation
  if (typeof order_id === "undefined" || typeof paid_status !== "boolean") {
    return res.status(400).json({
      error: "Invalid input. 'order_id' and 'paid_status' (boolean) are required.",
    });
  }

  try {
    // Update order
    const result = await pool.query(
      `UPDATE orders 
       SET paid_status = $1 
       WHERE order_id = $2 AND brand_name = $3 
       RETURNING *`,
      [paid_status, order_id, clientId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({
      message: "Order paid_status updated successfully",
      order: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error updating paid_status:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get all unavailable items for a brand
router.get("/unavailable-items", async (req, res) => {
  const clientId = req.headers["x-client-id"]; // brand_name
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const result = await pool.query(
      `SELECT item_id,item_name, type,availability FROM items WHERE availability = false AND website=true AND brand_name = $1`,
      [clientId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching unavailable items:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add new item
router.post("/add-items", async (req, res) => {
  const clientId = req.headers["x-client-id"]; // brand_name
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const { item_name, type, description, price, toppings , website, subType} = req.body;

    if (!item_name || !type || !price) {
      return res.status(400).json({ error: "item_name, type, and price are required" });
    }

    // Insert into DB
    const result = await pool.query(
      `INSERT INTO items (item_name, type, description, availability, price_options, toppings, brand_name,website, subtype)
       VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9)
       RETURNING item_id, item_name, type, description, availability, price_options, toppings, brand_name, website, subtype`,
      [
        item_name,
        type,
        description || "",
        true, // default availability
        JSON.stringify(price), // store price inside JSONB
        JSON.stringify(toppings || []), // toppings as JSONB
        clientId,
        website,
        subType
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error adding item:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


export default router;
