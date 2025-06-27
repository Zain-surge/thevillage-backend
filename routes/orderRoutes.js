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
    status,
    order_source,
  } = req.body;
  const result = await pool.query(
    "INSERT INTO Orders (user_id, guest_id, transaction_id, payment_type, order_type, total_price, extra_notes,status,order_source) VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9) RETURNING order_id",
    [
      user_id,
      guest_id,
      transaction_id,
      payment_type,
      order_type,
      total_price,
      extra_notes,
      status,
      order_source,
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
          o.extra_notes AS order_extra_notes,
          o.status,
          o.created_at,
          o.change_due,
          o.order_source,
          COALESCE(u.name, g.name) AS customer_name,
          COALESCE(u.email, g.email) AS customer_email,
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
          change_due: row.change_due,
          order_source: row.order_source,
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          phone_number: row.phone_number,
          street_address: row.street_address,
          city: row.city,
          county: row.county,
          postal_code: row.postal_code,
          order_total_price: row.order_total_price,
          order_extra_notes: row.order_extra_notes,
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

router.post("/full-create", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      user_id,
      guest,
      transaction_id,
      payment_type,
      order_type,
      total_price,
      extra_notes,
      status,
      order_source,
      items,
    } = req.body;

    await client.query("BEGIN");

    // Step 1: Create guest if guest info is provided
    let guest_id = null;
    if (!user_id && guest) {
      const guestResult = await client.query(
        `INSERT INTO Guests (name, email, phone_number, street_address, city, county, postal_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING guest_id`,
        [
          guest.name,
          guest.email,
          guest.phone_number,
          guest.street_address,
          guest.city,
          guest.county,
          guest.postal_code,
        ]
      );
      guest_id = guestResult.rows[0].guest_id;
    }

    // Step 2: Create order
    const orderResult = await client.query(
      `INSERT INTO Orders (user_id, guest_id, transaction_id, payment_type, order_type, total_price, extra_notes, status, order_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING order_id`,
      [
        user_id || null,
        guest_id,
        transaction_id,
        payment_type,
        order_type,
        total_price,
        extra_notes,
        status,
        order_source,
      ]
    );
    const order_id = orderResult.rows[0].order_id;

    // Step 3: Batch insert items
    const insertValues = items
      .map(
        (item) =>
          `('${order_id}', '${item.item_id}', ${item.quantity}, '${item.description}', ${item.total_price})`
      )
      .join(",");

    await client.query(
      `INSERT INTO Order_Items (order_id, item_id, quantity, description, total_price)
       VALUES ${insertValues}`
    );

    await client.query("COMMIT");

    res.status(201).json({ order_id });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Full order creation failed:", error);
    res.status(500).json({ error: "Full order creation failed" });
  } finally {
    client.release();
  }
});

export default router;
