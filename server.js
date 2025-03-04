import express from "express";
import session from "express-session";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import pgSession from "connect-pg-simple";
import pool from "./config/db.js"; // Adjust the path to your pool file

// Import routes
import authRoutes from "./routes/authRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import items from "./routes/items.js";
import cart from "./routes/cartRoutes.js";
import users from "./routes/userRoutes.js";
import orders from "./routes/orderRoutes.js";

dotenv.config();
const app = express();
const PgSession = pgSession(session);

app.use(
  session({
    store: new PgSession({
      pool: pool, // Use your existing PostgreSQL pool
      tableName: "user_sessions", // Default table name
    }),
    secret: process.env.SESSION_SECRET, // Ensure you set this in your environment variables
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === "production", // Set to true in production
      httpOnly: true,
      sameSite: "none", // Adjust based on your requirements
    },
  })
);

app.use(express.json());
app.use(cookieParser());

// app.use(
//   cookieSession({
//     name: "session",
//     keys: ["supersecretkey"], // Secret key for signing the cookie
//     maxAge: 1000 * 60 * 60 * 24, // 24 hours
//     secure: true, // Secure cookies only in production
//     httpOnly: true, // Prevents JavaScript access
//     sameSite: "none", // Allows cross-origin authentication
//   })
// );

app.use(
  cors({
    origin: "https://the-village-pizzeria.web.app",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // Allows cookies to be sent across origins
  })
);

// Routes
app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/item", items);
app.use("/cart", cart);
app.use("/users", users);
app.use("/orders", orders);

app.listen(5000, () => console.log("Server running on port 5000"));
