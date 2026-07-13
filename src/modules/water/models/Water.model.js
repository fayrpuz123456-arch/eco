const mongoose = require('mongoose');

const waterSchema = new mongoose.Schema({
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
    intake: { type: Number, default: 0 },
    reused: { type: Number, default: 0 },
    discharged: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  quality: {
    ph: { type: Number, default: 7 },
    turbidity: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
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

const Water = mongoose.model('Water', waterSchema);

module.exports = Water;