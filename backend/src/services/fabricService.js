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
    this.connected = false;
  }

  async connect(userId = 'appUser', orgMSP = 'CollectorMSP') {
    try {
      const ccpPath = path.join(
        process.cwd(),
        'fabric-config',
        'connection-profile.json'
      );
      
      // Check if connection profile exists
      if (!fs.existsSync(ccpPath)) {
        console.warn('Fabric connection profile not found. Running in development mode without blockchain.');
        this.connected = false;
        return;
      }
      
      const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
      
      // Create a new file system based wallet for managing identities.
      const walletPath = path.join(process.cwd(), 'fabric-config', 'wallet');
      
      // Ensure wallet directory exists
      if (!fs.existsSync(walletPath)) {
        fs.mkdirSync(walletPath, { recursive: true });
        console.warn('Created new wallet directory. Please add Fabric identities.');
      }
      
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      
      console.log(`Wallet path: ${walletPath}`);
      console.log('Successfully loaded connection profile');
      this.connected = true;
      
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
      zoneId: batch.zoneId || 'ZONE_001', // Use provided zone or default
      lat: batch.coordinates?.latitude || 0,
      lon: batch.coordinates?.longitude || 0,
      timestamp: batch.timestamp,
      valueQuantity: {
        value: batch.quantity,
        unit: 'kg'
      },
      extension: [{
        url: 'http://ayurveda.org/gps-metadata',
        valueString: JSON.stringify({
          altitude: batch.coordinates?.altitude,
          accuracy: batch.coordinates?.accuracy,
          gpsTimestamp: batch.coordinates?.timestamp
        })
      }]
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
  async createCollectionEvent(batchData) {
    try {
      if (!this.connected) {
        try {
          await this.connect();
        } catch (error) {
          console.warn('Running in development mode without blockchain');
          return {
            success: true,
            transactionId: `dev-mode-${Date.now()}`,
            event: this.transformToCollectionEvent(batchData),
            warning: 'Running in development mode without blockchain'
          };
        }
      }
      
      if (!this.contract) {
        console.warn('Contract not initialized. Running in development mode without blockchain');
        return {
          success: true,
          transactionId: `dev-mode-${Date.now()}`,
          event: this.transformToCollectionEvent(batchData),
          warning: 'Running in development mode without blockchain'
        };
      }
      
      const event = this.transformToCollectionEvent(batchData);
      
      try {
        // Submit the transaction
        const result = await this.contract.submitTransaction(
          'CreateCollectionEvent',
          JSON.stringify(event)
        );
        
        return {
          success: true,
          transactionId: result.toString(),
          event: event
        };
      } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        // Return success in dev mode, but include error information
        return {
          success: true,
          transactionId: `error-${Date.now()}`,
          event: event,
          warning: 'Blockchain transaction failed, but batch was saved to database',
          error: error.message
        };
      }
    } catch (error) {
      console.error(`Failed to create collection event: ${error}`);
      // Even if there's an error, we don't want to fail the entire request
      // since the batch is already saved in MongoDB
      return {
        success: true,
        transactionId: `error-${Date.now()}`,
        warning: 'Blockchain integration failed, but batch was saved to database',
        error: error.message
      };
    }
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
