import { generateOTP, storeOTP, verifyOTP, sendOTPSMS, checkRateLimit } from "../services/otpService.js";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";

// Request OTP for farmer login
export const requestOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    // Check rate limiting
    const rateCheck = checkRateLimit(phoneNumber);
    if (!rateCheck.allowed) {
      return res.status(429).json({ success: false, message: rateCheck.message });
    }

    // Check if farmer exists
    const user = await User.findOne({ phoneNumber, role: 'farmer' });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(phoneNumber, otp);

    // Send OTP via SMS
    const smsResult = await sendOTPSMS(phoneNumber, otp);
    
    if (smsResult.success) {
      res.json({ 
        success: true, 
        message: "OTP sent successfully",
        // In development, include OTP in response
        ...(process.env.NODE_ENV === 'development' && { otp })
      });
    } else {
      res.status(500).json({ success: false, message: smsResult.message });
    }

  } catch (err) {
    next(err);
  }
};

// Verify OTP and login farmer
export const verifyOTPLogin = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    if (!phoneNumber || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Phone number and OTP are required" 
      });
    }

    // Verify OTP
    const otpResult = verifyOTP(phoneNumber, otp);
    if (!otpResult.valid) {
      return res.status(400).json({ success: false, message: otpResult.message });
    }

    // Find farmer
    const user = await User.findOne({ phoneNumber, role: 'farmer' });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || "Ayurveda";
    
    const token = jwt.sign({ 
      id: user._id, 
      role: user.role,
      identifier: phoneNumber
    }, JWT_SECRET, { expiresIn: "1d" });

    res.json({ 
      success: true, 
      message: "Login successful",
      token 
    });

  } catch (err) {
    next(err);
  }
};
