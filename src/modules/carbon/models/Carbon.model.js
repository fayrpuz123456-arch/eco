const mongoose = require('mongoose');

const carbonSchema = new mongoose.Schema({
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
  emissions: {
    scope1: {
      stationaryCombustion: { type: Number, default: 0 },
      mobileCombustion: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    scope2: {
      electricity: { type: Number, default: 0 },
      steam: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    scope3: {
      transportation: { type: Number, default: 0 },
      waste: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    totalEmissions: { type: Number, default: 0 }
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

const Carbon = mongoose.model('Carbon', carbonSchema);

module.exports = Carbon;