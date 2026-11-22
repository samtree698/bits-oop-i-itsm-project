const { dbManager, mongoose } = require('../config/db');
const { DatabaseFailureException } = require('../exceptions/AppExceptions');

/**
 * Repository Pattern Base Contract (PDF Page 11 & 13)
 * Supports MongoDB via Mongoose Models with transparent In-Memory Collection Map fallback
 */
class BaseRepository {
  constructor(collectionName, schemaDefinition, keyField = 'id') {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository is an abstract class.');
    }
    this.collectionName = collectionName;
    this.keyField = keyField;
    this.memoryStore = new Map();

    if (mongoose) {
      const schema = new mongoose.Schema(schemaDefinition, { strict: false, timestamps: false });
      this.model = mongoose.models[collectionName] || mongoose.model(collectionName, schema);
    } else {
      this.model = null;
    }
  }

  async save(entityObj) {
    try {
      const raw = typeof entityObj.toPersistence === 'function'
        ? entityObj.toPersistence()
        : typeof entityObj.toJSON === 'function'
        ? entityObj.toJSON()
        : { ...entityObj };

      const key = raw[this.keyField];
      this.memoryStore.set(key, JSON.parse(JSON.stringify(raw)));

      if (dbManager.isConnected && this.model) {
        await this.model.findOneAndUpdate({ [this.keyField]: key }, raw, { upsert: true, new: true });
      }
      return entityObj;
    } catch (err) {
      throw new DatabaseFailureException(`save(${this.collectionName})`, err.message);
    }
  }

  async findByKey(keyValue) {
    try {
      if (dbManager.isConnected && this.model) {
        const doc = await this.model.findOne({ [this.keyField]: keyValue }).lean();
        if (doc) return this.hydrate(doc);
      }
      const raw = this.memoryStore.get(keyValue);
      return raw ? this.hydrate(JSON.parse(JSON.stringify(raw))) : null;
    } catch (err) {
      throw new DatabaseFailureException(`findByKey(${this.collectionName})`, err.message);
    }
  }

  async findAll() {
    try {
      if (dbManager.isConnected && this.model) {
        const docs = await this.model.find({}).lean();
        if (docs.length > 0) {
          return docs.map((d) => this.hydrate(d));
        }
      }
      return Array.from(this.memoryStore.values()).map((r) => this.hydrate(JSON.parse(JSON.stringify(r))));
    } catch (err) {
      throw new DatabaseFailureException(`findAll(${this.collectionName})`, err.message);
    }
  }

  async deleteByKey(keyValue) {
    this.memoryStore.delete(keyValue);
    if (dbManager.isConnected && this.model) {
      await this.model.deleteOne({ [this.keyField]: keyValue });
    }
  }

  async clear() {
    this.memoryStore.clear();
    if (dbManager.isConnected && this.model) {
      await this.model.deleteMany({});
    }
  }

  hydrate(rawDoc) {
    return rawDoc;
  }
}

module.exports = { BaseRepository };
