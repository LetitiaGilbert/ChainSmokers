import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import collectorRoutes from "./routes/collector.js";
import labRoutes from "./routes/lab.js";
import processorRoutes from "./routes/processor.js";
import consumerRoutes from "./routes/consumer.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/collector", collectorRoutes);
app.use("/lab", labRoutes);
app.use("/processor", processorRoutes);
app.use("/consumer", consumerRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

//connecting to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
