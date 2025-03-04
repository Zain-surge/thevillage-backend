import express from "express";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pool from "./config/db.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import items from "./routes/items.js";
import cart from "./routes/cartRoutes.js";
import users from "./routes/userRoutes.js";
import orders from "./routes/orderRoutes.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(cookieParser());

// ✅ Fix CORS configuration
app.use(
  cors({
    origin: "https://the-village-pizzeria.web.app",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ✅ Ensure preflight requests (OPTIONS) are handled correctly
app.options("*", cors());

// Configure PostgreSQL session store
const pgSessionStore = pgSession(session);
const sessionStore = new pgSessionStore({
  pool: pool, // Reuse the existing database pool
  tableName: "user_sessions", // Customize the table name if needed
});

// Session middleware with PostgreSQL store
app.use(
  session({
    store: sessionStore,
    secret: "supersecretkey", // Use environment variable
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Secure in production
      httpOnly: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// ✅ Debugging: Log headers to check if CORS is applied
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://the-village-pizzeria.web.app"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/item", items);
app.use("/cart", cart);
app.use("/users", users);
app.use("/orders", orders);

app.listen(5000, () => console.log("Server running on port 5000"));
