const mongoose = require('mongoose');

const wasteSchema = new mongoose.Schema({
  factoryId: {
    type: String,
    required: true,
    index: true
  },
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    }
  },
  generation: {
    total: { type: Number, default: 0 },
    collected: { type: Number, default: 0 },
    sorted: { type: Number, default: 0 }
  },
  disposal: {
    landfill: { type: Number, default: 0 },
    recycling: { type: Number, default: 0 },
    composting: { type: Number, default: 0 },
    energy_recovery: { type: Number, default: 0 }
  },
  recycling: {
    rate: { type: Number, min: 0, max: 100, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 }
  },
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

const Waste = mongoose.model('Waste', wasteSchema);

module.exports = Waste;