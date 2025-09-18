import Joi from "joi";
import LabResult from "../models/LabResult.js";
// import { commitToBlockchain } from "../services/fabricService.js";

// Validation schema
const labSchema = Joi.object({
  batchId: Joi.string().required(),
  labId: Joi.string().required(),
  testType: Joi.string().valid("moisture", "pesticide", "DNA", "purity", "contamination").required(),
  result: Joi.string().valid("Pass", "Fail", "Pending").required(),
  metrics: Joi.object({
    value: Joi.number().optional(),
    unit: Joi.string().optional(),
    threshold: Joi.number().optional()
  }).optional()
});

// Add a new lab test result
export const addLabResult = async (req, res, next) => {
  try {
    const { error, value } = labSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    // Save in DB
    const labResult = await LabResult.create(value);

    // Blockchain Stuff
    // const txId = await commitToBlockchain("LabResult", labResult);
    // labResult.blockchainTxId = txId;
    // await labResult.save();

    return res.status(201).json({ success: true, data: labResult });
  } catch (err) {
    next(err);
  }
};

// Get all lab results
export const getLabResults = async (req, res, next) => {
  try {
    const results = await LabResult.find({ batchId: req.params.batchId });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};
