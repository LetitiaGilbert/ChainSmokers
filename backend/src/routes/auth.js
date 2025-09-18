import express from "express";
import { register, login } from "../controllers/authController.js";
import { requestOTP, verifyOTPLogin } from "../controllers/otpController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// OTP routes for farmers
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTPLogin);

export default router;