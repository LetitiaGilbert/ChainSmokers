import mongoose from "mongoose";

const CollectionBatchSchema = new mongoose.Schema({
  batchId: String,
  farmerName: String,
  location: String,
  herbType: String,
  quantity: Number,
  status: String,
  timestamp: String,
  consumerFeedback: [{
    consumerId: String,
    feedback: String,
    rating: Number,
    timestamp: { type: Date, default: Date.now }
  }]
});

export default mongoose.model("CollectionBatch", CollectionBatchSchema);
