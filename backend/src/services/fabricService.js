import { Gateway, Wallets } from 'fabric-network';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FabricService {
  constructor() {
    this.channelName = 'mychannel';
    this.chaincodeName = 'traceability';
    this.gateway = null;
    this.contract = null;
  }

  async connect(userId = 'appUser', orgMSP = 'CollectorMSP') {
    try {
      // Load connection profile
      const ccpPath = path.resolve(__dirname, '..', '..', 'fabric-config', 'connection-profile.json');
      const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

      // Create wallet and get identity
      const walletPath = path.join(process.cwd(), 'wallet');
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      const identity = await wallet.get(userId);
      
      if (!identity) {
        throw new Error(`Identity ${userId} not found in wallet`);
      }

      // Connect to gateway
      this.gateway = new Gateway();
      await this.gateway.connect(ccp, {
        wallet,
        identity: userId,
        discovery: { enabled: true, asLocalhost: true }
      });

      // Get network and contract
      const network = await this.gateway.getNetwork(this.channelName);
      this.contract = network.getContract(this.chaincodeName);

      console.log('Connected to Fabric network');
    } catch (error) {
      console.error('Failed to connect to Fabric network:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.gateway) {
      await this.gateway.disconnect();
      this.gateway = null;
      this.contract = null;
    }
  }

  // Transform backend CollectionBatch to blockchain CollectionEvent
  transformToCollectionEvent(batch, collectorId) {
    return {
      resourceType: 'Observation',
      id: batch.batchId,
      status: 'final',
      subject: {
        reference: `Collector/${collectorId}`,
        display: batch.farmerName
      },
      effectiveDateTime: batch.timestamp,
      species: batch.herbType,
      collectorId: collectorId,
      zoneId: 'ZONE_001', // Default zone - should be configurable
      lat: 0, // Should come from GPS data
      lon: 0, // Should come from GPS data
      timestamp: batch.timestamp,
      valueQuantity: {
        value: batch.quantity,
        unit: 'kg'
      }
    };
  }

  // Transform backend ProcessingStep to blockchain ProcessingStep
  transformToProcessingStep(step) {
    return {
      resourceType: 'Procedure',
      id: step._id.toString(),
      status: 'completed',
      code: {
        coding: [{
          system: 'http://ayurveda.org/processing',
          code: step.step.toLowerCase().replace(/\s+/g, '_'),
          display: step.step
        }]
      },
      subject: {
        reference: `Batch/${step.batchId}`,
        display: `Processing of batch ${step.batchId}`
      },
      performer: [{
        actor: {
          reference: `Processor/${step.processorId}`,
          display: step.processorId
        }
      }],
      performedDateTime: step.createdAt || new Date().toISOString(),
      batchId: step.batchId,
      extension: step.environmentalMetrics ? [{
        url: 'http://ayurveda.org/environmental-metrics',
        valueString: JSON.stringify(step.environmentalMetrics)
      }] : undefined
    };
  }

  // Transform backend LabResult to blockchain QualityTest
  transformToQualityTest(labResult) {
    return {
      resourceType: 'Observation',
      id: labResult._id.toString(),
      batchId: labResult.batchId,
      status: 'final',
      code: {
        coding: [{
          system: 'http://ayurveda.org/quality-tests',
          code: labResult.testType,
          display: labResult.testType.charAt(0).toUpperCase() + labResult.testType.slice(1)
        }]
      },
      subject: {
        reference: `Batch/${labResult.batchId}`,
        display: `Quality test for batch ${labResult.batchId}`
      },
      performer: [{
        actor: {
          reference: `Lab/${labResult.labId}`,
          display: labResult.labId
        }
      }],
      effectiveDateTime: labResult.testDate.toISOString(),
      valueQuantity: labResult.metrics ? {
        value: labResult.metrics.value,
        unit: labResult.metrics.unit
      } : undefined,
      tests: {
        [labResult.testType]: labResult.metrics?.value
      },
      timestamp: labResult.testDate.toISOString(),
      labId: labResult.labId
    };
  }

  // Blockchain operations
  async createCollectionEvent(batch, collectorId) {
    if (!this.contract) await this.connect();
    
    const event = this.transformToCollectionEvent(batch, collectorId);
    const result = await this.contract.submitTransaction(
      'CreateCollectionEvent',
      JSON.stringify(event)
    );
    
    return result.toString();
  }

  async createBatch(batchId, species, collectionEventIds) {
    if (!this.contract) await this.connect();
    
    const result = await this.contract.submitTransaction(
      'CreateBatch',
      batchId,
      species,
      JSON.stringify(collectionEventIds)
    );
    
    return result.toString();
  }

  async addProcessingStep(step) {
    if (!this.contract) await this.connect();
    
    const blockchainStep = this.transformToProcessingStep(step);
    const result = await this.contract.submitTransaction(
      'CreateProcessingStep',
      JSON.stringify(blockchainStep)
    );
    
    return result.toString();
  }

  async addQualityTest(labResult) {
    if (!this.contract) await this.connect();
    
    const qualityTest = this.transformToQualityTest(labResult);
    const result = await this.contract.submitTransaction(
      'AddQualityTest',
      JSON.stringify(qualityTest)
    );
    
    return result.toString();
  }

  async getProvenance(batchId) {
    if (!this.contract) await this.contract();
    
    const result = await this.contract.evaluateTransaction(
      'GetProvenance',
      batchId
    );
    
    return JSON.parse(result.toString());
  }

  async transferBatch(batchId, toOrg) {
    if (!this.contract) await this.connect();
    
    const result = await this.contract.submitTransaction(
      'TransferBatch',
      batchId,
      toOrg
    );
    
    return result.toString();
  }

  async initiateRecall(batchId, reason) {
    if (!this.contract) await this.connect();
    
    const result = await this.contract.submitTransaction(
      'InitiateRecall',
      batchId,
      reason
    );
    
    return result.toString();
  }
}

// Export singleton instance
export default new FabricService();
