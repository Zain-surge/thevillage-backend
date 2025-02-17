import express from "express";
import session from "express-session";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(cookieParser());
app.use(
  session({ secret: "secretkey", resave: false, saveUninitialized: false })
);

app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);

app.listen(5000, () => console.log("Server running on port 5000"));
