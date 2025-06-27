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

export default router;
