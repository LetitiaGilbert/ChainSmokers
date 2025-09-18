import mongoose from "mongoose";

const CollectionBatchSchema = new mongoose.Schema({
  batchId: String,
  farmerName: String,
  location: String,
  herbType: String,
  quantity: Number,
  status: String,
  timestamp: String,
  
  // GPS coordinates for geo-tagging (required for compliance)
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    altitude: { type: Number }, // optional
    accuracy: { type: Number }, // GPS accuracy in meters
    timestamp: { type: Date, default: Date.now }
  },
  
  // Zone information for geo-fencing
  zoneId: { type: String }, // for blockchain geo-fence validation
  
  consumerFeedback: [{
    consumerId: String,
    feedback: String,
    rating: Number,
    timestamp: { type: Date, default: Date.now }
  }]
});

export default mongoose.model("CollectionBatch", CollectionBatchSchema);
