const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 20
  },
  type: {
    type: String,
    required: true,
    enum: [
      'cnc_machine', 'lathe', 'milling', 'drilling', 'grinding',
      'welding', 'press', 'injection_molding', 'extrusion', 'stamping',
      'laser', 'waterjet', 'plasma', 'packaging', 'labeling',
      'capping', 'filling', 'conveyor', 'forklift', 'crane',
      'generator', 'compressor', 'boiler', 'chiller', 'pump',
      'quality_inspection', 'testing', 'measurement', 'other'
    ]
  },
  factoryId: {
    type: String,
    required: true
  },
  departmentId: {
    type: String,
    required: true
  },
  model: {
    type: String,
    default: null
  },
  serialNumber: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'operational', 'maintenance', 'idle', 'offline', 'error', 'archived'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

machineSchema.index({ code: 1, factoryId: 1 }, { unique: true });

const Machine = mongoose.model('Machine', machineSchema);

module.exports = Machine;