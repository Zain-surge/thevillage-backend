import pool from "../config/db.js";

export const getUserByEmail = async (email) => {
  const { rows } = await pool.query("SELECT * FROM Users WHERE email = $1", [
    email,
  ]);
  return rows[0];
};

export const createUser = async (user) => {
  debugger;
  const {
    name,
    email,
    hashedPassword,
    phone_number,
    street_address,
    city,
    county,
    postal_code,
  } = user;
  const { rows } = await pool.query(
    `INSERT INTO Users (name, email, password, phone_number, street_address, city, county, postal_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      name,
      email,
      hashedPassword,
      phone_number,
      street_address,
      city,
      county,
      postal_code,
    ]
  );
  return rows[0];
};
