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

export default router;
