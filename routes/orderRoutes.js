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
    driver_id,
  } = req.body;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  const result = await pool.query(
    "INSERT INTO Orders (user_id, guest_id, transaction_id, payment_type, order_type, total_price, extra_notes,status,order_source,driver_id,brand_name) VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9,$10,$11) RETURNING order_id",
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
      driver_id,
      clientId
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

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }


  try {
    // Update order status in DB
    const updateResult = await pool.query(
      `UPDATE Orders SET status = $1, driver_id = $2 WHERE order_id = $3 AND brand_name=$4
       RETURNING order_type, user_id, guest_id, driver_id`,
      [status, driver_id, order_id, clientId]
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
      // Get complete order details for email
      const orderDetailsResult = await pool.query(
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
          
          -- Driver details
          d.id AS id,
          d.name AS name,
          d.phone_number AS phone_number,
          d.email AS email,
          
          -- Customer details
          COALESCE(u.name, g.name) AS customer_name,
          COALESCE(u.email, g.email) AS customer_email,
          COALESCE(u.phone_number, g.phone_number) AS phone_number,
          COALESCE(u.street_address, g.street_address) AS street_address,
          COALESCE(u.city, g.city) AS city,
          COALESCE(u.county, g.county) AS county,
          COALESCE(u.postal_code, g.postal_code) AS postal_code,
          
          -- Items
          i.item_name,
          i.type AS type,
          oi.quantity,
          oi.description AS description,
          oi.total_price AS total_price
        FROM Orders o
        LEFT JOIN Users u ON o.user_id = u.user_id
        LEFT JOIN Guests g ON o.guest_id = g.guest_id
        LEFT JOIN Drivers d ON o.driver_id = d.id
        JOIN Order_Items oi ON o.order_id = oi.order_id
        JOIN Items i ON oi.item_id = i.item_id
        WHERE o.order_id = $1
        AND o.brand_name=$2
        `,
        [order_id, clientId]
      );

      const orderRows = orderDetailsResult.rows;

      if (orderRows.length > 0) {
        const customer_email = orderRows[0].customer_email;

        if (customer_email) {
          // Build order details for email
          const orderData = {
            order_id: orderRows[0].order_id,
            payment_type: orderRows[0].payment_type,
            transaction_id: orderRows[0].transaction_id,
            order_type: orderRows[0].order_type,
            total_price: orderRows[0].order_total_price,
            extra_notes: orderRows[0].order_extra_notes,
            status: orderRows[0].status,
            created_at: orderRows[0].created_at,
            change_due: orderRows[0].change_due,
            order_source: orderRows[0].order_source,
            customer_name: orderRows[0].customer_name,
            customer_email: orderRows[0].customer_email,
            phone_number: orderRows[0].phone_number,
            street_address: orderRows[0].street_address,
            city: orderRows[0].city,
            county: orderRows[0].county,
            postal_code: orderRows[0].postal_code,
            driver: {
              name: orderRows[0].driver_name,
              phone: orderRows[0].driver_phone,
              email: orderRows[0].driver_email,
            },
            items: []
          };

          // Group items
          orderRows.forEach((row) => {
            orderData.items.push({
              item_name: row.item_name,
              item_type: row.type,
              quantity: row.quantity,
              item_description: row.description,
              item_total_price: row.total_price,
            });
          });

          // Create detailed email content
          const subject =
            order_type === "delivery"
              ? `🚗 Your Order #${order_id} is On Its Way!`
              : `🎉 Your Order #${order_id} is Ready for Pickup!`;

          // const itemsList = orderData.items
          //   .map(
          //     (item) =>
          //       `• ${item.quantity}x ${item.item_name} - $${item.total_price.toFixed(2)}
          //         ${item.item_description ? `  (${item.item_description})` : ''}`
          //   )
          //   .join('\n');

          const deliveryAddress = order_type === "delivery"
            ? `${orderData.street_address}, ${orderData.city}, ${orderData.county} ${orderData.postal_code}`
            : '';

          const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #808080; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .order-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #e0e0e0; }
        .items-list { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #e0e0e0; }
        .driver-info { background-color: #e8f5e8; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #808080; }
        .footer { background-color: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; }
        .highlight { color: #808080; font-weight: bold; }
        .price { font-weight: bold; color: #808080; }
        h3 { margin-top: 0; color: #808080; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${order_type === "delivery" ? "🚗 Your Order is On Its Way!" : "🎉 Your Order is Ready!"}</h1>
            <p>Order #${orderData.order_id}</p>
        </div>
        
        <div class="content">
            <p>Hi ${orderData.customer_name || 'Valued Customer'}!</p>
            <p>${order_type === "delivery"
              ? `Great news! Your delicious order is now on its way to you. Our driver will be there soon! 🍕🚗`
              : `Your order is ready and waiting for you! Come pick it up whenever you're ready. 🍕🎉`
            }</p>

            <div class="order-details">
                <h3>📋 Order Details</h3>
                <p><strong>Order ID:</strong> #${orderData.order_id}</p>
                <p><strong>Order Type:</strong> <span class="highlight">${order_type.charAt(0).toUpperCase() + order_type.slice(1)}</span></p>
                <p><strong>Payment Method:</strong> ${orderData.payment_type}</p>
                <p><strong>Order Time:</strong> ${new Date(orderData.created_at).toLocaleString()}</p>
                ${orderData.transaction_id ? `<p><strong>Transaction ID:</strong> ${orderData.transaction_id}</p>` : ''}
                ${orderData.change_due > 0 ? `<p><strong>Change Due:</strong> <span class="price">£${orderData.change_due.toFixed(2)}</span></p>` : ''}
            </div>

            ${order_type === "delivery" ? `
            <div class="order-details">
                <h3>📍 Delivery Address</h3>
                <p>${deliveryAddress}</p>
                <p><strong>Phone:</strong> ${orderData.phone_number}</p>
            </div>
            ` : ''}

            <div class="items-list">
                <h3>🍽️ Your Order</h3>
                ${orderData.items.map(item => `
                    <div style="border-bottom: 1px solid #eee; padding: 8px 0;">
                        <strong>${item.quantity}x ${item.item_name}</strong> - <span class="price">£${item.item_total_price}</span>
                        ${item.item_description ? `<br><small style="color: #666;">${item.item_description}</small>` : ''}
                    </div>
                `).join('')}
                <div style="padding: 10px 0; border-top: 2px solid #4CAF50; margin-top: 10px;">
                    <strong>Total: <span class="price">£${orderData.total_price}</span></strong>
                </div>
            </div>

            ${orderData.extra_notes ? `
            <div class="order-details">
                <h3>📝 Special Notes</h3>
                <p>${orderData.extra_notes}</p>
            </div>
            ` : ''}

            ${orderData.driver.name ? `
            <div class="driver-info">
                <h3>👨‍🚀 Your Driver</h3>
                <p><strong>Name:</strong> ${orderData.driver.name}</p>
                <p><strong>Phone:</strong> ${orderData.driver.phone}</p>
                <p><em>Feel free to contact your driver if needed!</em></p>
            </div>
            ` : ''}

            <p>Thank you for choosing us! We hope you enjoy your meal! 😊</p>
        </div>
        
        <div class="footer">
            <p>Questions? Contact us at ${process.env.EMAIL_USER}</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
          `;

          // Send detailed email
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: customer_email,
            subject: subject,
            html: emailBody,
          });

          console.log(`✅ Detailed order email sent to: ${customer_email} for Order #${order_id}`);
        } else {
          console.log(`⚠️ No email found for Order #${order_id}`);
        }
      }
    }

    res.status(200).json({ message: "Order status updated successfully" });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/add-item", async (req, res) => {
  try {
    const { order_id, item_id, quantity, description, total_price } = req.body;

    const clientId = req.headers["x-client-id"];
    if (!clientId) {
      return res.status(400).json({ error: "Missing client ID in headers" });
    }


    const newOrderItem = await pool.query(
      "INSERT INTO Order_Items (order_id, item_id, quantity, description, total_price,brand_name) VALUES ($1, $2, $3, $4, $5,$6) RETURNING *",
      [order_id, item_id, quantity, description, total_price, clientId]
    );

    res.status(201).json(newOrderItem.rows[0]);
  } catch (err) {
    console.error("Error inserting order item:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get("/today", async (req, res) => {

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

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
      WHERE DATE(o.created_at) = CURRENT_DATE AND o.brand_name=$1
      ORDER BY o.created_at DESC
      `, [clientId]
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
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

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
      change_due,
      discount,
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
        `INSERT INTO Guests (name, email, phone_number, street_address, city, county, postal_code,brand_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7,$8)
         RETURNING guest_id`,
        [
          guest.name,
          guest.email,
          guest.phone_number,
          guest.street_address,
          guest.city,
          guest.county,
          guest.postal_code,
          clientId
        ]
      );
      guest_id = guestResult.rows[0].guest_id;
    }

    // Step 2: Create order
    const orderResult = await client.query(
      `INSERT INTO Orders (user_id, guest_id, transaction_id, payment_type, order_type, total_price, extra_notes, status, order_source,change_due,brand_name,discount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12)
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
        change_due || 0,
        clientId, discount
      ]
    );
    const order_id = orderResult.rows[0].order_id;

    // Step 3: Batch insert items
    const insertValues = items
      .map(
        (item) =>
          `('${order_id}', '${item.item_id}', ${item.quantity}, '${item.description}', ${item.total_price}, '${clientId}')`
      )
      .join(",");

    await client.query(
      `INSERT INTO Order_Items (order_id, item_id, quantity, description, total_price, brand_name)
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

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

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
      WHERE REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g') = $1 AND brand_name=$2
      LIMIT 1
    `,
      [normalizedInput,clientId]
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
      WHERE REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g') = $1 AND brand_name=$2
      LIMIT 1
    `,
      [normalizedInput,clientId]
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

router.get("/details/:order_id", async (req, res) => {
  const { order_id } = req.params;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }


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
      WHERE o.order_id = $1
      AND o.brand_name=$2
      `,
      [order_id,clientId]
    );

    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Construct the order object
    const orderData = {
      order_id: rows[0].order_id,
      payment_type: rows[0].payment_type,
      transaction_id: rows[0].transaction_id,
      order_type: rows[0].order_type,
      total_price: rows[0].order_total_price,
      extra_notes: rows[0].order_extra_notes,
      status: rows[0].status,
      created_at: rows[0].created_at,
      change_due: rows[0].change_due,
      order_source: rows[0].order_source,
      driver_id: rows[0].driver_id,
      customer_name: rows[0].customer_name,
      customer_email: rows[0].customer_email,
      phone_number: rows[0].phone_number,
      street_address: rows[0].street_address,
      city: rows[0].city,
      county: rows[0].county,
      postal_code: rows[0].postal_code,
      items: [],
    };

    rows.forEach((row) => {
      orderData.items.push({
        item_name: row.item_name,
        item_type: row.item_type,
        quantity: row.quantity,
        item_description: row.item_description,
        item_total_price: row.item_total_price,
      });
    });

    res.status(200).json(orderData);
  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/track/:order_id", async (req, res) => {
  const { order_id } = req.params;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }


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

          -- Driver details
          d.id AS driver_id,
          d.name AS driver_name,
          d.phone_number AS driver_phone,
          d.email AS driver_email,
          d.is_active AS driver_is_active,

          -- Customer details
          COALESCE(u.name, g.name) AS customer_name,
          COALESCE(u.email, g.email) AS customer_email,
          COALESCE(u.phone_number, g.phone_number) AS phone_number,
          COALESCE(u.street_address, g.street_address) AS street_address,
          COALESCE(u.city, g.city) AS city,
          COALESCE(u.county, g.county) AS county,
          COALESCE(u.postal_code, g.postal_code) AS postal_code,

          -- Items
          i.item_name,
          i.type AS item_type,
          oi.quantity,
          oi.description AS item_description,
          oi.total_price AS item_total_price
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN Guests g ON o.guest_id = g.guest_id
      LEFT JOIN Drivers d ON o.driver_id = d.id
      JOIN Order_Items oi ON o.order_id = oi.order_id
      JOIN Items i ON oi.item_id = i.item_id
      WHERE COALESCE(u.phone_number, g.phone_number) = $1
  AND o.status != 'blue'
  AND DATE(o.created_at) = CURRENT_DATE;
  AND o.brand_name=$2
      `,
      [order_id,clientId]
    );

    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Build the response
    const orderData = {
      order_id: rows[0].order_id,
      payment_type: rows[0].payment_type,
      transaction_id: rows[0].transaction_id,
      order_type: rows[0].order_type,
      total_price: rows[0].order_total_price,
      extra_notes: rows[0].order_extra_notes,
      status: rows[0].status,
      created_at: rows[0].created_at,
      change_due: rows[0].change_due,
      order_source: rows[0].order_source,

      driver: rows[0].driver_id
        ? {
          driver_id: rows[0].driver_id,
          name: rows[0].driver_name,
          phone: rows[0].driver_phone,
          email: rows[0].driver_email,
          is_active: rows[0].driver_is_active,
        }
        : null,

      customer: {
        name: rows[0].customer_name,
        email: rows[0].customer_email,
        phone_number: rows[0].phone_number,
        street_address: rows[0].street_address,
        city: rows[0].city,
        county: rows[0].county,
        postal_code: rows[0].postal_code,
      },

      items: rows.map((row) => ({
        item_name: row.item_name,
        item_type: row.item_type,
        quantity: row.quantity,
        description: row.item_description,
        total_price: row.item_total_price,
      })),
    };

    res.status(200).json(orderData);
  } catch (error) {
    console.error("❌ Error tracking order:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add this new route to your existing orders router file
router.post("/cancel", async (req, res) => {
  const { order_id } = req.body;

  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID in headers" });
  }

  if (!order_id) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  try {
    // Fetch order + customer email
    const orderCheckResult = await pool.query(
      `
      SELECT 
        o.order_id,
        o.status,
        o.created_at,
        o.order_type,
        o.payment_type,
        o.total_price,
        o.extra_notes,
        o.order_source,
        o.transaction_id,
        o.change_due,
        COALESCE(u.email, g.email) AS customer_email,
        COALESCE(u.name, g.name) AS customer_name
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.user_id AND o.brand_name = u.brand_name
      LEFT JOIN Guests g ON o.guest_id = g.guest_id AND o.brand_name = g.brand_name
      WHERE o.order_id = $1 AND o.brand_name = $2
      `,
      [order_id, clientId]
    );

    if (orderCheckResult.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderCheckResult.rows[0];

    // Already cancelled?
    if (order.status === "cancelled") {
      return res.status(400).json({ error: "Order is already cancelled" });
    }

    // Completed orders cannot be cancelled
    if (order.status === "blue") {
      return res.status(400).json({ error: "Cannot cancel a completed order" });
    }

    // 10-minute window check
    const orderTime = new Date(order.created_at);
    const currentTime = new Date();
    const timeDifference = (currentTime - orderTime) / (1000 * 60);

    if (timeDifference > 10) {
      return res.status(400).json({
        error:
          "Cancellation period expired. Orders can only be cancelled within 10 minutes of placement.",
      });
    }

    // Cancel the order
    const updateResult = await pool.query(
      "UPDATE Orders SET status = 'cancelled' WHERE order_id = $1 AND brand_name=$2 RETURNING order_id, status",
      [order_id, clientId]
    );

    if (updateResult.rowCount === 0) {
      return res.status(500).json({ error: "Failed to cancel order" });
    }

    console.log(`✅ Order ${order_id} has been cancelled successfully`);

    // Send cancellation email (if customer has email)
    if (order.customer_email) {
      const subject = `❌ Your Order #${order_id} Has Been Cancelled`;
      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #c0392b; color: #fff; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .footer { background-color: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi ${order.customer_name || "Customer"},</p>
      <p>We wanted to let you know that your order <strong>#${order_id}</strong> has been successfully cancelled.</p>
      <p>If you didn’t request this cancellation or have any questions, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>Thank you for choosing us.</p>
      <p>— The ${clientId} Team</p>
    </div>
  </div>
</body>
</html>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.customer_email,
        subject: subject,
        html: emailBody,
      });

      console.log(`📧 Cancellation email sent to ${order.customer_email}`);
    }

    res.status(200).json({
      message: "Order cancelled successfully",
      order_id: order_id,
      status: "cancelled",
      email: order.customer_email || null,
    });
  } catch (error) {
    console.error("❌ Error cancelling order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;
