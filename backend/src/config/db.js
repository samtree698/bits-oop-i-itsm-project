let mongoose = null;
try {
  mongoose = require('mongoose');
} catch {
  mongoose = null;
}

class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.mode = 'MEMORY_FALLBACK'; // 'MONGODB' | 'MEMORY_FALLBACK'
  }

  async connect(uri) {
    if (process.env.PERSISTENCE_MODE === 'MEMORY' || !mongoose) {
      this.isConnected = false;
      this.mode = 'MEMORY_FALLBACK';
      return this.mode;
    }
    const mongoUri = uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/i_itsm_db';
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1800 });
      this.isConnected = true;
      this.mode = 'MONGODB';
      return this.mode;
    } catch (err) {
      this.isConnected = false;
      this.mode = 'MEMORY_FALLBACK';
      return this.mode;
    }
  }

  async disconnect() {
    if (this.isConnected && mongoose) {
      await mongoose.disconnect();
      this.isConnected = false;
    }
  }
}

const dbManager = new DatabaseManager();
module.exports = { dbManager, DatabaseManager, mongoose };
