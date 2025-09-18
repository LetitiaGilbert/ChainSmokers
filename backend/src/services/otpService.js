import NodeCache from 'node-cache';
import twilio from 'twilio';

// Cache for storing OTPs (expires in 5 minutes)
const otpCache = new NodeCache({ stdTTL: 300 });

// Twilio client (optional - for production SMS)
const twilioClient = process.env.TWILIO_ACCOUNT_SID ? 
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

// Generate 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP in cache
export const storeOTP = (phoneNumber, otp) => {
  const key = `otp_${phoneNumber}`;
  otpCache.set(key, otp);
  console.log(`OTP for ${phoneNumber}: ${otp}`); // For development - remove in production
};

// Verify OTP
export const verifyOTP = (phoneNumber, providedOTP) => {
  const key = `otp_${phoneNumber}`;
  const storedOTP = otpCache.get(key);
  
  if (!storedOTP) {
    return { valid: false, message: "OTP expired or not found" };
  }
  
  if (storedOTP === providedOTP) {
    otpCache.del(key); // Remove OTP after successful verification
    return { valid: true, message: "OTP verified successfully" };
  }
  
  return { valid: false, message: "Invalid OTP" };
};

// Send OTP via SMS (production)
export const sendOTPSMS = async (phoneNumber, otp) => {
  if (!twilioClient) {
    console.log(`SMS Service not configured. OTP for ${phoneNumber}: ${otp}`);
    return { success: true, message: "OTP logged (development mode)" };
  }
  
  try {
    await twilioClient.messages.create({
      body: `Your Ayurveda Traceability OTP is: ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { success: false, message: "Failed to send OTP" };
  }
};

// Rate limiting - prevent spam
const rateLimitCache = new NodeCache({ stdTTL: 60 }); // 1 minute cooldown

export const checkRateLimit = (phoneNumber) => {
  const key = `rate_${phoneNumber}`;
  const lastSent = rateLimitCache.get(key);
  
  if (lastSent) {
    return { allowed: false, message: "Please wait before requesting another OTP" };
  }
  
  rateLimitCache.set(key, Date.now());
  return { allowed: true };
};
