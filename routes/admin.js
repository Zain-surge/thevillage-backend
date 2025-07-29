import express from "express";
import pool from "../config/db.js"; // Your database connection file
const router = express.Router();

const COLORS = ["#00C49F", "#FF8042"]; // Green for growth, orange for the rest
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
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const lastWeekSameDay = new Date(today);
    lastWeekSameDay.setDate(today.getDate() - 7);
    const lastWeekStr = lastWeekSameDay.toISOString().slice(0, 10); // Format: YYYY-MM-DD

    // Total sales
    const totalSalesQuery = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1`,
      [todayStr]
    );
    const totalSalesLastWeek = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1`,
      [lastWeekStr]
    );

    // Sales by payment type
    const byPaymentQuery = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY payment_type`,
      [todayStr]
    );

    // Sales by order type
    const byOrderTypeQuery = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY order_type`,
      [todayStr]
    );

    // Sales by order source
    const byOrderSourceQuery = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [todayStr]
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
      [todayStr]
    );

    const todaySales = parseFloat(totalSalesQuery.rows[0].total_sales);
    const lastWeekSales = parseFloat(totalSalesLastWeek.rows[0].total_sales);

    let growth = 0;
    if (lastWeekSales > 0) {
      growth = ((todaySales - lastWeekSales) / lastWeekSales) * 100;
    }

    res.status(200).json({
      date: todayStr,
      total_sales: totalSalesQuery.rows[0].total_sales,
      sales_growth_percentage: parseFloat(growth.toFixed(2)),
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

// Daily report with specific date parameter
router.get("/sales-report/daily2/:date", async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const reportDate = new Date(date);
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({ error: "Invalid date provided" });
    }

    const dateStr = date; // Already in YYYY-MM-DD format

    // Calculate same day last week for growth comparison
    const lastWeekSameDay = new Date(reportDate);
    lastWeekSameDay.setDate(reportDate.getDate() - 7);
    const lastWeekStr = lastWeekSameDay.toISOString().slice(0, 10);

    // Total sales for the specified date
    const totalSalesQuery = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1`,
      [dateStr]
    );

    // Total sales for same day last week
    const totalSalesLastWeek = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1`,
      [lastWeekStr]
    );

    // Total orders placed
    const totalOrdersQuery = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders 
       WHERE DATE(created_at) = $1`,
      [dateStr]
    );

    // Sales by payment type
    const byPaymentQuery = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY payment_type`,
      [dateStr]
    );

    // Sales by order type
    const byOrderTypeQuery = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY order_type`,
      [dateStr]
    );

    // Sales by order source
    const byOrderSourceQuery = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [dateStr]
    );

    // Most sold item
    const mostSoldItemQuery = await pool.query(
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
      [dateStr]
    );

    // Most sold type
    const mostSoldTypeQuery = await pool.query(
      `SELECT 
         i.type,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.total_price) AS total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) = $1
       GROUP BY i.type
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [dateStr]
    );

    const todaySales = parseFloat(totalSalesQuery.rows[0].total_sales);
    const lastWeekSales = parseFloat(totalSalesLastWeek.rows[0].total_sales);

    let growth = 0;
    if (lastWeekSales > 0) {
      growth = ((todaySales - lastWeekSales) / lastWeekSales) * 100;
    }

    res.status(200).json({
      date: dateStr,
      total_sales_amount: totalSalesQuery.rows[0].total_sales,
      total_orders_placed: parseInt(totalOrdersQuery.rows[0].total_orders),
      sales_growth_percentage: parseFloat(growth.toFixed(2)),
      sales_by_payment_type: byPaymentQuery.rows,
      sales_by_order_type: byOrderTypeQuery.rows,
      sales_by_order_source: byOrderSourceQuery.rows,
      most_sold_item: mostSoldItemQuery.rows[0] || {},
      most_sold_type: mostSoldTypeQuery.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Error generating daily sales report:", error);
    res.status(500).json({ error: "Failed to generate daily sales report" });
  }
});

// Weekly report with week number parameter
router.get("/sales-report/weekly2/:year/:week", async (req, res) => {
  try {
    const { year, week } = req.params;
    
    // Validate year and week
    const yearNum = parseInt(year);
    const weekNum = parseInt(week);
    
    if (isNaN(yearNum) || isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
      return res.status(400).json({ error: "Invalid year or week number. Week should be 1-53" });
    }

    // Calculate start and end dates for the week
    const startOfYear = new Date(yearNum, 0, 1);
    const daysToAdd = (weekNum - 1) * 7;
    const startOfWeek = new Date(startOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday as start of week
    const dayOfWeek = startOfWeek.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const fromDate = startOfWeek.toISOString().slice(0, 10);
    const toDate = endOfWeek.toISOString().slice(0, 10);

    // Total sales
    const totalSales = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    // Total orders
    const totalOrders = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    // Sales by payment type
    const byPayment = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY payment_type`,
      [fromDate, toDate]
    );

    // Sales by order type
    const byOrderType = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY order_type`,
      [fromDate, toDate]
    );

    // Sales by order source
    const byOrderSource = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [fromDate, toDate]
    );

    // Most sold item
    const mostSoldItem = await pool.query(
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

    // Most sold type
    const mostSoldType = await pool.query(
      `SELECT 
         i.type,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.total_price) AS total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) BETWEEN $1 AND $2
       GROUP BY i.type
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate]
    );

    res.status(200).json({
      period: { 
        year: yearNum,
        week: weekNum,
        from: fromDate, 
        to: toDate 
      },
      total_sales_amount: totalSales.rows[0].total_sales,
      total_orders_placed: parseInt(totalOrders.rows[0].total_orders),
      sales_by_payment_type: byPayment.rows,
      sales_by_order_type: byOrderType.rows,
      sales_by_order_source: byOrderSource.rows,
      most_sold_item: mostSoldItem.rows[0] || {},
      most_sold_type: mostSoldType.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Error generating weekly sales report:", error);
    res.status(500).json({ error: "Failed to generate weekly sales report" });
  }
});

// Monthly report with month name parameter
router.get("/sales-report/monthly2/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    
    const yearNum = parseInt(year);
    let monthNum;
    
    // Handle month name or number
    if (isNaN(parseInt(month))) {
      // Month name provided
      const monthNames = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
      };
      monthNum = monthNames[month.toLowerCase()];
      
      if (monthNum === undefined) {
        return res.status(400).json({ 
          error: "Invalid month name. Use full month names like 'january', 'february', etc." 
        });
      }
    } else {
      // Month number provided (1-12)
      monthNum = parseInt(month) - 1; // Convert to 0-based index
      if (monthNum < 0 || monthNum > 11) {
        return res.status(400).json({ error: "Invalid month number. Use 1-12" });
      }
    }

    if (isNaN(yearNum)) {
      return res.status(400).json({ error: "Invalid year provided" });
    }

    // Calculate first and last day of the month
    const firstDay = new Date(yearNum, monthNum, 1);
    const lastDay = new Date(yearNum, monthNum + 1, 0); // Last day of the month

    const fromDate = firstDay.toISOString().slice(0, 10);
    const toDate = lastDay.toISOString().slice(0, 10);

    // Total sales
    const totalSales = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    // Total orders
    const totalOrders = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    // Sales by payment type
    const byPayment = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY payment_type`,
      [fromDate, toDate]
    );

    // Sales by order type
    const byOrderType = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY order_type`,
      [fromDate, toDate]
    );

    // Sales by order source
    const byOrderSource = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [fromDate, toDate]
    );

    // Most sold item
    const mostSoldItem = await pool.query(
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

    // Most sold type
    const mostSoldType = await pool.query(
      `SELECT 
         i.type,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.total_price) AS total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) BETWEEN $1 AND $2
       GROUP BY i.type
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate]
    );

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    res.status(200).json({
      period: { 
        year: yearNum,
        month: monthNames[monthNum],
        from: fromDate, 
        to: toDate 
      },
      total_sales_amount: totalSales.rows[0].total_sales,
      total_orders_placed: parseInt(totalOrders.rows[0].total_orders),
      sales_by_payment_type: byPayment.rows,
      sales_by_order_type: byOrderType.rows,
      sales_by_order_source: byOrderSource.rows,
      most_sold_item: mostSoldItem.rows[0] || {},
      most_sold_type: mostSoldType.rows[0] || {},
    });
  } catch (error) {
    console.error("❌ Error generating monthly sales report:", error);
    res.status(500).json({ error: "Failed to generate monthly sales report" });
  }
});
export default router;
