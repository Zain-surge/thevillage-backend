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

router.get("/sales-report/today", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD

    // Total sales
    const totalSalesQuery = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1`,
      [today]
    );

    // Sales by payment type
    const byPaymentQuery = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY payment_type`,
      [today]
    );

    // Sales by order type
    const byOrderTypeQuery = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY order_type`,
      [today]
    );

    // Sales by order source
    const byOrderSourceQuery = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [today]
    );

    // Most selling item
    const mostSellingItemQuery = await pool.query(
      `SELECT 
         oi.item_id,
         i.item_name,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.total_price) AS total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) = $1
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [today]
    );

    res.status(200).json({
      date: today,
      total_sales: totalSalesQuery.rows[0].total_sales,
      sales_by_payment_type: byPaymentQuery.rows,
      sales_by_order_type: byOrderTypeQuery.rows,
      sales_by_order_source: byOrderSourceQuery.rows,
      most_selling_item: mostSellingItemQuery.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Error generating sales report:", error);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
});
router.get("/sales-report/weekly", async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    const fromDate = lastWeek.toISOString().slice(0, 10);
    const toDate = today.toISOString().slice(0, 10);

    const totalSales = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    const byPayment = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY payment_type`,
      [fromDate, toDate]
    );

    const byOrderType = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY order_type`,
      [fromDate, toDate]
    );

    const byOrderSource = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [fromDate, toDate]
    );

    const mostSellingItem = await pool.query(
      `SELECT 
         oi.item_id,
         i.item_name,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.total_price) AS total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) BETWEEN $1 AND $2
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate]
    );

    res.status(200).json({
      period: { from: fromDate, to: toDate },
      total_sales: totalSales.rows[0].total_sales,
      sales_by_payment_type: byPayment.rows,
      sales_by_order_type: byOrderType.rows,
      sales_by_order_source: byOrderSource.rows,
      most_selling_item: mostSellingItem.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Error generating weekly sales report:", error);
    res.status(500).json({ error: "Failed to generate weekly sales report" });
  }
});
router.get("/sales-report/monthly", async (req, res) => {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date();

    const fromDate = firstDay.toISOString().slice(0, 10);
    const toDate = today.toISOString().slice(0, 10);

    const totalSales = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    const byPayment = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY payment_type`,
      [fromDate, toDate]
    );

    const byOrderType = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY order_type`,
      [fromDate, toDate]
    );

    const byOrderSource = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [fromDate, toDate]
    );

    const mostSellingItem = await pool.query(
      `SELECT 
         oi.item_id,
         i.item_name,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.total_price) AS total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) BETWEEN $1 AND $2
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate]
    );

    res.status(200).json({
      period: { from: fromDate, to: toDate },
      total_sales: totalSales.rows[0].total_sales,
      sales_by_payment_type: byPayment.rows,
      sales_by_order_type: byOrderType.rows,
      sales_by_order_source: byOrderSource.rows,
      most_selling_item: mostSellingItem.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Error generating monthly sales report:", error);
    res.status(500).json({ error: "Failed to generate monthly sales report" });
  }
});

export default router;
