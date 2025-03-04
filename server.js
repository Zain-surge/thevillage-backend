import express from "express";
import session from "express-session";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import paymentRoutes from "./routes/paymentRoutes.js";
import items from "./routes/items.js";
import cart from "./routes/cartRoutes.js";
import users from "./routes/userRoutes.js";
import orders from "./routes/orderRoutes.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "https://the-village-pizzeria.web.app", // Remove trailing slash
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // If using cookies or authorization headers
  })
);

// Handle preflight requests properly
app.options("*", cors());
app.use(cookieParser());
app.use(
  session({ secret: "secretkey", resave: false, saveUninitialized: false })
);

app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/item", items);
app.use("/cart", cart);
app.use("/users", users);
app.use("/orders", orders);

app.listen(5000, () => console.log("Server running on port 5000"));
