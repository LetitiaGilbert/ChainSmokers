import express from "express";
import { addProcessingStep, getProcessingSteps } from "../controllers/processorController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();


router.post("/step", authMiddleware(["processor"]), addProcessingStep);


router.get("/steps/:batchId", authMiddleware(["processor"]), getProcessingSteps);

export default router;
