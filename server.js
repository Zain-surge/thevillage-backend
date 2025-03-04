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

app.use((req, res, next) => {
  console.log("Incoming request - Session:", req.session);
  next();
});
app.use(cookieParser());

app.set("trust proxy", 1); // Critical for Cloudflare and Render

app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 1000 * 60 * 60, // Prune every hour
    }),
    name: "connect.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true, // Always true with HTTPS
      httpOnly: true,
      sameSite: "none", // Required for cross-site
      domain: process.env.COOKIE_DOMAIN || ".the-village-pizzeria.web.app",
    },
  })
);

// Middleware to handle Cloudflare session persistence
app.use((req, res, next) => {
  if (req.headers["cf-ray"]) {
    req.sessionOptions.cookie.domain = req.hostname;
  }
  next();
});
// Add a middleware to log and debug session
app.use((req, res, next) => {
  console.log("Detailed Session Debug:");
  console.log("Request Headers:", req.headers);
  console.log("Cookies Raw:", req.headers.cookie);
  console.log("Parsed Cookies:", req.cookies);
  console.log("Session ID:", req.sessionID);
  console.log("Session Object:", req.session);
  next();
});

app.use(express.json());

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
