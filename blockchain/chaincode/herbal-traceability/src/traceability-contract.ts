import { Context, Contract } from 'fabric-contract-api';
import { ClientIdentity } from 'fabric-shim';
import * as crypto from 'crypto';

// Interfaces
interface CollectionEvent {
  resourceType: 'Observation';
  id: string;
  meta?: { versionId?: string; lastUpdated?: string };
  status: 'final';
  category?: { coding: { system: string; code: string; display: string }[] }[];
  code?: { coding: { system: string; code: string; display: string }[] };
  subject: { reference: string; display: string }; // collector reference
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string }; // e.g., moisture
  extension?: any[]; // for GPS, zoneId, species etc.

  // Additional fields for ledger logic
  collectorId?: string;
  species?: string;
  zoneId?: string;
  lat?: number;
  lon?: number;
  timestamp?: string;
}

interface ComplianceRule {
  species: string;
  sustainableHarvest: boolean;
  maxHarvestPerCollector?: number;
  fairTradeCertified: boolean;
}

interface ProcessingStep {
  resourceType: 'Procedure';
  id: string;
  status: 'completed';
  category?: { coding: { system: string; code: string; display: string }[] };
  code: { coding: { system: string; code: string; display: string }[] };
  subject: { reference: string; display: string }; // batch reference
  performer: { actor: { reference: string; display: string } }[];
  performedDateTime: string;
  extension?: any[];
  batchId?: string; // ledger logic
}

interface Batch {
  resourceType: 'Medication';
  id: string;
  identifier?: { system: string; value: string }[];
  status?: 'active' | 'inactive' | 'CREATED' | 'RECALL' | 'PASSED' | 'FAILED_QA';
  lotNumber?: string;
  manufacturer?: { reference: string; display: string };
  meta?: { lastUpdated?: string };

  // Ledger-specific fields
  species?: string;
  collectionEventIds?: string[];
  ownerOrg?: string;
  qrHash?: string;
  createdAt?: string;
  qualityFailures?: string[];
  recallReason?: string;
  recallAt?: string;
}

interface QualityTest {
  resourceType: 'Observation';
  id: string;
  batchId: string;
  status: 'final';
  code: { coding: { system: string; code: string; display: string }[] };
  subject: { reference: string; display: string };
  performer: { actor: { reference: string; display: string } }[];
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string };
  component?: { code: { coding: { system: string; code: string; display: string }[] }; valueQuantity?: { value: number; unit: string } }[];
  tests?: { moisture?: number; pesticidePPM?: number; dnaHash?: string };
  timestamp?: string;
  labId?: string;
}

interface QualityThreshold {
  species: string;
  moisture?: { min: number; max: number };
  pesticidePPM?: { max: number };
  dnaHashRequired?: boolean;
}

interface Provenance {
  resourceType: 'Provenance';
  id: string;
  target: { reference: string }[];
  recorded: string;
  agent: { type: { coding: { system: string; code: string; display: string }[] }; who: { reference: string; display: string } }[];
  entity?: { role: string; what: { reference: string } }[];
  signature?: { type: { system: string; code: string }[]; when: string; who: { reference: string } }[];
}

export class TraceabilityContract extends Contract {
  private getMSP(ctx: Context): string {
    return new ClientIdentity(ctx.stub).getMSPID();
  }

  private async putObject(ctx: Context, key: string, obj: any) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
  }

  private async getObject<T>(ctx: Context, key: string): Promise<T | null> {
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) return null;
    return JSON.parse(data.toString()) as T;
  }

  private async getComplianceRule(ctx: Context, species: string): Promise<ComplianceRule | null> {
    return this.getObject<ComplianceRule>(ctx, `COMPLIANCE_${species}`);
  }

  private async getThreshold(ctx: Context, species: string): Promise<QualityThreshold | null> {
    return this.getObject<QualityThreshold>(ctx, `THRESHOLD_${species}`);
  }

  private pointInPolygon(lat: number, lon: number, polygon: Array<{ lat: number; lon: number }>) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lon, yi = polygon[i].lat;
      const xj = polygon[j].lon, yj = polygon[j].lat;
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Admin
  public async SetGeoFence(ctx: Context, zoneId: string, polygonJSON: string): Promise<void> {
    if (this.getMSP(ctx) !== 'RegulatorMSP') throw new Error('Only RegulatorMSP can set geo-fences');
    let polygon;
    try { polygon = JSON.parse(polygonJSON); } catch { throw new Error('Invalid polygon JSON'); }
    await this.putObject(ctx, `GEOFENCE_${zoneId}`, { zoneId, polygon });
  }

  public async SetSeasonRule(ctx: Context, species: string, ruleJSON: string): Promise<void> {
    if (this.getMSP(ctx) !== 'RegulatorMSP') throw new Error('Only RegulatorMSP can set season rules');
    let rule;
    try { rule = JSON.parse(ruleJSON); } catch { throw new Error('Invalid rule JSON'); }
    await this.putObject(ctx, `SEASON_${species}`, rule);
  }

  // Collector
  public async CreateCollectionEvent(ctx: Context, eventJSON: string): Promise<void> {
    let event: CollectionEvent;
    try { event = JSON.parse(eventJSON); } catch { throw new Error('Invalid collection event JSON'); }

    const msp = this.getMSP(ctx);
    if (!(msp === 'CollectorMSP' || msp === 'CollectorCoopMSP')) {
      throw new Error('Only collectors can submit collection events');
    }

    if (!event.zoneId || event.lat === undefined || event.lon === undefined) throw new Error('zoneId, lat, and lon are required for geo-fence validation');
    const gf = await this.getObject<{ zoneId: string; polygon: any }>(ctx, `GEOFENCE_${event.zoneId}`);
    if (!gf) throw new Error(`GeoFence ${event.zoneId} not found`);
    if (!this.pointInPolygon(event.lat, event.lon, gf.polygon)) {
      throw new Error('Collection location outside permitted geo-fence');
    }

    const season = await this.getObject<any>(ctx, `SEASON_${event.species}`);
    if (season && event.timestamp) {
      const mmdd = event.timestamp.slice(5, 10);
      if (season.start && season.end && !(mmdd >= season.start && mmdd <= season.end)) {
        throw new Error(`Collection outside allowed season for ${event.species}`);
      }
    }

    // Sustainability & Fair-Trade compliance
    const compliance = await this.getComplianceRule(ctx, event.species!);
    if (compliance) {
      if (!compliance.sustainableHarvest) throw new Error(`Species ${event.species} is not approved for harvest`);
      if (compliance.fairTradeCertified && !msp.endsWith('CoopMSP')) throw new Error(`Collectors must be part of a verified fair-trade cooperative for ${event.species}`);

      if (compliance.maxHarvestPerCollector) {
        const query = { selector: { collectorId: event.collectorId, species: event.species }, fields: ['_id'] };
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        let count = 0;
        let res = await iterator.next();
        while (!res.done) { count++; res = await iterator.next(); }
        await iterator.close();
        if (count >= compliance.maxHarvestPerCollector) throw new Error(`Collector has exceeded maximum allowed harvest for ${event.species}`);
      }
    }

    const key = ctx.stub.createCompositeKey('CollectionEvent', [event.id]);
    await this.putObject(ctx, key, event);
    await ctx.stub.setEvent('CollectionRecorded', Buffer.from(JSON.stringify({ id: event.id, species: event.species })));
  }

  // Batch
  public async CreateBatch(ctx: Context, batchId: string, species: string, collectionIdsJSON: string): Promise<void> {
    const msp = this.getMSP(ctx);
    if (!(msp === 'ManufacturerMSP' || msp === 'ProcessorMSP')) throw new Error('Only Processor or Manufacturer can create batches');

    let collectionIds: string[];
    try { collectionIds = JSON.parse(collectionIdsJSON); } catch { throw new Error('Invalid collection IDs JSON'); }

    for (const cid of collectionIds) {
      const ev = await this.getObject<CollectionEvent>(ctx, ctx.stub.createCompositeKey('CollectionEvent', [cid]));
      if (!ev) throw new Error(`Collection event ${cid} not found`);
    }

    const qrHash = crypto.createHash('sha256')
      .update(batchId + new Date().toISOString() + Math.random().toString())
      .digest('hex');

    const batch: Batch = {
      resourceType: 'Medication', // <-- added
      id: batchId,
      species,
      collectionEventIds: collectionIds,
      ownerOrg: msp,
      status: 'CREATED',
      qrHash,
      createdAt: new Date().toISOString()
    };

    const key = ctx.stub.createCompositeKey('Batch', [batchId]);
    await this.putObject(ctx, key, batch);
    await ctx.stub.setEvent('BatchCreated', Buffer.from(JSON.stringify({ batchId, species, qrHash })));
  }

  // Quality test
  public async AddQualityTest(ctx: Context, qualityJSON: string): Promise<void> {
    const msp = this.getMSP(ctx);
    if (msp !== 'LabMSP') throw new Error('Only LabMSP can submit quality tests');

    let test: QualityTest;
    try { test = JSON.parse(qualityJSON); } catch { throw new Error('Invalid quality JSON'); }

    const privateKey = `QUALITY_${test.id}`;
    await ctx.stub.putPrivateData('LabResultsPrivate', privateKey, Buffer.from(JSON.stringify(test)));

    const batchKey = ctx.stub.createCompositeKey('Batch', [test.batchId!]);
    const batch = await this.getObject<Batch>(ctx, batchKey);
    if (!batch) throw new Error('Batch not found');

    const thresholds = await this.getThreshold(ctx, batch.species!);

    let statusUpdate = 'PASSED';
    if (thresholds) {
      const failures: string[] = [];
      if (thresholds.moisture && (test.tests?.moisture === undefined || test.tests.moisture < thresholds.moisture.min || test.tests.moisture > thresholds.moisture.max)) failures.push('Moisture out of range');
      if (thresholds.pesticidePPM && (test.tests?.pesticidePPM === undefined || test.tests.pesticidePPM > thresholds.pesticidePPM.max)) failures.push('Pesticide exceeds limit');
      if (thresholds.dnaHashRequired && !test.tests?.dnaHash) failures.push('DNA hash required');
      if (failures.length > 0) { statusUpdate = 'FAILED_QA'; batch.qualityFailures = failures; }
    }

    batch.status = statusUpdate as 'CREATED' | 'RECALL' | 'PASSED' | 'FAILED_QA' | 'active' | 'inactive';
    await this.putObject(ctx, batchKey, batch);

    const publicSummary = {
      id: test.id,
      batchId: test.batchId,
      timestamp: test.timestamp,
      tests: {
        moisture: test.tests?.moisture ?? null,
        pesticidePPM: test.tests?.pesticidePPM ? 'REDACTED' : null
      },
      labId: test.labId,
      status: statusUpdate
    };
    const pubKey = ctx.stub.createCompositeKey('QualityTestSummary', [test.id]);
    await this.putObject(ctx, pubKey, publicSummary);

    await ctx.stub.setEvent('QualityTestAdded', Buffer.from(JSON.stringify({ id: test.id, batchId: test.batchId, status: statusUpdate })));
  }

  public async SetQualityThreshold(ctx: Context, species: string, thresholdJSON: string): Promise<void> {
    if (this.getMSP(ctx) !== 'RegulatorMSP') throw new Error('Only RegulatorMSP can set thresholds');
    let threshold;
    try { threshold = JSON.parse(thresholdJSON); } catch { throw new Error('Invalid JSON'); }
    await this.putObject(ctx, `THRESHOLD_${species}`, threshold);
  }

  public async SetComplianceRule(ctx: Context, species: string, ruleJSON: string): Promise<void> {
    if (this.getMSP(ctx) !== 'RegulatorMSP') throw new Error('Only RegulatorMSP can set compliance rules');
    let rule;
    try { rule = JSON.parse(ruleJSON); } catch { throw new Error('Invalid JSON'); }
    await this.putObject(ctx, `COMPLIANCE_${species}`, rule);
  }

  // Transfer batch
  public async TransferBatch(ctx: Context, batchId: string, toOrg: string): Promise<void> {
    const key = ctx.stub.createCompositeKey('Batch', [batchId]);
    const batch = await this.getObject<Batch>(ctx, key);
    if (!batch) throw new Error('Batch not found');
    if (batch.ownerOrg !== this.getMSP(ctx)) throw new Error('Only current owner can transfer batch');

    batch.ownerOrg = toOrg;
    await this.putObject(ctx, key, batch);
    await ctx.stub.setEvent('BatchTransferred', Buffer.from(JSON.stringify({ batchId, toOrg })));
  }

  // Provenance
  public async GetProvenance(ctx: Context, batchId: string): Promise<string> {
    const key = ctx.stub.createCompositeKey('Batch', [batchId]);
    const batch = await this.getObject<Batch>(ctx, key);
    if (!batch) throw new Error('Batch not found');

    const collections: CollectionEvent[] = [];
    for (const cid of batch.collectionEventIds || []) {
      const ev = await this.getObject<CollectionEvent>(ctx, ctx.stub.createCompositeKey('CollectionEvent', [cid]));
      if (ev) collections.push(ev);
    }

    const stepQuery = { selector: { batchId }, fields: ['_id', 'id', 'batchId', 'stepType', 'actorId', 'timestamp', 'params'] };
    const stepIterator = await ctx.stub.getQueryResult(JSON.stringify(stepQuery));
    const processingSteps: ProcessingStep[] = [];
    let stepRes = await stepIterator.next();
    while (!stepRes.done) {
      if (stepRes.value?.value) processingSteps.push(JSON.parse(stepRes.value.value.toString()));
      stepRes = await stepIterator.next();
    }
    await stepIterator.close();

    const query = { selector: { batchId }, fields: ['_id', 'id', 'batchId', 'timestamp', 'tests'] };
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const qualitySummaries: any[] = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value?.value) qualitySummaries.push(JSON.parse(res.value.value.toString()));
      res = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify({ batch, collections, processingSteps, qualitySummaries });
  }

  // Processing step
  public async CreateProcessingStep(ctx: Context, stepJSON: string): Promise<void> {
    const msp = this.getMSP(ctx);
    if (!(msp === 'ProcessorMSP' || msp === 'ManufacturerMSP')) throw new Error('Only Processor or Manufacturer can add processing steps');

    let step: ProcessingStep;
    try { step = JSON.parse(stepJSON); } catch { throw new Error('Invalid processing step JSON'); }

    const batchKey = ctx.stub.createCompositeKey('Batch', [step.batchId!]);
    const batch = await this.getObject<Batch>(ctx, batchKey);
    if (!batch) throw new Error(`Batch ${step.batchId} not found`);
    if (batch.ownerOrg !== msp) throw new Error('Only current batch owner can add processing steps');

    const stepKey = ctx.stub.createCompositeKey('ProcessingStep', [step.id]);
    await this.putObject(ctx, stepKey, step);

    await ctx.stub.setEvent('ProcessingStepAdded', Buffer.from(JSON.stringify({ stepId: step.id, batchId: step.batchId })));
  }

  // Recall
  public async InitiateRecall(ctx: Context, batchId: string, reason: string): Promise<void> {
    const msp = this.getMSP(ctx);
    if (!(msp === 'ManufacturerMSP' || msp === 'RegulatorMSP')) throw new Error('Only manufacturer or regulator can initiate recall');

    const key = ctx.stub.createCompositeKey('Batch', [batchId]);
    const batch = await this.getObject<Batch>(ctx, key);
    if (!batch) throw new Error('Batch not found');

    batch.status = 'RECALL';
    batch.recallReason = reason;
    batch.recallAt = new Date().toISOString();
    await this.putObject(ctx, key, batch);

    await ctx.stub.setEvent('RecallInitiated', Buffer.from(JSON.stringify({ batchId, reason })));
  }
}
