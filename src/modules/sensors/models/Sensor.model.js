const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
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
      'PZEM004T', 'Current', 'Voltage', 'Power', 'Energy',
      'WaterFlow', 'FuelFlow', 'WaterLevel', 'Pressure',
      'MQ135', 'MQ2', 'MQ7', 'CO2',
      'Temperature', 'Humidity', 'Rain', 'Ultrasonic', 'HeatSensor',
      'Vibration', 'Accelerometer', 'Gyroscope',
      'Light', 'Sound', 'Proximity', 'IR', 'GPS', 'RPM', 'Torque',
      'Force', 'Flow', 'Level', 'pH', 'Conductivity', 'Turbidity',
      'DissolvedOxygen', 'Other'
    ]
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  machineId: {
    type: String,
    required: true
  },
  factoryId: {
    type: String,
    required: true
  },
  departmentId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'offline', 'maintenance', 'error', 'archived'],
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

sensorSchema.index({ code: 1, machineId: 1 }, { unique: true });

const Sensor = mongoose.model('Sensor', sensorSchema);

module.exports = Sensor;