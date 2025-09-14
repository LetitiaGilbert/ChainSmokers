"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceabilityContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const fabric_shim_1 = require("fabric-shim");
const crypto = __importStar(require("crypto"));
class TraceabilityContract extends fabric_contract_api_1.Contract {
    getMSP(ctx) {
        return new fabric_shim_1.ClientIdentity(ctx.stub).getMSPID();
    }
    async putObject(ctx, key, obj) {
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
    }
    async getObject(ctx, key) {
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0)
            return null;
        return JSON.parse(data.toString());
    }
    async getComplianceRule(ctx, species) {
        return this.getObject(ctx, `COMPLIANCE_${species}`);
    }
    async getThreshold(ctx, species) {
        return this.getObject(ctx, `THRESHOLD_${species}`);
    }
    pointInPolygon(lat, lon, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lon, yi = polygon[i].lat;
            const xj = polygon[j].lon, yj = polygon[j].lat;
            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lon < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
            if (intersect)
                inside = !inside;
        }
        return inside;
    }
    // Admin
    async SetGeoFence(ctx, zoneId, polygonJSON) {
        if (this.getMSP(ctx) !== 'RegulatorMSP')
            throw new Error('Only RegulatorMSP can set geo-fences');
        let polygon;
        try {
            polygon = JSON.parse(polygonJSON);
        }
        catch {
            throw new Error('Invalid polygon JSON');
        }
        await this.putObject(ctx, `GEOFENCE_${zoneId}`, { zoneId, polygon });
    }
    async SetSeasonRule(ctx, species, ruleJSON) {
        if (this.getMSP(ctx) !== 'RegulatorMSP')
            throw new Error('Only RegulatorMSP can set season rules');
        let rule;
        try {
            rule = JSON.parse(ruleJSON);
        }
        catch {
            throw new Error('Invalid rule JSON');
        }
        await this.putObject(ctx, `SEASON_${species}`, rule);
    }
    // Collector
    async CreateCollectionEvent(ctx, eventJSON) {
        let event;
        try {
            event = JSON.parse(eventJSON);
        }
        catch {
            throw new Error('Invalid collection event JSON');
        }
        const msp = this.getMSP(ctx);
        if (!(msp === 'CollectorMSP' || msp === 'CollectorCoopMSP')) {
            throw new Error('Only collectors can submit collection events');
        }
        if (!event.zoneId || event.lat === undefined || event.lon === undefined)
            throw new Error('zoneId, lat, and lon are required for geo-fence validation');
        const gf = await this.getObject(ctx, `GEOFENCE_${event.zoneId}`);
        if (!gf)
            throw new Error(`GeoFence ${event.zoneId} not found`);
        if (!this.pointInPolygon(event.lat, event.lon, gf.polygon)) {
            throw new Error('Collection location outside permitted geo-fence');
        }
        const season = await this.getObject(ctx, `SEASON_${event.species}`);
        if (season && event.timestamp) {
            const mmdd = event.timestamp.slice(5, 10);
            if (season.start && season.end && !(mmdd >= season.start && mmdd <= season.end)) {
                throw new Error(`Collection outside allowed season for ${event.species}`);
            }
        }
        // Sustainability & Fair-Trade compliance
        const compliance = await this.getComplianceRule(ctx, event.species);
        if (compliance) {
            if (!compliance.sustainableHarvest)
                throw new Error(`Species ${event.species} is not approved for harvest`);
            if (compliance.fairTradeCertified && !msp.endsWith('CoopMSP'))
                throw new Error(`Collectors must be part of a verified fair-trade cooperative for ${event.species}`);
            if (compliance.maxHarvestPerCollector) {
                const query = { selector: { collectorId: event.collectorId, species: event.species }, fields: ['_id'] };
                const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
                let count = 0;
                let res = await iterator.next();
                while (!res.done) {
                    count++;
                    res = await iterator.next();
                }
                await iterator.close();
                if (count >= compliance.maxHarvestPerCollector)
                    throw new Error(`Collector has exceeded maximum allowed harvest for ${event.species}`);
            }
        }
        const key = ctx.stub.createCompositeKey('CollectionEvent', [event.id]);
        await this.putObject(ctx, key, event);
        await ctx.stub.setEvent('CollectionRecorded', Buffer.from(JSON.stringify({ id: event.id, species: event.species })));
    }
    // Batch
    async CreateBatch(ctx, batchId, species, collectionIdsJSON) {
        const msp = this.getMSP(ctx);
        if (!(msp === 'ManufacturerMSP' || msp === 'ProcessorMSP'))
            throw new Error('Only Processor or Manufacturer can create batches');
        let collectionIds;
        try {
            collectionIds = JSON.parse(collectionIdsJSON);
        }
        catch {
            throw new Error('Invalid collection IDs JSON');
        }
        for (const cid of collectionIds) {
            const ev = await this.getObject(ctx, ctx.stub.createCompositeKey('CollectionEvent', [cid]));
            if (!ev)
                throw new Error(`Collection event ${cid} not found`);
        }
        const qrHash = crypto.createHash('sha256')
            .update(batchId + new Date().toISOString() + Math.random().toString())
            .digest('hex');
        const batch = {
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
    async AddQualityTest(ctx, qualityJSON) {
        const msp = this.getMSP(ctx);
        if (msp !== 'LabMSP')
            throw new Error('Only LabMSP can submit quality tests');
        let test;
        try {
            test = JSON.parse(qualityJSON);
        }
        catch {
            throw new Error('Invalid quality JSON');
        }
        const privateKey = `QUALITY_${test.id}`;
        await ctx.stub.putPrivateData('LabResultsPrivate', privateKey, Buffer.from(JSON.stringify(test)));
        const batchKey = ctx.stub.createCompositeKey('Batch', [test.batchId]);
        const batch = await this.getObject(ctx, batchKey);
        if (!batch)
            throw new Error('Batch not found');
        const thresholds = await this.getThreshold(ctx, batch.species);
        let statusUpdate = 'PASSED';
        if (thresholds) {
            const failures = [];
            if (thresholds.moisture && (test.tests?.moisture === undefined || test.tests.moisture < thresholds.moisture.min || test.tests.moisture > thresholds.moisture.max))
                failures.push('Moisture out of range');
            if (thresholds.pesticidePPM && (test.tests?.pesticidePPM === undefined || test.tests.pesticidePPM > thresholds.pesticidePPM.max))
                failures.push('Pesticide exceeds limit');
            if (thresholds.dnaHashRequired && !test.tests?.dnaHash)
                failures.push('DNA hash required');
            if (failures.length > 0) {
                statusUpdate = 'FAILED_QA';
                batch.qualityFailures = failures;
            }
        }
        batch.status = statusUpdate;
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
    async SetQualityThreshold(ctx, species, thresholdJSON) {
        if (this.getMSP(ctx) !== 'RegulatorMSP')
            throw new Error('Only RegulatorMSP can set thresholds');
        let threshold;
        try {
            threshold = JSON.parse(thresholdJSON);
        }
        catch {
            throw new Error('Invalid JSON');
        }
        await this.putObject(ctx, `THRESHOLD_${species}`, threshold);
    }
    async SetComplianceRule(ctx, species, ruleJSON) {
        if (this.getMSP(ctx) !== 'RegulatorMSP')
            throw new Error('Only RegulatorMSP can set compliance rules');
        let rule;
        try {
            rule = JSON.parse(ruleJSON);
        }
        catch {
            throw new Error('Invalid JSON');
        }
        await this.putObject(ctx, `COMPLIANCE_${species}`, rule);
    }
    // Transfer batch
    async TransferBatch(ctx, batchId, toOrg) {
        const key = ctx.stub.createCompositeKey('Batch', [batchId]);
        const batch = await this.getObject(ctx, key);
        if (!batch)
            throw new Error('Batch not found');
        if (batch.ownerOrg !== this.getMSP(ctx))
            throw new Error('Only current owner can transfer batch');
        batch.ownerOrg = toOrg;
        await this.putObject(ctx, key, batch);
        await ctx.stub.setEvent('BatchTransferred', Buffer.from(JSON.stringify({ batchId, toOrg })));
    }
    // Provenance
    async GetProvenance(ctx, batchId) {
        const key = ctx.stub.createCompositeKey('Batch', [batchId]);
        const batch = await this.getObject(ctx, key);
        if (!batch)
            throw new Error('Batch not found');
        const collections = [];
        for (const cid of batch.collectionEventIds || []) {
            const ev = await this.getObject(ctx, ctx.stub.createCompositeKey('CollectionEvent', [cid]));
            if (ev)
                collections.push(ev);
        }
        const stepQuery = { selector: { batchId }, fields: ['_id', 'id', 'batchId', 'stepType', 'actorId', 'timestamp', 'params'] };
        const stepIterator = await ctx.stub.getQueryResult(JSON.stringify(stepQuery));
        const processingSteps = [];
        let stepRes = await stepIterator.next();
        while (!stepRes.done) {
            if (stepRes.value?.value)
                processingSteps.push(JSON.parse(stepRes.value.value.toString()));
            stepRes = await stepIterator.next();
        }
        await stepIterator.close();
        const query = { selector: { batchId }, fields: ['_id', 'id', 'batchId', 'timestamp', 'tests'] };
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        const qualitySummaries = [];
        let res = await iterator.next();
        while (!res.done) {
            if (res.value?.value)
                qualitySummaries.push(JSON.parse(res.value.value.toString()));
            res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify({ batch, collections, processingSteps, qualitySummaries });
    }
    // Processing step
    async CreateProcessingStep(ctx, stepJSON) {
        const msp = this.getMSP(ctx);
        if (!(msp === 'ProcessorMSP' || msp === 'ManufacturerMSP'))
            throw new Error('Only Processor or Manufacturer can add processing steps');
        let step;
        try {
            step = JSON.parse(stepJSON);
        }
        catch {
            throw new Error('Invalid processing step JSON');
        }
        const batchKey = ctx.stub.createCompositeKey('Batch', [step.batchId]);
        const batch = await this.getObject(ctx, batchKey);
        if (!batch)
            throw new Error(`Batch ${step.batchId} not found`);
        if (batch.ownerOrg !== msp)
            throw new Error('Only current batch owner can add processing steps');
        const stepKey = ctx.stub.createCompositeKey('ProcessingStep', [step.id]);
        await this.putObject(ctx, stepKey, step);
        await ctx.stub.setEvent('ProcessingStepAdded', Buffer.from(JSON.stringify({ stepId: step.id, batchId: step.batchId })));
    }
    // Recall
    async InitiateRecall(ctx, batchId, reason) {
        const msp = this.getMSP(ctx);
        if (!(msp === 'ManufacturerMSP' || msp === 'RegulatorMSP'))
            throw new Error('Only manufacturer or regulator can initiate recall');
        const key = ctx.stub.createCompositeKey('Batch', [batchId]);
        const batch = await this.getObject(ctx, key);
        if (!batch)
            throw new Error('Batch not found');
        batch.status = 'RECALL';
        batch.recallReason = reason;
        batch.recallAt = new Date().toISOString();
        await this.putObject(ctx, key, batch);
        await ctx.stub.setEvent('RecallInitiated', Buffer.from(JSON.stringify({ batchId, reason })));
    }
}
exports.TraceabilityContract = TraceabilityContract;
