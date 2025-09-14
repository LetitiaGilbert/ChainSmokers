import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "Ayurveda";   

// register
export const register = async (req, res, next) => {
  try {
    const { username, phoneNumber, password, role } = req.body;

    // Validation based on role
    if (role === 'farmer' && !phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required for farmers" });
    }
    if (role !== 'farmer' && (!username || !password)) {
      return res.status(400).json({ success: false, message: "Username and password are required for non-farmers" });
    }

    const userData = { role };
    
    if (role === 'farmer') {
      userData.phoneNumber = phoneNumber;
      // No password needed for farmers - they use OTP
    } else {
      const hashed = await bcrypt.hash(password, 10);
      userData.username = username;
      userData.password = hashed;
    }

    const user = await User.create(userData);

    const responseData = { role: user.role };
    if (user.username) responseData.username = user.username;
    if (user.phoneNumber) responseData.phoneNumber = user.phoneNumber;

    res.status(201).json({ success: true, data: responseData });

  } catch (err) {
    next(err);
  }
};

// login (for non-farmers only - farmers use OTP)
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ 
      id: user._id, 
      role: user.role,
      identifier: user.username
    }, JWT_SECRET, { expiresIn: "1d" });

    res.json({ success: true, token });
  } catch (err) {
    next(err);
  }
};
