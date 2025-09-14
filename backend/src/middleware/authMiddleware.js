import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "Ayurveda";


export const authMiddleware = (roles = []) => (req, res, next) => {

  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ success: false, message: "No token" });

  const token = header.split(" ")[1];
  try {

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};
