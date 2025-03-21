import pkg from "pg";
const { Pool } = pkg;

import dotenv from "dotenv";
dotenv.config();
console.log(process.env.DB_USER);
console.log(process.env.DB_PASSWORD);
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false, // Allow self-signed SSL
  },
});

pool
  .connect()
  .then(() => console.log("✅ Database connected successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err));

export default pool;
