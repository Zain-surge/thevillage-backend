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
import http from "http";
import { Server } from "socket.io";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import items from "./routes/items.js";
import offers from "./routes/admin.js";
import cart from "./routes/cartRoutes.js";
import users from "./routes/userRoutes.js";
import orders from "./routes/orderRoutes.js";

dotenv.config();
const app = express();
const server = http.createServer(app); // Wrap Express in HTTP server
const io = new Server(server, {
  cors: {
    origin: ["https://the-village-pizzeria.web.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Create a separate client for LISTEN
const notifyClient = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

notifyClient
  .connect()
  .then(() => {
    console.log("📡 Listening for new orders...");
    notifyClient.query("LISTEN new_order_channel");
  })
  .catch((err) => console.error("❌ Listener DB connection error:", err));

notifyClient.on("notification", async (msg) => {
  const orderId = msg.payload;
  console.log("📬 New Order Notification:", orderId);
  const orderDetails = await fetchOrderDetails(orderId);
  if (orderDetails) {
    io.emit("new_order", orderDetails); // 🚀 Emit to all connected clients
  }
});
async function fetchOrderDetails(orderId) {
  try {
    const client = await pool.connect();

    const orderQuery = `
      SELECT 
        o.order_id, o.payment_type, o.order_type, o.total_price, o.extra_notes, 
        COALESCE(u.name, g.name) AS customer_name, 
        COALESCE(u.email, g.email) AS customer_email, 
        COALESCE(u.phone_number, g.phone_number) AS customer_phone,
        COALESCE(u.street_address, g.street_address) AS customer_address, 
        COALESCE(u.city, g.city) AS customer_city, 
        COALESCE(u.county, g.county) AS customer_county, 
        COALESCE(u.postal_code, g.postal_code) AS customer_postal_code
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN Guests g ON o.guest_id = g.guest_id
      WHERE o.order_id = $1;
    `;

    const itemsQuery = `
      SELECT 
        oi.quantity, i.item_name, oi.total_price, oi.description
      FROM Order_Items oi
      JOIN Items i ON oi.item_id = i.item_id
      WHERE oi.order_id = $1;
    `;

    const orderRes = await client.query(orderQuery, [orderId]);
    if (orderRes.rows.length === 0) {
      client.release();
      return null;
    }

    const order = orderRes.rows[0];
    const itemsRes = await client.query(itemsQuery, [orderId]);
    order.items = itemsRes.rows;

    client.release();
    return order;
  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    return null;
  }
}

// // Add a middleware to log and debug session
// app.use((req, res, next) => {
//   console.log("Detailed Session Debug:");
//   console.log("Request Headers:", req.headers);
//   console.log("Cookies Raw:", req.headers.cookie);
//   console.log("Parsed Cookies:", req.cookies);
//   console.log("Session ID:", req.sessionID);
//   console.log("Session Object:", req.session);
//   next();
// });

// Routes
app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/item", items);
console.log("I AM HERE");
app.use("/admin", offers);
app.use("/cart", cart);
app.use("/users", users);
app.use("/orders", orders);

app.listen(5000, () => console.log("Server running on port 5000"));
server.listen(5000, () => console.log("Server running on port 5000"));
