const mongoose = require('mongoose');

const energySchema = new mongoose.Schema({
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
  consumption: {
    electricity: { type: Number, default: 0 },
    fuel: { type: Number, default: 0 },
    gas: { type: Number, default: 0 },
    renewable: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  cost: {
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
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

const Energy = mongoose.model('Energy', energySchema);

module.exports = Energy;