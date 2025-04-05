import express from "express";
import pool from "../config/db.js"; // Your database connection file

const router = express.Router();

router.get("/items", async (req, res) => {
  console.log("TIME TO FETCH ITEMS");
  try {
    const result = await pool.query(
      "SELECT * FROM Items WHERE availability = TRUE"
    );
    const items = result.rows.map((item) => ({
      id: item.item_id,
      title: item.item_name,
      description: item.description,
      price: item.price_options, // JSONB field
      Type: item.type,
      image: item.image_url,
      toppings: item.toppings,
      cheese: item.cheese,
      sauces: item.sauces,
    }));

    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
