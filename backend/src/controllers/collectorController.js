import Joi from "joi";
import { v4 as uuidv4 } from "uuid";
import CollectionBatch from "../models/collectionBatch.js";
import fabricService from "../services/fabricService.js";


const batchSchema = Joi.object({
  farmerName: Joi.string().min(3).required(),
  location: Joi.string().required(),
  herbType: Joi.string().required(),
  quantity: Joi.number().positive().required(),
  
  // GPS coordinates (required for geo-tagging compliance)
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    altitude: Joi.number().optional(),
    accuracy: Joi.number().positive().optional()
  }).required(),
  
  // Zone ID for geo-fence validation
  zoneId: Joi.string().optional()
});

// Create a new batch
export const createBatch = async (req, res, next) => {
  try {
    const { error, value } = batchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const batchId = `BATCH-${uuidv4()}`;


    // Save in DB
    const batch = await CollectionBatch.create({
      batchId,
      ...value,
      status: "Collected",
      timestamp: new Date().toISOString()
    });

    // Commit to blockchain
    try {
      await fabricService.createCollectionEvent(batch, req.user?.identifier || 'unknown');
      console.log(`Collection event committed to blockchain for batch ${batchId}`);
    } catch (blockchainError) {
      console.error('Blockchain commit failed:', blockchainError);
    
    }
    
    return res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
};


// Get all batches
export const getBatches = async (req, res, next) => {
  try {
    const batches = await CollectionBatch.find();
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
};


// Get batch by ID
export const getBatchById = async (req, res, next) => {
  try {
    const batch = await CollectionBatch.findOne({ batchId: req.params.batchId });
    if (!batch) {
      return res.status(404).json({
         success: false, message: "Batch not found"
         });
    }
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
};
