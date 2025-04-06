import express from "express";
import pool from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuItemsPath = path.join(__dirname, "../data/menuItems.json");

// Helper function to read menuItems.json
const readMenuItemsFile = () => {
  try {
    if (fs.existsSync(menuItemsPath)) {
      const data = fs.readFileSync(menuItemsPath, "utf8");
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error("Error reading menuItems.json:", err);
    return [];
  }
};

// Helper function to write to menuItems.json
const writeMenuItemsFile = (data) => {
  try {
    const dirPath = path.dirname(menuItemsPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(menuItemsPath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to menuItems.json:", err);
  }
};

router.get("/items", async (req, res) => {
  console.log("Fetching menu items...");

  // First, send data from local JSON file
  const cachedItems = readMenuItemsFile();

  // If we have cached items, send them immediately
  if (cachedItems.length > 0) {
    console.log("Sending cached menu items from JSON file");
    res.json(cachedItems);
  }

  // Then fetch fresh data from database
  try {
    const result = await pool.query(
      "SELECT * FROM Items WHERE availability = TRUE"
    );

    const items = result.rows.map((item) => ({
      id: item.item_id,
      title: item.item_name,
      description: item.description,
      price: item.price_options,
      Type: item.type,
      image: item.image_url,
      toppings: item.toppings,
      cheese: item.cheese,
      sauces: item.sauces,
      subType: item.subtype,
    }));

    console.log("Fetched fresh data from database");

    // Update the JSON file with the latest data
    writeMenuItemsFile(items);

    // If we didn't have cached items, send the database results
    if (cachedItems.length === 0) {
      console.log("Sending fresh menu items from database");
      res.json(items);
    }
  } catch (err) {
    console.error("Error fetching items from database:", err);

    // If there was an error but we already sent cached data, no need to send error
    if (cachedItems.length === 0) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

export default router;
