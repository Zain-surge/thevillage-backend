import express from "express";
import pool from "../config/db.js"; // Your database connection file
const router = express.Router();

// Get offers from admin table
router.get("/offers", async (req, res) => {
  try {
    // console.log("I AM HERE TO FETCH OFFERS");
    const result = await pool.query(
      "SELECT offers FROM admins where username='admin'"
    );
    // console.log(result);
    const offersData = result.rows.map((row) => row.offers).flat(); // Flatten if offers is array in each row

    res.json(offersData);
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});
router.put("/offers/update", async (req, res) => {
  const { offer_text, value } = req.body;

  try {
    // Step 1: Fetch existing offers
    const result = await pool.query(
      "SELECT offers FROM admins WHERE username = 'admin'"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    let offers = result.rows[0].offers;

    // Step 2: Update the value for the matching offer_text
    const updatedOffers = offers.map((offer) =>
      offer.offer_text === offer_text ? { ...offer, value } : offer
    );

    // Step 3: Save the updated offers array back to DB
    await pool.query("UPDATE admins SET offers = $1 WHERE username = 'admin'", [
      JSON.stringify(updatedOffers),
    ]);

    res
      .status(200)
      .json({ message: "Offer status updated", offers: updatedOffers });
  } catch (error) {
    console.error("❌ Error updating offer:", error);
    res.status(500).json({ error: "Failed to update offer" });
  }
});

router.put("/shop-toggle", async (req, res) => {
  const { shop_open } = req.body;

  try {
    await pool.query(
      "UPDATE admins SET shop_open = $1 WHERE username = 'admin'",
      [shop_open]
    );

    res
      .status(200)
      .json({ message: `Shop is now ${shop_open ? "open" : "closed"}` });
  } catch (error) {
    console.error("❌ Error toggling shop:", error);
    res.status(500).json({ error: "Failed to toggle shop status" });
  }
});

// Get current shop status
router.get("/shop-status", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT shop_open, shop_open_time, shop_close_time FROM admins WHERE username = 'admin'"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const { shop_open, shop_open_time, shop_close_time } = result.rows[0];

    res.status(200).json({
      shop_open,
      shop_open_time,
      shop_close_time,
    });
  } catch (error) {
    console.error("❌ Error fetching shop status:", error);
    res.status(500).json({ error: "Failed to fetch shop status" });
  }
});

router.put("/update-shop-timings", async (req, res) => {
  const { shop_open_time, shop_close_time } = req.body;

  try {
    await pool.query(
      "UPDATE admins SET shop_open_time = $1, shop_close_time = $2 WHERE username = 'admin'",
      [shop_open_time, shop_close_time]
    );

    res.status(200).json({ message: "Shop timings updated successfully" });
  } catch (error) {
    console.error("❌ Error updating shop timings:", error);
    res.status(500).json({ error: "Failed to update shop timings" });
  }
});

export default router;
