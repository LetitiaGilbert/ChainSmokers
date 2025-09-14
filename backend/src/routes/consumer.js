import express from "express";
import { getBatchHistory, addConsumerFeedback } from "../controllers/consumerController.js";

const router = express.Router();


router.get("/history/:batchId", getBatchHistory);

router.post("/feedback", addConsumerFeedback);

export default router;
