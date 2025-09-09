import express from "express";
import pool from "../config/db.js"; // Your database connection file
const router = express.Router();

const COLORS = ["#00C49F", "#FF8042"]; // Green for growth, orange for the rest
// Get offers from admin table
router.get("/offers", async (req, res) => {
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    // console.log("I AM HERE TO FETCH OFFERS");
    const result = await pool.query(
      "SELECT offers FROM admins WHERE brand_name = $1",
      [clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }
    // console.log(result);
    const offersData = result.rows.map((row) => row.offers).flat(); // Flatten if offers is array in each row

    res.json(offersData);
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

// Insert paidouts
router.post("/paidouts", async (req, res) => {
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  const paidouts = req.body.paidouts;
  // expected format: [{ label: "Supplier Payment", amount: 200 }, { label: "Utility Bill", amount: 500 }]

  if (!Array.isArray(paidouts) || paidouts.length === 0) {
    return res.status(400).json({ error: "Paidouts list is required" });
  }

  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const insertQuery = `
      INSERT INTO paidout (payout_date, label, amount, brand_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const inserted = [];
    for (const p of paidouts) {
      const result = await pool.query(insertQuery, [
        today,
        p.label,
        p.amount,
        clientId,
      ]);
      inserted.push(result.rows[0]);
    }

    res.status(201).json({ message: "Paidouts inserted", data: inserted });
  } catch (error) {
    console.error("Error inserting paidouts:", error);
    res.status(500).json({ error: "Failed to insert paidouts" });
  }
});
// Fetch today's paidouts
router.get("/paidouts/today", async (req, res) => {
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const result = await pool.query(
      "SELECT * FROM paidout WHERE brand_name = $1 AND payout_date = $2 ORDER BY id DESC",
      [clientId, today]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching today's paidouts:", error);
    res.status(500).json({ error: "Failed to fetch today's paidouts" });
  }
});
// Get all cancelled orders with merged user/guest details
router.get("/orders/cancelled", async (req, res) => {
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        o.order_id,
        o.transaction_id,
        o.total_price,
        o.created_at,
        o.payment_type,
        o.status,
        COALESCE(u.user_id, g.guest_id) AS customer_id,
        COALESCE(u.name, g.name) AS customer_name,
        COALESCE(u.email, g.email) AS customer_email,
        COALESCE(u.phone_number, g.phone_number) AS customer_phone,
        COALESCE(u.street_address, g.street_address) AS customer_address,
        COALESCE(u.city, g.city) AS customer_city,
        COALESCE(u.county, g.county) AS customer_county,
        COALESCE(u.postal_code, g.postal_code) AS customer_postal
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      LEFT JOIN guests g ON o.guest_id = g.guest_id
      WHERE o.brand_name = $1
        AND o.status = 'cancelled'
        AND o.payment_type = 'Card'
      ORDER BY o.created_at DESC
      `,
      [clientId]
    );


    res.status(200).json({ orders: result.rows });
  } catch (error) {
    console.error("❌ Error fetching cancelled orders:", error);
    res.status(500).json({ error: "Failed to fetch cancelled orders" });
  }
});



router.put("/offers/update", async (req, res) => {
  const { offer_text, value } = req.body;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }


  try {
    // Step 1: Fetch existing offers
    const result = await pool.query(
      "SELECT offers FROM admins WHERE brand_name = $1",
      [clientId]
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
    await pool.query(
      "UPDATE admins SET offers = $1 WHERE brand_name = $2",
      [JSON.stringify(updatedOffers), clientId]
    );

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
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    await pool.query(
      "UPDATE admins SET shop_open = $1 WHERE brand_name = $2",
      [shop_open, clientId]
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

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const result = await pool.query(
      "SELECT shop_open, shop_open_time, shop_close_time FROM admins WHERE brand_name = $1",
      [clientId]
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

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    await pool.query(
      "UPDATE admins SET shop_open_time = $1, shop_close_time = $2 WHERE brand_name = $3",
      [shop_open_time, shop_close_time, clientId]
    );

    res.status(200).json({ message: "Shop timings updated successfully" });
  } catch (error) {
    console.error("❌ Error updating shop timings:", error);
    res.status(500).json({ error: "Failed to update shop timings" });
  }
});

router.get("/sales-report/today", async (req, res) => {

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {

    const { source, payment, orderType } = req.query;
    const sourceParam = source === 'All' || !source ? null : source;
    const paymentParam = payment === 'All' || !payment ? null : payment;
    const orderTypeParam = orderType === 'All' || !orderType ? null : orderType;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const lastWeekSameDay = new Date(today);
    lastWeekSameDay.setDate(today.getDate() - 7);
    const lastWeekStr = lastWeekSameDay.toISOString().slice(0, 10); // Format: YYYY-MM-DD

    // Total sales
    const totalSalesQuery = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales , COALESCE(SUM(discount), 0) AS total_discount
       FROM orders 
       WHERE DATE(created_at) = $1
        AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );
    const totalSalesLastWeek = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1
        AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5`,
      [lastWeekStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by payment type
    const byPaymentQuery = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1
        AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4) 
    AND brand_name = $5
       GROUP BY payment_type`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order type
    const byOrderTypeQuery = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
        AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5
       GROUP BY order_type`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order source
    const byOrderSourceQuery = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
        AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
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
        AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR o.payment_type = $3)
    AND ($4::text IS NULL OR o.order_type = $4)
    AND o.brand_name = $5
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    const mostDeliveredPostalCodeQuery = await pool.query(
      `SELECT 
         COALESCE(u.postal_code, g.postal_code) AS postal_code,
         COUNT(*) AS delivery_count,
         SUM(o.total_price) AS total_delivery_sales
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.user_id
       LEFT JOIN guests g ON o.guest_id = g.guest_id
       WHERE DATE(o.created_at) = $1 
         AND LOWER(o.order_type) = 'delivery'
         AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
      AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR o.payment_type = $3)
    AND ($4::text IS NULL OR o.order_type = $4)
    AND o.brand_name = $5
       GROUP BY COALESCE(u.postal_code, g.postal_code)
       ORDER BY delivery_count DESC
       LIMIT 1`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );
    const allItemsSoldQuery = await pool.query(
      `SELECT 
         oi.item_id,
         i.item_name,
         i.type,
         i.subtype,
         SUM(oi.quantity) AS total_quantity_sold,
         AVG(oi.total_price / oi.quantity) AS average_unit_price,
         MIN(oi.total_price / oi.quantity) AS min_unit_price,
         MAX(oi.total_price / oi.quantity) AS max_unit_price,
         SUM(oi.total_price) AS total_item_sales,
         COUNT(DISTINCT oi.order_id) AS orders_containing_item
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) = $1
       AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
        AND ($3::text IS NULL OR o.payment_type = $3)
        AND ($4::text IS NULL OR o.order_type = $4)
        AND o.brand_name = $5
       GROUP BY oi.item_id, i.item_name, i.type, i.subtype
       ORDER BY total_quantity_sold DESC`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // ---------------- Paidouts Query ----------------
    const paidoutsQuery = await pool.query(
      `SELECT id, payout_date, label, amount
       FROM paidout
       WHERE DATE(payout_date) = $1
         AND brand_name = $2
       ORDER BY payout_date ASC`,
      [todayStr, clientId]
    );

    const deliveriesByPostalCodeQuery = await pool.query(
      `SELECT 
         COALESCE(u.postal_code, g.postal_code) AS postal_code,
         COUNT(*) AS delivery_count,
         SUM(o.total_price) AS total_delivery_sales
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.user_id
       LEFT JOIN guests g ON o.guest_id = g.guest_id
       WHERE DATE(o.created_at) = $1 
         AND LOWER(o.order_type) = 'delivery'
         AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
         AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
         AND ($3::text IS NULL OR o.payment_type = $3)
         AND ($4::text IS NULL OR o.order_type = $4)
         AND o.brand_name = $5
       GROUP BY COALESCE(u.postal_code, g.postal_code)
       ORDER BY delivery_count DESC`,
      [todayStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    const todaySales = parseFloat(totalSalesQuery.rows[0].total_sales);
    const todayDiscount = parseFloat(totalSalesQuery.rows[0].total_discount);
    const lastWeekSales = parseFloat(totalSalesLastWeek.rows[0].total_sales);
    const salesincrease = todaySales - lastWeekSales;

    let growth = 0;
    if (lastWeekSales > 0) {
      growth = ((todaySales - lastWeekSales) / lastWeekSales) * 100;
    }

    res.status(200).json({
      date: todayStr,
      total_sales: totalSalesQuery.rows[0].total_sales,
      total_discount: todayDiscount,
      sales_growth_percentage: parseFloat(growth.toFixed(2)),
      sales_increase: parseFloat(salesincrease.toFixed(2)),
      sales_by_payment_type: byPaymentQuery.rows,
      sales_by_order_type: byOrderTypeQuery.rows,
      sales_by_order_source: byOrderSourceQuery.rows,
      most_selling_item: mostSellingItemQuery.rows[0] || {},
      most_delivered_postal_code: mostDeliveredPostalCodeQuery.rows[0] || null,
      deliveries_by_postal_code: deliveriesByPostalCodeQuery.rows, // ✅ New field added
      all_items_sold: allItemsSoldQuery.rows,
      paidouts: paidoutsQuery.rows, // ✅ added here
    });
  } catch (error) {
    console.error("❌ Error generating sales report:", error);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
});

// Daily report with specific date parameter
router.get("/sales-report/daily2/:date", async (req, res) => {

  const clientId = req.headers["x-client-id"];
  
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const { date } = req.params;

    const { source, payment, orderType } = req.query;
    const sourceParam = source === 'All' || !source ? null : source;
    const paymentParam = payment === 'All' || !payment ? null : payment;
    const orderTypeParam = orderType === 'All' || !orderType ? null : orderType;
    console.log("DATA RECIEVED: ", date, sourceParam, paymentParam, orderTypeParam)


    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const reportDate = new Date(date);
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({ error: "Invalid date provided" });
    }
    console.log(date);
    const dateStr = date; // Already in YYYY-MM-DD format

    // Calculate same day last week for growth comparison
    const lastWeekSameDay = new Date(reportDate);
    lastWeekSameDay.setDate(reportDate.getDate() - 7);
    const lastWeekStr = lastWeekSameDay.toISOString().slice(0, 10);

    // Total sales for the specified date
    const totalSalesQuery = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales ,
          COALESCE(SUM(discount), 0) AS total_discount
       FROM orders 
       WHERE DATE(created_at) = $1
       AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND status!='cancelled'
    AND brand_name = $5`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Total sales for same day last week
    const totalSalesLastWeek = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) = $1
       AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND status!='cancelled'
    AND brand_name = $5`,
      [lastWeekStr, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Total orders placed
    const totalOrdersQuery = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders 
       WHERE DATE(created_at) = $1
       AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND status!='cancelled'
    AND brand_name = $5`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by payment type
    const byPaymentQuery = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5
    AND status!='cancelled'
       GROUP BY payment_type
       `,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order type
    const byOrderTypeQuery = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5
    AND status!='cancelled'
       GROUP BY order_type`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order source
    const byOrderSourceQuery = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) = $1 
       AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR payment_type = $3)
    AND ($4::text IS NULL OR order_type = $4)
    AND brand_name = $5
    AND status!='cancelled'
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
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
       AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR o.payment_type = $3)
    AND ($4::text IS NULL OR o.order_type = $4)
    AND o.brand_name = $5
    AND o.status!='cancelled'
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
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
       AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
    AND ($3::text IS NULL OR o.payment_type = $3)
    AND ($4::text IS NULL OR o.order_type = $4)
    AND o.brand_name = $5
    AND o.status!='cancelled'
       GROUP BY i.type
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    let mostDeliveredPostalCodeQuery = { rows: [null] };
    if (orderTypeParam === null || orderTypeParam.toLowerCase() === 'delivery') {
      mostDeliveredPostalCodeQuery = await pool.query(
        `SELECT 
           COALESCE(u.postal_code, g.postal_code) AS postal_code,
           COUNT(*) AS delivery_count,
           SUM(o.total_price) AS total_delivery_sales,
           COUNT(CASE WHEN o.user_id IS NOT NULL THEN 1 END) AS registered_user_deliveries,
           COUNT(CASE WHEN o.guest_id IS NOT NULL THEN 1 END) AS guest_deliveries
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.user_id
         LEFT JOIN guests g ON o.guest_id = g.guest_id
         WHERE DATE(o.created_at) = $1 
           AND LOWER(o.order_type) = 'delivery'
           AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
           AND ($3::text IS NULL OR o.payment_type = $3)
           AND o.brand_name = $4
           AND o.status!='cancelled'
           AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
         GROUP BY COALESCE(u.postal_code, g.postal_code)
         ORDER BY delivery_count DESC
         LIMIT 1`,
        [date, sourceParam, paymentParam, clientId]
      );
    }

    // All items sold on the specified date with detailed pricing
    const allItemsSoldQuery = await pool.query(
      `SELECT 
         oi.item_id,
         i.item_name,
         i.type,
         i.subtype,
         SUM(oi.quantity) AS total_quantity_sold,
         ROUND(AVG(oi.total_price / oi.quantity), 2) AS average_unit_price,
         ROUND(MIN(oi.total_price / oi.quantity), 2) AS min_unit_price,
         ROUND(MAX(oi.total_price / oi.quantity), 2) AS max_unit_price,
         SUM(oi.total_price) AS total_item_sales,
         COUNT(DISTINCT oi.order_id) AS orders_containing_item,
         ROUND((SUM(oi.total_price) / (SELECT COALESCE(SUM(total_price), 1) FROM orders WHERE DATE(created_at) = $1 AND ($2::text IS NULL OR COALESCE(order_source, 'Unknown') = $2) AND ($3::text IS NULL OR payment_type = $3) AND ($4::text IS NULL OR order_type = $4)) * 100), 2) AS percentage_of_total_sales
       FROM order_items oi
       JOIN items i ON oi.item_id = i.item_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE DATE(o.created_at) = $1
       AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
       AND ($3::text IS NULL OR o.payment_type = $3)
       AND ($4::text IS NULL OR o.order_type = $4)
       AND o.brand_name = $5
       AND o.status!='cancelled'
       GROUP BY oi.item_id, i.item_name, i.type, i.subtype
       ORDER BY total_quantity_sold DESC`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );
    // ---------------- Paidouts Query ----------------
    const paidoutsQuery = await pool.query(
      `SELECT id, payout_date, label, amount
       FROM paidout
       WHERE DATE(payout_date) = $1
         AND brand_name = $2
       ORDER BY payout_date ASC`,
      [date, clientId]
    );

    const deliveriesByPostalCodeQuery = await pool.query(
      `SELECT 
         COALESCE(u.postal_code, g.postal_code) AS postal_code,
         COUNT(*) AS delivery_count,
         SUM(o.total_price) AS total_delivery_sales
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.user_id
       LEFT JOIN guests g ON o.guest_id = g.guest_id
       WHERE DATE(o.created_at) = $1 
         AND LOWER(o.order_type) = 'delivery'
         AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
         AND ($2::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $2)
         AND ($3::text IS NULL OR o.payment_type = $3)
         AND ($4::text IS NULL OR o.order_type = $4)
         AND o.brand_name = $5
         AND o.status!='cancelled'
       GROUP BY COALESCE(u.postal_code, g.postal_code)
       ORDER BY delivery_count DESC`,
      [date, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    const todaySales = parseFloat(totalSalesQuery.rows[0].total_sales);
    const todayDiscount = parseFloat(totalSalesQuery.rows[0].total_discount);
    const lastWeekSales = parseFloat(totalSalesLastWeek.rows[0].total_sales);
    const salesincrease = todaySales - lastWeekSales;

    let growth = 0;
    if (lastWeekSales > 0) {
      growth = ((todaySales - lastWeekSales) / lastWeekSales) * 100;
    }

    res.status(200).json({
      date: dateStr,
      total_sales_amount: totalSalesQuery.rows[0].total_sales,
      total_discount: todayDiscount,   // ✅ NEW
      total_orders_placed: parseInt(totalOrdersQuery.rows[0].total_orders),
      sales_growth_percentage: parseFloat(growth.toFixed(2)),
      sales_increase: parseFloat(salesincrease.toFixed(2)),
      sales_by_payment_type: byPaymentQuery.rows,
      sales_by_order_type: byOrderTypeQuery.rows,
      sales_by_order_source: byOrderSourceQuery.rows,
      most_sold_item: mostSoldItemQuery.rows[0] || {},
      most_sold_type: mostSoldTypeQuery.rows[0] || {},
      most_delivered_postal_code: mostDeliveredPostalCodeQuery.rows[0] || null,
      deliveries_by_postal_code: deliveriesByPostalCodeQuery.rows, // ✅ New field added
      all_items_sold: allItemsSoldQuery.rows,
      paidouts: paidoutsQuery.rows,
    });
  } catch (error) {
    console.error("❌ Error generating daily sales report:", error);
    res.status(500).json({ error: "Failed to generate daily sales report" });
  }
});

// Weekly report with week number parameter
router.get("/sales-report/weekly2/:date", async (req, res) => {
const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    const { date } = req.params;
    const givenDate = new Date(date);

    if (isNaN(givenDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Calculate Monday of the week
    const dayOfWeek = givenDate.getDay(); // Sunday=0, Monday=1, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // shift to Monday
    const startOfWeek = new Date(givenDate);
    startOfWeek.setDate(givenDate.getDate() + mondayOffset);

    // Sunday = Monday + 6
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const fromDate = startOfWeek.toISOString().slice(0, 10);
    const toDate = endOfWeek.toISOString().slice(0, 10);

    // Calculate last week (for growth %)
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(startOfWeek.getDate() - 7);
    const lastWeekEnd = new Date(endOfWeek);
    lastWeekEnd.setDate(endOfWeek.getDate() - 7);
    const lastWeekFromDate = lastWeekStart.toISOString().slice(0, 10);
    const lastWeekToDate = lastWeekEnd.toISOString().slice(0, 10);

    const { source, payment, orderType } = req.query;
    const sourceParam = source === "All" || !source ? null : source;
    const paymentParam = payment === "All" || !payment ? null : payment;
    const orderTypeParam = orderType === "All" || !orderType ? null : orderType;
    // Total sales
    const totalSales = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    const totalSalesLastWeek = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6`,
      [lastWeekFromDate, lastWeekToDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Total orders
    const totalOrders = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by payment type
    const byPayment = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6
       GROUP BY payment_type`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order type
    const byOrderType = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6
       GROUP BY order_type`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order source
    const byOrderSource = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
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
       AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR o.payment_type = $4)
    AND ($5::text IS NULL OR o.order_type = $5)
    AND o.brand_name = $6
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
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
       AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR o.payment_type = $4)
    AND ($5::text IS NULL OR o.order_type = $5)
    AND o.brand_name = $6
       GROUP BY i.type
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Most delivered postal code (only for delivery orders and when no orderType filter or orderType is 'delivery')
    let mostDeliveredPostalCodeQuery = { rows: [null] };
    if (orderTypeParam === null || orderTypeParam.toLowerCase() === 'delivery') {
      mostDeliveredPostalCodeQuery = await pool.query(
        `SELECT 
       COALESCE(u.postal_code, g.postal_code) AS postal_code,
       COUNT(*) AS delivery_count,
       SUM(o.total_price) AS total_delivery_sales,
       COUNT(CASE WHEN o.user_id IS NOT NULL THEN 1 END) AS registered_user_deliveries,
       COUNT(CASE WHEN o.guest_id IS NOT NULL THEN 1 END) AS guest_deliveries
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.user_id
     LEFT JOIN guests g ON o.guest_id = g.guest_id
     WHERE DATE(o.created_at) BETWEEN $1 AND $2
       AND LOWER(o.order_type) = 'delivery'
       AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
       AND ($4::text IS NULL OR o.payment_type = $4)
       AND o.brand_name = $5
       AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
     GROUP BY COALESCE(u.postal_code, g.postal_code)
     ORDER BY delivery_count DESC
     LIMIT 1`,
        [fromDate, toDate, sourceParam, paymentParam, clientId]
      );
    }

    // All items sold in the week with detailed pricing
    const allItemsSoldQuery = await pool.query(
      `SELECT 
     oi.item_id,
     i.item_name,
     i.type,
     i.subtype,
     SUM(oi.quantity) AS total_quantity_sold,
     ROUND(AVG(oi.total_price / oi.quantity), 2) AS average_unit_price,
     ROUND(MIN(oi.total_price / oi.quantity), 2) AS min_unit_price,
     ROUND(MAX(oi.total_price / oi.quantity), 2) AS max_unit_price,
     SUM(oi.total_price) AS total_item_sales,
     COUNT(DISTINCT oi.order_id) AS orders_containing_item,
     ROUND((SUM(oi.total_price) / (SELECT COALESCE(SUM(total_price), 1) FROM orders WHERE DATE(created_at) BETWEEN $1 AND $2 AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3) AND ($4::text IS NULL OR payment_type = $4) AND ($5::text IS NULL OR order_type = $5)) * 100), 2) AS percentage_of_total_sales
   FROM order_items oi
   JOIN items i ON oi.item_id = i.item_id
   JOIN orders o ON oi.order_id = o.order_id
   WHERE DATE(o.created_at) BETWEEN $1 AND $2
   AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
   AND ($4::text IS NULL OR o.payment_type = $4)
   AND ($5::text IS NULL OR o.order_type = $5)
   AND o.brand_name = $6
   GROUP BY oi.item_id, i.item_name, i.type, i.subtype
   ORDER BY total_quantity_sold DESC`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId
      ]
    );
    const queryText = `
  SELECT 
     COALESCE(u.postal_code, g.postal_code) AS postal_code,
     COUNT(*) AS delivery_count,
     SUM(o.total_price) AS total_delivery_sales
   FROM orders o
   LEFT JOIN users u ON o.user_id = u.user_id
   LEFT JOIN guests g ON o.guest_id = g.guest_id
   WHERE DATE(o.created_at) BETWEEN $1 AND $2
     AND LOWER(o.order_type) = 'delivery'
     AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
     AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
     AND ($4::text IS NULL OR o.payment_type = $4)
     AND ($5::text IS NULL OR o.order_type = $5)
     AND o.brand_name = $6
   GROUP BY COALESCE(u.postal_code, g.postal_code)
   ORDER BY delivery_count DESC
`;

    const params = [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId];

    // Execute query
    const deliveriesByPostalCodeQuery = await pool.query(queryText, params);
    // Calculate growth metrics
    const currentWeekSales = parseFloat(totalSales.rows[0].total_sales);
    const lastWeekSales = parseFloat(totalSalesLastWeek.rows[0].total_sales);
    const salesIncrease = currentWeekSales - lastWeekSales;

    let growth = 0;
    if (lastWeekSales > 0) {
      growth = ((currentWeekSales - lastWeekSales) / lastWeekSales) * 100;
    }

    res.status(200).json({
      period: {
        from: fromDate,
        to: toDate,
      },
      total_sales_amount: totalSales.rows[0].total_sales,
      total_orders_placed: parseInt(totalOrders.rows[0].total_orders),
      sales_growth_percentage: parseFloat(growth.toFixed(2)),
      sales_increase: parseFloat(salesIncrease.toFixed(2)),
      sales_by_payment_type: byPayment.rows,
      sales_by_order_type: byOrderType.rows,
      sales_by_order_source: byOrderSource.rows,
      most_sold_item: mostSoldItem.rows[0] || {},
      most_sold_type: mostSoldType.rows[0] || {},
      most_delivered_postal_code: mostDeliveredPostalCodeQuery.rows[0] || null,
      deliveries_by_postal_code: deliveriesByPostalCodeQuery.rows, // ✅ New field added
      all_items_sold: allItemsSoldQuery.rows,
    });
  } catch (error) {
    console.error("❌ Error generating weekly sales report:", error);
    res.status(500).json({ error: "Failed to generate weekly sales report" });
  }
});

// Monthly report with month name parameter
router.get("/sales-report/monthly2/:year/:month", async (req, res) => {
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }
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

    // Calculate last month dates for comparison
    const lastMonthFirstDay = new Date(yearNum, monthNum - 1, 1);
    const lastMonthLastDay = new Date(yearNum, monthNum, 0);
    const lastMonthFromDate = lastMonthFirstDay.toISOString().slice(0, 10);
    const lastMonthToDate = lastMonthLastDay.toISOString().slice(0, 10);

    const { source, payment, orderType } = req.query;
    const sourceParam = source === 'All' || !source ? null : source;
    const paymentParam = payment === 'All' || !payment ? null : payment;
    const orderTypeParam = orderType === 'All' || !orderType ? null : orderType;

    // Total sales
    const totalSales = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Total sales for last month
    const totalSalesLastMonth = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6`,
      [lastMonthFromDate, lastMonthToDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Total orders
    const totalOrders = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by payment type
    const byPayment = await pool.query(
      `SELECT payment_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6
       GROUP BY payment_type`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order type
    const byOrderType = await pool.query(
      `SELECT order_type, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6
       GROUP BY order_type`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Sales by order source
    const byOrderSource = await pool.query(
      `SELECT COALESCE(order_source, 'Unknown') AS source, COUNT(*) AS count, SUM(total_price) AS total 
       FROM orders 
       WHERE DATE(created_at) BETWEEN $1 AND $2 
       AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR payment_type = $4)
    AND ($5::text IS NULL OR order_type = $5)
    AND brand_name = $6
       GROUP BY COALESCE(order_source, 'Unknown')`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
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
       AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR o.payment_type = $4)
    AND ($5::text IS NULL OR o.order_type = $5)
    AND o.brand_name = $6
       GROUP BY oi.item_id, i.item_name
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
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
       AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
    AND ($4::text IS NULL OR o.payment_type = $4)
    AND ($5::text IS NULL OR o.order_type = $5)
    AND o.brand_name = $6
       GROUP BY i.type
       ORDER BY quantity_sold DESC
       LIMIT 1`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );

    // Most delivered postal code (only for delivery orders and when no orderType filter or orderType is 'delivery')
    let mostDeliveredPostalCodeQuery = { rows: [null] };
    if (orderTypeParam === null || orderTypeParam.toLowerCase() === 'delivery') {
      mostDeliveredPostalCodeQuery = await pool.query(
        `SELECT 
       COALESCE(u.postal_code, g.postal_code) AS postal_code,
       COUNT(*) AS delivery_count,
       SUM(o.total_price) AS total_delivery_sales,
       COUNT(CASE WHEN o.user_id IS NOT NULL THEN 1 END) AS registered_user_deliveries,
       COUNT(CASE WHEN o.guest_id IS NOT NULL THEN 1 END) AS guest_deliveries
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.user_id
     LEFT JOIN guests g ON o.guest_id = g.guest_id
     WHERE DATE(o.created_at) BETWEEN $1 AND $2
       AND LOWER(o.order_type) = 'delivery'
       AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
       AND ($4::text IS NULL OR o.payment_type = $4)
       AND o.brand_name = $5
       AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
     GROUP BY COALESCE(u.postal_code, g.postal_code)
     ORDER BY delivery_count DESC
     LIMIT 1`,
        [fromDate, toDate, sourceParam, paymentParam, clientId]
      );
    }

    // All items sold in the month with detailed pricing
    const allItemsSoldQuery = await pool.query(
      `SELECT 
     oi.item_id,
     i.item_name,
     i.type,
     i.subtype,
     SUM(oi.quantity) AS total_quantity_sold,
     ROUND(AVG(oi.total_price / oi.quantity), 2) AS average_unit_price,
     ROUND(MIN(oi.total_price / oi.quantity), 2) AS min_unit_price,
     ROUND(MAX(oi.total_price / oi.quantity), 2) AS max_unit_price,
     SUM(oi.total_price) AS total_item_sales,
     COUNT(DISTINCT oi.order_id) AS orders_containing_item,
     ROUND((SUM(oi.total_price) / (SELECT COALESCE(SUM(total_price), 1) FROM orders WHERE DATE(created_at) BETWEEN $1 AND $2 AND ($3::text IS NULL OR COALESCE(order_source, 'Unknown') = $3) AND ($4::text IS NULL OR payment_type = $4) AND ($5::text IS NULL OR order_type = $5)) * 100), 2) AS percentage_of_total_sales
   FROM order_items oi
   JOIN items i ON oi.item_id = i.item_id
   JOIN orders o ON oi.order_id = o.order_id
   WHERE DATE(o.created_at) BETWEEN $1 AND $2
   AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
   AND ($4::text IS NULL OR o.payment_type = $4)
   AND ($5::text IS NULL OR o.order_type = $5)
   AND o.brand_name = $6
   GROUP BY oi.item_id, i.item_name, i.type, i.subtype
   ORDER BY total_quantity_sold DESC`,
      [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId]
    );
     const queryText = `
  SELECT 
     COALESCE(u.postal_code, g.postal_code) AS postal_code,
     COUNT(*) AS delivery_count,
     SUM(o.total_price) AS total_delivery_sales
   FROM orders o
   LEFT JOIN users u ON o.user_id = u.user_id
   LEFT JOIN guests g ON o.guest_id = g.guest_id
   WHERE DATE(o.created_at) BETWEEN $1 AND $2
     AND LOWER(o.order_type) = 'delivery'
     AND COALESCE(u.postal_code, g.postal_code) IS NOT NULL
     AND ($3::text IS NULL OR COALESCE(o.order_source, 'Unknown') = $3)
     AND ($4::text IS NULL OR o.payment_type = $4)
     AND ($5::text IS NULL OR o.order_type = $5)
     AND o.brand_name = $6
   GROUP BY COALESCE(u.postal_code, g.postal_code)
   ORDER BY delivery_count DESC
`;

    const params = [fromDate, toDate, sourceParam, paymentParam, orderTypeParam, clientId];

    // Execute query
    const deliveriesByPostalCodeQuery = await pool.query(queryText, params);

    // Calculate growth metrics
    const currentMonthSales = parseFloat(totalSales.rows[0].total_sales);
    const lastMonthSales = parseFloat(totalSalesLastMonth.rows[0].total_sales);
    const salesIncrease = currentMonthSales - lastMonthSales;

    let growth = 0;
    if (lastMonthSales > 0) {
      growth = ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100;
    }

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
      sales_growth_percentage: parseFloat(growth.toFixed(2)),
      sales_increase: parseFloat(salesIncrease.toFixed(2)),
      sales_by_payment_type: byPayment.rows,
      sales_by_order_type: byOrderType.rows,
      sales_by_order_source: byOrderSource.rows,
      most_sold_item: mostSoldItem.rows[0] || {},
      most_sold_type: mostSoldType.rows[0] || {},
      most_delivered_postal_code: mostDeliveredPostalCodeQuery.rows[0] || null,
      deliveries_by_postal_code: deliveriesByPostalCodeQuery.rows, // ✅ New field added
      all_items_sold: allItemsSoldQuery.rows,
    });
  } catch (error) {
    console.error("❌ Error generating monthly sales report:", error);
    res.status(500).json({ error: "Failed to generate monthly sales report" });
  }
});

// Driver report for a specific date (no filters)
router.get("/driver-report/:date", async (req, res) => {
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  try {
    console.log("ENTERED")
    const { date } = req.params;
    console.log("DRIVER REPORT DATE:", date)
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // 1. Driver-wise total order count
    const driverSummaryQuery = await pool.query(
      `SELECT
        d.id AS driver_id,
        d.name AS driver_name,
        COUNT(o.order_id) AS total_orders
      FROM
        orders o
      JOIN drivers d ON o.driver_id = d.id
      WHERE
        DATE(o.created_at) = $1
        AND o.brand_name = $2
      GROUP BY d.id, d.name
      ORDER BY total_orders DESC`,
      [date, clientId]
    );

    // 2. Driver-wise delivery addresses
    const driverDeliveryLocationsQuery = await pool.query(
      `SELECT
        d.id AS driver_id,
        d.name AS driver_name,
        COALESCE(u.street_address, g.street_address) AS street_address,
        COALESCE(u.city, g.city) AS city,
        COALESCE(u.county, g.county) AS county,
        COALESCE(u.postal_code, g.postal_code) AS postal_code,
        COUNT(o.order_id) AS orders_to_location
      FROM
        orders o
      JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON o.user_id = u.user_id
      LEFT JOIN guests g ON o.guest_id = g.guest_id
      WHERE
        DATE(o.created_at) = $1
        AND o.brand_name = $2
      GROUP BY
  d.id,
  d.name,
  COALESCE(u.street_address, g.street_address),
  COALESCE(u.city, g.city),
  COALESCE(u.county, g.county),
  COALESCE(u.postal_code, g.postal_code)
      ORDER BY d.name`,
      [date, clientId]
    );

    res.status(200).json({

      date,
      driver_order_summary: driverSummaryQuery.rows,
      driver_delivery_locations: driverDeliveryLocationsQuery.rows,
    });
  } catch (error) {
    console.error("❌ Error generating driver report:", error);
    res.status(500).json({ error: "Failed to generate driver report" });
  }
});

export default router;
