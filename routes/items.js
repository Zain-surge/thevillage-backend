import express from "express";
import pool from "../config/db.js"; // Your database connection file

const router = express.Router();

router.get("/items", async (req, res) => {
  console.log("TIME TO FETCH ITEMS NOW");
  try {
    const result = await pool.query("SELECT * FROM Items");
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
      subType: item.subtype,
      availability: item.availability,
    }));
    // console.log(items);

    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Set item availability (true/false)
router.put("/set-availability", async (req, res) => {
  const { item_id, availability } = req.body;

  if (typeof item_id === "undefined" || typeof availability !== "boolean") {
    return res
      .status(400)
      .json({
        error:
          "Invalid input. 'item_id' and 'availability' (boolean) are required.",
      });
  }

  try {
    const result = await pool.query(
      `UPDATE Items SET availability = $1 WHERE item_id = $2 RETURNING *`,
      [availability, item_id]
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

export default router;
