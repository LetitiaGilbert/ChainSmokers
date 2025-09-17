import CollectionBatch from "../models/collectionBatch.js";
import ProcessingStep from "../models/processingStep.js";
import LabResult from "../models/LabResult.js";
import Joi from "joi";
import { generateBatchQR, getBatchUrl } from "../utils/qrGenerator.js";
import { v4 as uuidv4 } from 'uuid';

// Feedback schema
const feedbackSchema = Joi.object({
  batchId: Joi.string().required(),
  consumerId: Joi.string().required(),
  feedback: Joi.string().min(3).required(),
  rating: Joi.number().min(1).max(5).required()
});

// Get complete batch history
export const getBatchHistory = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const batch = await CollectionBatch.findOne({ batchId });
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });

    const labResults = await LabResult.find({ batchId });
    const steps = await ProcessingStep.find({ batchId });

    // Generate QR code with batch details
    const qrCode = await generateBatchQR(batchId, {
      herbType: batch.herbType,
      collectionDate: batch.collectionDate,
      farmerName: batch.farmerName,
      location: batch.location
    });

    return res.json({
      success: true,
      data: {
        batch,
        labResults,
        steps,
        qrCode,
        batchUrl: getBatchUrl(batchId)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Add consumer feedback
/**
 * Get batch details with QR code
 * @route GET /api/consumer/batch/:batchId/qr
 */
export const getBatchWithQR = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const batch = await CollectionBatch.findOne({ batchId });
    
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: "Batch not found" 
      });
    }

    const qrCode = await generateBatchQR(batchId, {
      herbType: batch.herbType,
      collectionDate: batch.collectionDate,
      farmerName: batch.farmerName,
      location: batch.location,
      quantity: batch.quantity,
      status: batch.status
    });

    return res.json({
      success: true,
      data: {
        batchId: batch.batchId,
        herbType: batch.herbType,
        collectionDate: batch.collectionDate,
        farmerName: batch.farmerName,
        location: batch.location,
        qrCode,
        batchUrl: getBatchUrl(batchId)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Add consumer feedback
export const addConsumerFeedback = async (req, res, next) => {
  try {
    const { error } = feedbackSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { batchId, consumerId, feedback, rating } = req.body;

    // In a real app, you would save this to a database
    // For now, we'll just return the feedback
    return res.json({
      success: true,
      message: "Feedback submitted successfully",
      data: {
        feedbackId: uuidv4(),
        batchId,
        consumerId,
        feedback,
        rating,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get batch data for frontend QR code generation
 * This endpoint returns the batch data that will be encoded in the QR code
 * The frontend can use this data to generate the QR code
 */
export const getBatchForQR = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const batch = await CollectionBatch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: "Batch not found" 
      });
    }

    // Prepare the data that will be encoded in the QR code
    const qrData = {
      batchId: batch.batchId,
      herbType: batch.herbType,
      collectionDate: batch.collectionDate,
      farmerName: batch.farmerName,
      location: batch.location,
      batchUrl: getBatchUrl(batch.batchId),
      timestamp: new Date().toISOString()
    };

    return res.json({
      success: true,
      data: qrData
    });
  } catch (err) {
    next(err);
  }
};
