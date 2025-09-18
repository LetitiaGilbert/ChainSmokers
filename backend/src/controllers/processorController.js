import Joi from "joi";
import ProcessingStep from "../models/processingStep.js";
//import { commitToBlockchain } from "../services/fabricService.js";

// Validation 
const stepSchema = Joi.object({
  batchId: Joi.string().required(),
  step: Joi.string().required(),
  environmentalMetrics: Joi.object({
    temperature: Joi.number().required(),
    humidity: Joi.number().required()
  })
});

const correctionSchema = Joi.object({
  originalStepId: Joi.string().required(),
  batchId: Joi.string().required(),
  step: Joi.string().required(),
  environmentalMetrics: Joi.object({
    temperature: Joi.number().required(),
    humidity: Joi.number().required()
  })
});

export const addProcessingStep = async (req, res, next) => {
  try {
    const { error, value } = stepSchema.validate(req.body);

    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    // Store in DB with processorId from JWT token
    const processingStep = await ProcessingStep.create({
      ...value,
      processorId: req.user.identifier // Username or decrypted phone from JWT
    });

    // BlockChain Stuff
    //const txId = await commitToBlockchain("ProcessingStep", processingStep);
    //processingStep.blockchainTxId = txId;
    //await processingStep.save(); 

    return res.status(201).json({ success: true, data: processingStep });
  } catch (err) {
    next(err);
  }
};

// Correction endpoint
export const correctProcessingStep = async (req, res, next) => {
  try {
    const { error, value } = correctionSchema.validate(req.body);

    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const originalStep = await ProcessingStep.findById(value.originalStepId);
    if (!originalStep) {
      return res.status(404).json({ success: false, message: "Original step not found" });
    }

    const correctionStep = await ProcessingStep.create({
      ...value,
      processorId: req.user.identifier, // Username or decrypted phone from JWT
      correctionOf: value.originalStepId,
      stepType: "correction",
      timestamp: new Date().toISOString()
    });

    // BlockChain Stuff
    //const txId = await commitToBlockchain("CorrectionStep", correctionStep);
    //correctionStep.blockchainTxId = txId;
    //await correctionStep.save();

    return res.status(201).json({ success: true, data: correctionStep });
  } catch (err) {
    next(err);
  }
};

// Get all steps for a batch
export const getProcessingSteps = async (req, res, next) => {
  try {
    const steps = await ProcessingStep.find({ batchId: req.params.batchId });

    res.json({ success: true, data: steps });

  } catch (err) {
    next(err);
  }
};
