import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import collectorRoutes from "./routes/collector.js";
import labRoutes from "./routes/lab.js";
import processorRoutes from "./routes/processor.js";
import consumerRoutes from "./routes/consumer.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/collector", collectorRoutes);
app.use("/lab", labRoutes);
app.use("/processor", processorRoutes);
app.use("/consumer", consumerRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
