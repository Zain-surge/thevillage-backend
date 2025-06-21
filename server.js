import express from "express";
import session from "express-session";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import pgSession from "connect-pg-simple";
import pool from "./config/db.js"; // Adjust the path to your pool file
import pkg from "pg";
const { Client } = pkg;
import WebSocket, { WebSocketServer } from "ws";
import http from "http"; // ✅ Required to share server

// Import routes
import authRoutes from "./routes/authRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import items from "./routes/items.js";
import offers from "./routes/admin.js";
import cart from "./routes/cartRoutes.js";
import users from "./routes/userRoutes.js";
import orders from "./routes/orderRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";

dotenv.config();
const app = express();

const PgSession = pgSession(session);

app.use(express.json());

app.use(
  cors({
    origin: ["https://the-village-pizzeria.web.app", "http://localhost:3000"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // Allows cookies to be sent across origins
  })
);

app.use(cookieParser());

app.set("trust proxy", 1); // Important for secure cookies in cloud/proxy environments

app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    name: "connect.sid", // Explicitly set cookie name
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: true, // Ensure this is true for HTTPS
      sameSite: "none", // Crucial for cross-origin
      domain: undefined, // Use the top-level domain
    },
  })
);

// ✅ Create shared HTTP server for Express + WebSocket
// const server = http.createServer(app);
// const wss = new WebSocket.Server({ server }); // ✅ Attach WebSocket to HTTP

// let clients = [];

// wss.on("connection", (ws) => {
//   console.log("✅ Frontend connected to WebSocket");
//   clients.push(ws);

//   ws.on("close", () => {
//     console.log("⚠️ Frontend disconnected from WebSocket");
//     clients = clients.filter((client) => client !== ws);
//   });
// });

// PostgreSQL connection
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

client
  .connect()
  .then(() => {
    console.log("✅ Connected to PostgreSQL database successfully");
  })
  .catch((err) => {
    console.error("❌ Error connecting to PostgreSQL:", err);
  });

client.query("LISTEN new_order_channel", (err) => {
  if (err) {
    console.error("❌ Error listening to new_order_channel:", err);
  } else {
    console.log("✅ Listening to PostgreSQL channel: new_order_channel");
  }
});

client.on("notification", async (msg) => {
  console.log("🔔 New order notification received:", msg.payload);
  const orderDetails = await getOrderDetails(msg.payload);

  if (!orderDetails) {
    console.warn("⚠️ No order details found for order ID:", msg.payload);
    return;
  }

  console.log("📦 Broadcasting order details to clients:", orderDetails);

  // clients.forEach((ws) => {
  //   ws.send(JSON.stringify(orderDetails));
  // });
});

async function getOrderDetails(orderId) {
  try {
    console.log(`🔍 Fetching details for order ID: ${orderId}`);

    const orderQuery = `
      SELECT 
        o.order_id, o.payment_type, o.order_type, o.total_price, o.extra_notes,
        COALESCE(u.name, g.name) AS customer_name,
        COALESCE(u.phone_number, g.phone_number) AS customer_phone
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN Guests g ON o.guest_id = g.guest_id
      WHERE o.order_id = $1;
    `;

    const itemsQuery = `
      SELECT oi.quantity, i.item_name, oi.total_price, oi.description
      FROM Order_Items oi
      JOIN Items i ON oi.item_id = i.item_id
      WHERE oi.order_id = $1;
    `;

    const orderRes = await client.query(orderQuery, [orderId]);
    console.log("📝 Order query result:", orderRes.rows);

    if (orderRes.rows.length === 0) return null;

    const itemsRes = await client.query(itemsQuery, [orderId]);
    console.log("🧾 Items query result:", itemsRes.rows);

    const orderDetails = orderRes.rows[0];
    orderDetails.items = itemsRes.rows;

    return orderDetails;
  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    return null;
  }
}

// Routes
app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/item", items);
console.log("I AM HERE");
app.use("/admin", offers);
app.use("/cart", cart);
app.use("/users", users);
app.use("/orders", orders);
app.use("/contact", contactRoutes);

// ✅ Health check for Render
app.get("/health", (req, res) => res.send("Server is healthy! ✅"));

// ✅ Start combined HTTP/WebSocket server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
