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

    req.session.user = { id: user.user_id, email: user.email };
    console.log("Session After Login:", req.session); // Debug log
    res.status(200).json({
      success: true,
      message: "Login successful",
      user: req.session.user,
      userDetails: user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user) {
      console.error("Login Failed: User not found", { email });
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error("Login Failed: Invalid credentials", { email });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Explicitly set and save user data
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session Regeneration Error:", err);
        return res.status(500).json({ message: "Session creation failed" });
      }

      req.session.user = {
        id: user.user_id,
        email: user.email,
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session Save Error:", saveErr);
          return res.status(500).json({ message: "Session save failed" });
        }

        console.log("Login Success - Session Details:", {
          sessionID: req.sessionID,
          user: req.session.user,
          fullSession: JSON.stringify(req.session, null, 2),
        });

        res.status(200).json({
          success: true,
          message: "Login successful",
          user: req.session.user,
          sessionId: req.sessionID,
        });
      });
    });
  } catch (error) {
    console.error("Login Process Error:", error);
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
  console.log("Comprehensive Session Check:", {
    sessionID: req.sessionID,
    sessionExists: !!req.session,
    sessionUser: req.session?.user,
    fullSessionDetails: JSON.stringify(req.session, null, 2),
    cookieDetails: JSON.stringify(req.session?.cookie, null, 2),
  });

  if (req.session && req.session.user) {
    return res.status(200).json({
      user: req.session.user,
      isAuthenticated: true,
      sessionID: req.sessionID,
    });
  } else {
    console.warn("Session Check Failed - No Active Session");
    return res.status(401).json({
      message: "Not authenticated",
      isAuthenticated: false,
    });
  }
};
