import mongoose from "mongoose";

const processingStepSchema = new mongoose.Schema({

  batchId: { type: String, required: true },
  processorId: { type: String, required: true },
  step: { type: String, required: true },
  environmentalMetrics: {
    temperature: Number,
    humidity: Number
  },
  
  blockchainTxId: { type: String }
});

export default mongoose.model("ProcessingStep", processingStepSchema);
