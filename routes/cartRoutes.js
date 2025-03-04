import express from "express";
import pool from "../config/db.js"; // Your database connection file

const router = express.Router();

// Save cart items to the database
router.post("/saveCart", async (req, res) => {
  const { userId, cartItems } = req.body;

  try {
    await pool.query("BEGIN");

    await pool.query("DELETE FROM Cart WHERE user_id = $1", [userId]);

    // Insert into Cart table
    const cartResult = await pool.query(
      "INSERT INTO Cart (user_id) VALUES ($1) RETURNING cart_id",
      [userId]
    );
    const cartId = cartResult.rows[0].cart_id;

    // Insert into Cart_Items table
    for (const item of cartItems) {
      await pool.query(
        "INSERT INTO Cart_Items (cart_id, item_id, additional_description, quantity, total_price) VALUES ($1, $2, $3, $4, $5)",
        [cartId, item.id, item.description, item.itemQuantity, item.totalPrice]
      );
    }

    await pool.query("COMMIT");
    res.status(200).json({ success: true });
    console.log("ITEMS INSERTED");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error saving cart:", error);
    res.status(500).json({ success: false, error: "Failed to save cart" });
  }
});

router.get("/getCart/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const cartResult = await pool.query(
      "SELECT cart_id FROM Cart WHERE user_id = $1",
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(200).json({ success: true, cart: [] });
    }

    const cartId = cartResult.rows[0].cart_id;

    const cartItemsResult = await pool.query(
      `SELECT ci.item_id, i.item_name, i.type, i.description, i.availability, 
              i.price_options, i.image_url, ci.additional_description, 
              ci.quantity, ci.total_price
       FROM Cart_Items ci
       JOIN Items i ON ci.item_id = i.item_id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    res.status(200).json({ success: true, cart: cartItemsResult.rows });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve cart" });
  }
});

export default router;
