import mongoose from "mongoose";

const labResultSchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  labId: { type: String, required: true },
  testType: { 
    type: String, 
    enum: ["moisture", "pesticide", "DNA", "purity", "contamination"],
    required: true 
  },
  result: { 
    type: String, 
    enum: ["Pass", "Fail", "Pending"],
    required: true 
  },
  metrics: {
    value: { type: Number },
    unit: { type: String },
    threshold: { type: Number }
  },
  testDate: { type: Date, default: Date.now },
  blockchainTxId: { type: String }
}, { timestamps: true });

export default mongoose.model("LabResult", labResultSchema);
