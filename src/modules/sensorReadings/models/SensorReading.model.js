const mongoose = require('mongoose');
const BaseModel = require('../../../core/base/BaseModel');

// ============ SENSOR READING SCHEMA ============

const sensorReadingSchema = BaseModel.createSchema({
  // ===== Base Fields =====
  factoryId: { type: String, required: true, index: true },
  departmentId: { type: String, index: true },
  productionLineId: { type: String, index: true },
  machineId: { type: String, required: true, index: true },

  // ===== Reading Data =====
  sensorId: { type: String, required: true, index: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now, index: true },
  quality: {
    type: String,
    enum: ['good', 'average', 'poor', 'unknown'],
    default: 'good'
  },
  rawValue: { type: Number },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

// ============ INDEXES ============
sensorReadingSchema.index({ sensorId: 1, timestamp: -1 });
sensorReadingSchema.index({ factoryId: 1, timestamp: -1 });
sensorReadingSchema.index({ machineId: 1, timestamp: -1 });
sensorReadingSchema.index({ companyId: 1, timestamp: -1 });

// ============ METHODS ============
sensorReadingSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    sensorId: this.sensorId,
    value: this.value,
    unit: this.unit,
    timestamp: this.timestamp,
    quality: this.quality,
    metadata: this.metadata,
    companyId: this.companyId,
    factoryId: this.factoryId,
    machineId: this.machineId,
  };
};

// ============ STATIC METHODS ============
sensorReadingSchema.statics.getLastReading = async function(sensorId) {
  return this.findOne({ sensorId, deletedAt: null })
    .sort({ timestamp: -1 })
    .lean();
};

sensorReadingSchema.statics.getReadingsInRange = async function(
  sensorId,
  startDate,
  endDate,
  limit = 1000
) {
  return this.find({
    sensorId,
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    deletedAt: null
  })
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();
};

sensorReadingSchema.statics.getReadingsStats = async function(
  sensorId,
  startDate,
  endDate
) {
  const stats = await this.aggregate([
    {
      $match: {
        sensorId,
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avg: { $avg: '$value' },
        min: { $min: '$value' },
        max: { $max: '$value' },
        sum: { $sum: '$value' },
        stdDev: { $stdDevPop: '$value' }
      }
    }
  ]);

  return stats[0] || { count: 0, avg: null, min: null, max: null, sum: 0, stdDev: null };
};

sensorReadingSchema.statics.bulkCreateReadings = async function(readings) {
  return this.insertMany(readings);
};

sensorReadingSchema.statics.deleteOldReadings = async function(days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });

  return { deletedCount: result.deletedCount };
};

const SensorReading = mongoose.model('SensorReading', sensorReadingSchema);

module.exports = SensorReading;