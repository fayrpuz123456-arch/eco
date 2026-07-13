const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  type: {
    type: String,
    required: true,
    enum: ['threshold', 'anomaly', 'maintenance', 'system', 'safety', 'quality', 'production']
  },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'critical', 'emergency']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  source: {
    sensorId: { type: String },
    machineId: { type: String },
    departmentId: { type: String },
    sourceType: {
      type: String,
      enum: ['sensor', 'machine', 'department', 'factory', 'system'],
      required: true
    }
  },
  condition: {
    operator: {
      type: String,
      enum: ['>', '>=', '<', '<=', '==', '!='],
      required: true
    },
    value: { type: Number, required: true },
    threshold: { type: Number },
    duration: { type: Number }
  },
  factoryId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'archived'],
    default: 'active'
  },
  triggeredAt: {
    type: Date,
    default: Date.now
  },
  acknowledgedBy: { type: String },
  acknowledgedAt: { type: Date },
  resolvedBy: { type: String },
  resolvedAt: { type: Date },
  resolutionNote: { type: String },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;