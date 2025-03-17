import express from "express";
import {
  signUp,
  verifyOtp,
  login,
  logout,
  checkSession,
  adminLogin,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signUp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/admin-login", adminLogin);
router.post("/logout", logout);
router.get("/check-session", checkSession);

export default router;
