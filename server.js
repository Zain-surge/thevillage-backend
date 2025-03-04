import express from "express";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import items from "./routes/items.js";
import cart from "./routes/cartRoutes.js";
import users from "./routes/userRoutes.js";
import orders from "./routes/orderRoutes.js";

dotenv.config();
const app = express();

// ✅ Proper CORS Configuration
app.use(
  cors({
    origin: "https://the-village-pizzeria.web.app", // Allow frontend domain
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // Allow cookies & sessions
  })
);

// ✅ Handle preflight requests correctly
app.options("*", cors());

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cookieSession({
    name: "session",
    keys: ["supersecretkey"], // Encryption key
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true, // Set to true in production (must be HTTPS)
    httpOnly: true, // Prevent JavaScript access
    sameSite: "none", // Allow cross-origin cookies
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

// ✅ Define Routes AFTER Middleware
app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/item", items);
app.use("/cart", cart);
app.use("/users", users);
app.use("/orders", orders);

// Start Server
app.listen(5000, () => console.log("Server running on port 5000"));
