"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HerbTraceability = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
class HerbTraceability extends fabric_contract_api_1.Contract {
    // helper: put object into world state
    async _put(ctx, key, obj) {
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
    }
    // helper: get object from world state
    async _get(ctx, key) {
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0)
            return null;
        return JSON.parse(data.toString());
    }
    // Ping
    async ping(ctx) {
        return 'HerbTraceability TS chaincode alive';
    }
    // Add CollectionEvent
    async addCollectionEvent(ctx, id, batchId, farmerId, species, latStr, lonStr, timestampISO, initialQualityJSON) {
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        const initialQuality = initialQualityJSON ? JSON.parse(initialQualityJSON) : {};
        const event = {
            type: 'CollectionEvent',
            id,
            batchId,
            farmerId,
            species,
            geoLocation: { lat, lon },
            timestamp: timestampISO,
            initialQuality,
            meta: {
                createdBy: ctx.clientIdentity.getID(),
                createdAt: new Date().toISOString(),
            }
        };
        await this._put(ctx, id, event);
        if (batchId) {
            await this._put(ctx, `LATEST_${batchId}`, { eventId: id, timestamp: timestampISO });
        }
        return JSON.stringify(event);
    }
    // Create Batch
    async createBatch(ctx, batchId, manufacturerId, productName, qrHash, timestampISO, metaJSON) {
        const meta = metaJSON ? JSON.parse(metaJSON) : {};
        const batch = {
            type: 'Batch',
            batchId,
            manufacturerId,
            productName,
            qrHash,
            timestamp: timestampISO,
            meta: { ...meta, createdBy: ctx.clientIdentity.getID(), createdAt: new Date().toISOString() }
        };
        await this._put(ctx, `BATCH_${batchId}`, batch);
        await this._put(ctx, `LATEST_${batchId}`, { eventId: `BATCH_${batchId}`, timestamp: timestampISO });
        return JSON.stringify(batch);
    }
    // Add Correction
    async addCorrection(ctx, correctionId, targetId, correctedFieldsJSON, authorId, timestampISO, reason) {
        const target = await this._get(ctx, targetId);
        if (!target)
            throw new Error(`Target ${targetId} not found`);
        const correctedFields = correctedFieldsJSON ? JSON.parse(correctedFieldsJSON) : {};
        const correction = {
            type: 'Correction',
            id: correctionId,
            targetId,
            correctedFields,
            authorId,
            timestamp: timestampISO,
            reason,
            meta: { createdBy: ctx.clientIdentity.getID(), createdAt: new Date().toISOString() }
        };
        await this._put(ctx, correctionId, correction);
        await this._put(ctx, `SUPERSEDED_${targetId}`, { supersededBy: correctionId, timestamp: timestampISO });
        if (correctedFields.batchId) {
            await this._put(ctx, `LATEST_${correctedFields.batchId}`, { eventId: correctionId, timestamp: timestampISO });
        }
        return JSON.stringify(correction);
    }
    // Get latest for batch
    async getLatestForBatch(ctx, batchId) {
        const ptr = await this._get(ctx, `LATEST_${batchId}`);
        if (!ptr)
            return JSON.stringify({ message: 'No events found for batch' });
        const obj = await this._get(ctx, ptr.eventId) || await this._get(ctx, `BATCH_${batchId}`);
        return JSON.stringify({ pointer: ptr, object: obj || null });
    }
}
exports.HerbTraceability = HerbTraceability;
