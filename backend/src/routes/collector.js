import express from "express";
import { createBatch } from "../controllers/collectorController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();


router.post("/create", authMiddleware(["farmer"]), createBatch);

export default router;
