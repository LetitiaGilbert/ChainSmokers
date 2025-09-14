import CollectionBatch from "../models/collectionBatch.js";
import ProcessingStep from "../models/processingStep.js";
import LabResult from "../models/LabResult.js"; // assuming you have this model
import Joi from "joi";

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

    return res.json({
      success: true,
      data: {
        batch,
        labResults,
        steps
      }
    });
  } catch (err) {
    next(err);
  }
};

// Add consumer feedback
export const addConsumerFeedback = async (req, res, next) => {
  try {
    const { error, value } = feedbackSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    // For simplicity, storing feedback in the batch itself
    const batch = await CollectionBatch.findOneAndUpdate(
      { batchId: value.batchId },
      { $push: { consumerFeedback: value } },
      { new: true }
    );

    return res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
};
