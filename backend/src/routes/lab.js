import express from "express";
import { addLabResult, getLabResults } from "../controllers/labController.js";

const router = express.Router();

// Add a new lab test result
router.post("/result", addLabResult);

// Get all lab results for a batch
router.get("/results/:batchId", getLabResults);

export default router;
