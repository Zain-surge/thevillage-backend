import pool from "../config/db.js";

export const getUserByEmail = async (email,clientId) => {
  const { rows } = await pool.query("SELECT * FROM Users WHERE email = $1 AND brand_name= $2", [
    email,clientId
  ]);
  return rows[0];
};
export const createUser = async (user) => {
  const {
    name,
    email,
    hashedPassword,
    phone_number,
    street_address,
    city,
    county,
    postal_code,
    client_id, // 👈 include client_id
  } = user;

  const { rows } = await pool.query(
    `INSERT INTO Users 
      (name, email, password, phone_number, street_address, city, county, postal_code, brand_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
     RETURNING *`,
    [
      name,
      email,
      hashedPassword,
      phone_number,
      street_address,
      city,
      county,
      postal_code,
      client_id, // 👈 pass it in
    ]
  );

  return rows[0];
};

