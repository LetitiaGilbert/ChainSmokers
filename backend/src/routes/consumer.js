import express from "express";
import { 
  getBatchHistory, 
  addConsumerFeedback, 
  getBatchWithQR,
  getBatchForQR 
} from "../controllers/consumerController.js";

const router = express.Router();


// Get batch details with history
router.get("/history/:batchId", getBatchHistory);

// Get batch details with QR code (backend-generated)
router.get("/batch/:batchId/qr", getBatchWithQR);

// Get batch data for frontend QR code generation
router.get("/batch/:batchId/qr-data", getBatchForQR);

// Add consumer feedback
router.post("/feedback", addConsumerFeedback);

export default router;
