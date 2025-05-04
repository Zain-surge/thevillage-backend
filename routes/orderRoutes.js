import express from "express";
import pool from "../config/db.js"; // Your database connection file

const router = express.Router();
router.post("/create", async (req, res) => {
  const {
    user_id,
    guest_id,
    transaction_id,
    payment_type,
    order_type,
    total_price,
    extra_notes,
  } = req.body;
  const result = await pool.query(
    "INSERT INTO Orders (user_id, guest_id, transaction_id, payment_type, order_type, total_price, extra_notes,status) VALUES ($1, $2, $3, $4, $5, $6, $7,$8) RETURNING order_id",
    [
      user_id,
      guest_id,
      transaction_id,
      payment_type,
      order_type,
      total_price,
      extra_notes,
      "yellow",
    ]
  );
  console.log("ORDER ADDED SUCCESSSFULLY");
  res.json({ order_id: result.rows[0].order_id });
});

router.post("/add-item", async (req, res) => {
  try {
    const { order_id, item_id, quantity, description, total_price } = req.body;

    const newOrderItem = await pool.query(
      "INSERT INTO Order_Items (order_id, item_id, quantity, description, total_price) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [order_id, item_id, quantity, description, total_price]
    );

    res.status(201).json(newOrderItem.rows[0]);
  } catch (err) {
    console.error("Error inserting order item:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get("/today", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
          o.order_id,
          o.payment_type,
          o.transaction_id,
          o.order_type,
          o.total_price AS order_total_price,
          o.status,
          o.created_at,
          COALESCE(u.name, g.name) AS customer_name,
          COALESCE(u.phone_number, g.phone_number) AS phone_number,
          COALESCE(u.street_address, g.street_address) AS street_address,
          COALESCE(u.city, g.city) AS city,
          COALESCE(u.county, g.county) AS county,
          COALESCE(u.postal_code, g.postal_code) AS postal_code,
          i.item_name,
          i.type AS item_type,
          oi.quantity,
          oi.description AS item_description,
          oi.total_price AS item_total_price
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN Guests g ON o.guest_id = g.guest_id
      JOIN Order_Items oi ON o.order_id = oi.order_id
      JOIN Items i ON oi.item_id = i.item_id
      WHERE DATE(o.created_at) = CURRENT_DATE
      ORDER BY o.created_at DESC
      `
    );

    const rawData = result.rows;

    // Group by order_id
    const ordersMap = new Map();

    rawData.forEach((row) => {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          order_id: row.order_id,
          payment_type: row.payment_type,
          transaction_id: row.transaction_id,
          order_type: row.order_type,
          status: row.status,
          created_at: row.created_at,
          customer_name: row.customer_name,
          phone_number: row.phone_number,
          street_address: row.street_address,
          city: row.city,
          county: row.county,
          postal_code: row.postal_code,
          order_total_price: row.order_total_price,
          items: [],
        });
      }

      // Push item details to the corresponding order
      ordersMap.get(row.order_id).items.push({
        item_name: row.item_name,
        item_type: row.item_type,
        quantity: row.quantity,
        item_description: row.item_description,
        item_total_price: row.item_total_price,
      });
    });

    const groupedOrders = Array.from(ordersMap.values());

    res.status(200).json(groupedOrders);
  } catch (error) {
    console.error("Error fetching today's orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
