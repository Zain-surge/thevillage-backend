import express from "express";
import pool from "../config/db.js"; // Your database connection file
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

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

// Nodemailer Config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/update-status", async (req, res) => {
  const { order_id, status, driver_id } = req.body;

  try {
    // Update order status in DB
    const updateResult = await pool.query(
      `UPDATE Orders SET status = $1, driver_id = $2 WHERE order_id = $3
       RETURNING order_type, user_id, guest_id, driver_id`,
      [status, driver_id, order_id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const {
      order_type,
      user_id,
      guest_id,
      driver_id: updatedDriverId,
    } = updateResult.rows[0];

    // Only proceed with email if status is green
    if (status === "green" && updatedDriverId) {
      let emailResult;

      if (user_id) {
        emailResult = await pool.query(
          "SELECT email FROM Users WHERE user_id = $1",
          [user_id]
        );
      } else if (guest_id) {
        emailResult = await pool.query(
          "SELECT email FROM Guests WHERE guest_id = $1",
          [guest_id]
        );
      }

      const customer_email = emailResult?.rows?.[0]?.email;

      if (customer_email) {
        // Use your preferred email sending method (e.g., Nodemailer)
        const subject =
          order_type === "delivery"
            ? "Your order is on its way!"
            : "Your order is ready for pickup!";
        const message =
          order_type === "delivery"
            ? "Hi! Your order is now on its way. 🍕🚗"
            : "Hi! Your order is ready for pickup. 🍕🎉";
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: customer_email,
          subject,
          message,
        });

        console.log("Email receipt sent to:", customer_email);
      }
    }

    res.status(200).json({ message: "Order status updated" });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
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
          o.driver_id, 
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
          driver_id: row.driver_id,
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
  console.log("REQUEST", req.body);

  let rawBody = "";
  req.on("data", (chunk) => {
    rawBody += chunk;
  });

  req.on("end", () => {
    console.log("Raw request body:", rawBody); // 👀 See if anything is sent
  });
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
    console.log(
      "Parsed transaction_id:",
      transaction_id,
      user_id,
      guest,
      payment_type
    );

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
const normalizePhone = (phone) => {
  return phone.replace(/[^0-9]/g, ""); // Keep only digits
};

router.post("/search-customer", async (req, res) => {
  const { phone_number } = req.body;

  if (!phone_number) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const normalizedInput = normalizePhone(phone_number);

  try {
    // Search in Users table
    const userResult = await pool.query(
      `
      SELECT name, email, street_address, city, county, postal_code, phone_number
      FROM Users
      WHERE REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g') = $1
      LIMIT 1
    `,
      [normalizedInput]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      return res.json({
        source: "user",
        name: user.name,
        email: user.email,
        address: {
          street: user.street_address,
          city: user.city,
          county: user.county,
          postal_code: user.postal_code,
        },
        phone_number: user.phone_number,
      });
    }

    // Search in Guests table
    const guestResult = await pool.query(
      `
      SELECT name, email, street_address, city, county, postal_code, phone_number
      FROM Guests
      WHERE REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g') = $1
      LIMIT 1
    `,
      [normalizedInput]
    );

    if (guestResult.rows.length > 0) {
      const guest = guestResult.rows[0];
      return res.json({
        source: "guest",
        name: guest.name,
        email: guest.email,
        address: {
          street: guest.street_address,
          city: guest.city,
          county: guest.county,
          postal_code: guest.postal_code,
        },
        phone_number: guest.phone_number,
      });
    }

    res.status(404).json({ message: "Customer not found" });
  } catch (error) {
    console.error("❌ Error searching for customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
