import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pool from "./config/db.js";

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

// Detailed CORS configuration
const corsOptions = {
  origin: ["https://the-village-pizzeria.web.app", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Configure PostgreSQL session store
const pgSessionStore = pgSession(session);
const sessionStore = new pgSessionStore({
  pool: pool,
  tableName: "user_sessions",
  createTableIfMissing: true,
});

// Session middleware with extensive logging
app.use(
  session({
    store: sessionStore,
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
    },
  })
);

// Comprehensive debugging middleware
app.use((req, res, next) => {
  console.log("Session Debug Middleware:", {
    sessionID: req.sessionID,
    sessionExists: !!req.session,
    sessionUser: req.session?.user,
    fullSessionDetails: JSON.stringify(req.session, null, 2),
  });

  // Additional logging to track session creation and retrieval
  if (req.session) {
    console.log("Session Store Details:", {
      storeType: sessionStore.constructor.name,
      sessionStoreConfig: JSON.stringify(sessionStore.options, null, 2),
    });
  }

  next();
});

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
