import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import { getUserByEmail, createUser } from "../models/userModel.js";

const otps = {}; // Temporary storage for OTPs

export const signUp = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone_number,
      street_address,
      city,
      county,
      postal_code,
    } = req.body;
    console.log("HELLWO I AM SIGN UP");

    const existingUser = await getUserByEmail(email);
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    // Generate OTP and send email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps[email] = otp;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Email",
      text: `Your OTP is ${otp}`,
    });

    res.status(200).json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyOtp = async (req, res) => {
  console.log(req.body);
  const { data, otp } = req.body;
  const { email } = data; // Extract email from `data`
  if (otps[email] === otp) {
    delete otps[email];

    console.log(req.body);
    const hashedPassword = await bcrypt.hash(req.body.data.password, 10);
    const newUser = await createUser({ ...req.body.data, hashedPassword });

    req.session.user = { id: newUser.user_id, email: newUser.email };
    res.status(201).json({ success: true, message: "Account created" });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    // Regenerate session
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Session error" });
        }

        // Set user in session
        req.session.user = { id: user.user_id, email: user.email };

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Session save error" });
          }
          console.log("SAVINGGGG COOKIIESSSS");

          // Explicitly set cookie
          res.cookie("connect.sid", req.sessionID, {
            domain: ".the-village-pizzeria.web.app",
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 24 * 60 * 60 * 1000,
          });

          res.status(200).json({
            success: true,
            message: "Login successful",
            user: req.session.user,
            sessionId: req.sessionID,
          });
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });

      res.clearCookie("connect.sid"); // Clears session cookie
      return res.status(200).json({ success: true, message: "Logged out" });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const checkSession = (req, res) => {
  console.log("HELLO", req.session);
  if (req.session.user) {
    return res.json({ user: req.session.user });
  } else {
    console.log("NOT LOGGED IN");
    return res.status(401).json({ message: "Not logged in" });
  }
};
