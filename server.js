import express from "express";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

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

// ✅ Allow All Origins (TEMPORARY - Use for debugging only)
app.use(
  cors({
    origin: "*", // ⚠️ This allows ALL origins (not recommended for production)
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization",
  })
);

// ✅ Handle preflight requests
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

// ✅ Cookie-based Sessions (Modify if needed)
app.use(
  cookieSession({
    name: "session",
    keys: ["supersecretkey"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: "production", // Must be true for HTTPS
    httpOnly: true,
    sameSite: "lax", // Change to "none" if using cross-origin requests
  })
);

// ✅ Debugging: Log headers to check CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

// Start Server
app.listen(5000, () => console.log("Server running on port 5000"));
