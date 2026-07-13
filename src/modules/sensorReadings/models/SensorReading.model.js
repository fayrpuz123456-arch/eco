const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  sensorId: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  quality: {
    type: String,
    enum: ['good', 'average', 'poor', 'unknown'],
    default: 'good'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

sensorReadingSchema.index({ sensorId: 1, timestamp: -1 });

const SensorReading = mongoose.model('SensorReading', sensorReadingSchema);

module.exports = SensorReading;