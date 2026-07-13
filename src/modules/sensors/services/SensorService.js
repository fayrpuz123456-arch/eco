const BaseService = require('../../../core/base/BaseService');
const SensorRepository = require('../repositories/SensorRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class SensorService extends BaseService {
  constructor() {
    super(new SensorRepository(), 'Sensor');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createSensor(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'category', 'unit', 'machineId', 'factoryId', 'departmentId', 'productionLineId']);

      // التحقق من عدم وجود حساس بنفس الاسم في الآلة
      const existingName = await this.repository.findByName(data.name, data.machineId, companyId);
      if (existingName) {
        throw new ConflictError('Sensor with this name already exists on this machine');
      }

      // التحقق من عدم وجود حساس بنفس الكود في الآلة
      const existingCode = await this.repository.findByCode(data.code, data.machineId, companyId);
      if (existingCode) {
        throw new ConflictError('Sensor with this code already exists on this machine');
      }

      const sensorData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const sensor = await this.repository.create(sensorData);

      eventEmitter.emit('sensor.created', {
        sensorId: sensor._id,
        name: sensor.name,
        machineId: sensor.machineId,
        companyId,
        createdBy: userId
      });

      logger.info('Sensor created successfully', {
        sensorId: sensor._id,
        name: sensor.name,
        machineId: sensor.machineId,
        companyId
      });

      return sensor;
    } catch (error) {
      logger.error('Error creating sensor:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getSensorById(id, companyId) {
    const sensor = await this.repository.findById(id, companyId);
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }
    return sensor;
  }

  async getSensorByCode(code, machineId, companyId) {
    const sensor = await this.repository.findByCode(code, machineId, companyId);
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }
    return sensor;
  }

  async getSensors(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getSensorsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getMachineSensors(machineId, companyId) {
    return this.repository.find({ machineId }, companyId);
  }

  async getActiveSensors(machineId, companyId) {
    return this.repository.findActive(machineId, companyId);
  }

  async getSensorsByType(type, machineId, companyId) {
    return this.repository.findByType(type, machineId, companyId);
  }

  async getSensorsDueForCalibration(days = 7, machineId, companyId) {
    return this.repository.findDueForCalibration(days, machineId, companyId);
  }

  async getLowBatterySensors(threshold = 20, machineId, companyId) {
    return this.repository.findLowBattery(threshold, machineId, companyId);
  }

  async getFactorySensors(factoryId, companyId) {
    return this.repository.findByFactory(factoryId, companyId);
  }

  async getDepartmentSensors(departmentId, companyId) {
    return this.repository.findByDepartment(departmentId, companyId);
  }

  async getProductionLineSensors(productionLineId, companyId) {
    return this.repository.findByProductionLine(productionLineId, companyId);
  }

  async searchSensors(query, machineId, companyId) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query, machineId, companyId);
  }

  async getSensorStats(id) {
    const stats = await this.repository.getSensorStats(id);
    if (!stats) {
      throw new NotFoundError('Sensor not found');
    }
    return stats;
  }

  async getMachineSensorStats(machineId) {
    return this.repository.getMachineSensorStats(machineId);
  }

  async getTypeDistribution(machineId, companyId) {
    return this.repository.getTypeDistribution(machineId, companyId);
  }

  async getCategoryDistribution(machineId, companyId) {
    return this.repository.getCategoryDistribution(machineId, companyId);
  }

  // ============ UPDATE ============

  async updateSensor(id, data, userId, companyId) {
    try {
      const existingSensor = await this.repository.findById(id, companyId);
      if (!existingSensor) {
        throw new NotFoundError('Sensor not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'category', 'unit', 'precision',
        'manufacturer', 'specifications', 'installation',
        'thresholds', 'dataCollection', 'alerts',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.name && data.name !== existingSensor.name) {
        const nameExists = await this.repository.findByName(
          data.name,
          existingSensor.machineId,
          companyId
        );
        if (nameExists && nameExists._id !== id) {
          throw new ConflictError('Sensor with this name already exists on this machine');
        }
        updateData.name = data.name;
      }

      if (data.code && data.code.toUpperCase() !== existingSensor.code) {
        const codeExists = await this.repository.findByCode(
          data.code,
          existingSensor.machineId,
          companyId
        );
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Sensor with this code already exists on this machine');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedSensor = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('sensor.updated', {
        sensorId: updatedSensor._id,
        name: updatedSensor.name,
        machineId: updatedSensor.machineId,
        companyId,
        updatedBy: userId
      });

      logger.info('Sensor updated successfully', {
        sensorId: updatedSensor._id,
        name: updatedSensor.name,
        companyId
      });

      return updatedSensor;
    } catch (error) {
      logger.error('Error updating sensor:', error);
      throw error;
    }
  }

  async updateStatus(id, status, userId, companyId) {
    try {
      const sensor = await this.repository.findById(id, companyId);
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      const updatedSensor = await this.repository.updateStatus(id, status);

      logger.info('Sensor status updated', {
        sensorId: id,
        oldStatus: sensor.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedSensor;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  async updateLastReading(id, value, userId, companyId) {
    try {
      const sensor = await this.repository.findById(id, companyId);
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      const updatedSensor = await this.repository.updateLastReading(id, value);

      // التحقق من التنبيهات (Alerts)
      await this.checkThresholds(sensor, value);

      // إرسال حدث
      eventEmitter.emit('sensor.reading.updated', {
        sensorId: id,
        value,
        timestamp: new Date(),
        companyId
      });

      logger.info('Sensor reading updated', {
        sensorId: id,
        value,
        updatedBy: userId
      });

      return updatedSensor;
    } catch (error) {
      logger.error('Error updating sensor reading:', error);
      throw error;
    }
  }

  async updateCalibration(id, offset, multiplier, performedBy, userId, companyId) {
    try {
      const sensor = await this.repository.findById(id, companyId);
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      const updatedSensor = await this.repository.updateCalibration(
        id,
        offset,
        multiplier,
        performedBy || userId
      );

      logger.info('Sensor calibration updated', {
        sensorId: id,
        offset,
        multiplier,
        updatedBy: userId
      });

      return updatedSensor;
    } catch (error) {
      logger.error('Error updating calibration:', error);
      throw error;
    }
  }

  async updateBatteryLevel(id, batteryLevel, userId, companyId) {
    try {
      const sensor = await this.repository.findById(id, companyId);
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      const updatedSensor = await this.repository.updateBatteryLevel(id, batteryLevel);

      // إذا كانت البطارية منخفضة، أرسل تنبيه
      if (batteryLevel < 20) {
        eventEmitter.emit('sensor.low_battery', {
          sensorId: id,
          name: sensor.name,
          batteryLevel,
          companyId
        });
      }

      logger.info('Sensor battery updated', {
        sensorId: id,
        batteryLevel,
        updatedBy: userId
      });

      return updatedSensor;
    } catch (error) {
      logger.error('Error updating battery:', error);
      throw error;
    }
  }

  async addMaintenanceRecord(id, record, userId, companyId) {
    try {
      const sensor = await this.repository.findById(id, companyId);
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      const updatedSensor = await this.repository.addMaintenanceRecord(id, record);

      logger.info('Maintenance record added for sensor', {
        sensorId: id,
        record,
        addedBy: userId
      });

      return updatedSensor;
    } catch (error) {
      logger.error('Error adding maintenance record:', error);
      throw error;
    }
  }

  // ============ THRESHOLD CHECKING ============

  async checkThresholds(sensor, value) {
    const thresholds = sensor.thresholds;
    let alertType = null;
    let alertMessage = null;

    // التحقق من الحدود الحرجة
    if (thresholds.critical?.min !== null && value < thresholds.critical.min) {
      alertType = 'critical';
      alertMessage = `Sensor ${sensor.name} reading ${value} ${sensor.unit} is below critical minimum (${thresholds.critical.min})`;
    } else if (thresholds.critical?.max !== null && value > thresholds.critical.max) {
      alertType = 'critical';
      alertMessage = `Sensor ${sensor.name} reading ${value} ${sensor.unit} is above critical maximum (${thresholds.critical.max})`;
    }
    // التحقق من الحدود التحذيرية
    else if (thresholds.warning?.min !== null && value < thresholds.warning.min) {
      alertType = 'warning';
      alertMessage = `Sensor ${sensor.name} reading ${value} ${sensor.unit} is below warning minimum (${thresholds.warning.min})`;
    } else if (thresholds.warning?.max !== null && value > thresholds.warning.max) {
      alertType = 'warning';
      alertMessage = `Sensor ${sensor.name} reading ${value} ${sensor.unit} is above warning maximum (${thresholds.warning.max})`;
    }

    if (alertType && sensor.alerts.enabled) {
      eventEmitter.emit('sensor.alert.triggered', {
        sensorId: sensor._id,
        sensorName: sensor.name,
        type: alertType,
        message: alertMessage,
        value,
        threshold: alertType === 'critical' ? 
          (value < thresholds.critical.min ? thresholds.critical.min : thresholds.critical.max) :
          (value < thresholds.warning.min ? thresholds.warning.min : thresholds.warning.max),
        companyId: sensor.companyId,
        timestamp: new Date()
      });
    }
  }

  // ============ DELETE ============

  async deleteSensor(id, userId, companyId, reason = null) {
    try {
      const sensor = await this.repository.findById(id, companyId);
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      // التحقق من وجود قراءات مرتبطة
      const stats = await this.repository.getSensorStats(id);
      if (stats && stats.statistics?.totalReadings > 0) {
        throw new ValidationError('Cannot delete sensor with readings. Please delete all associated readings first.');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('sensor.deleted', {
        sensorId: id,
        name: sensor.name,
        machineId: sensor.machineId,
        companyId,
        deletedBy: userId
      });

      logger.info('Sensor deleted successfully', {
        sensorId: id,
        name: sensor.name,
        companyId
      });

      return { message: 'Sensor deleted successfully' };
    } catch (error) {
      logger.error('Error deleting sensor:', error);
      throw error;
    }
  }

  // ============ FILTERS ============

  async findWithFilters(filters = {}, machineId, companyId) {
    return this.repository.findWithFilters(filters, machineId, companyId);
  }

  // ============ DASHBOARD ============

  async getSensorDashboard(id, companyId) {
    const stats = await this.getSensorStats(id);
    const sensor = await this.getSensorById(id, companyId);
    
    return {
      sensor: {
        id: sensor._id,
        name: sensor.name,
        code: sensor.code,
        type: sensor.type,
        category: sensor.category,
        unit: sensor.unit,
        status: sensor.status,
        isActive: sensor.isActive,
        isOnline: sensor.isOnline
      },
      manufacturer: sensor.manufacturer,
      specifications: sensor.specifications,
      thresholds: sensor.thresholds,
      readings: {
        lastReading: sensor.readings.lastReading,
        minReading: sensor.readings.minReading,
        maxReading: sensor.readings.maxReading,
        avgReading: sensor.readings.avgReading,
        readingCount: sensor.readings.readingCount
      },
      statistics: stats.statistics || {},
      calibration: {
        offset: sensor.calibration.offset,
        multiplier: sensor.calibration.multiplier,
        lastCalibrated: sensor.calibration.lastCalibrated,
        nextCalibration: sensor.calibration.nextCalibration
      },
      energy: {
        batteryLevel: sensor.energy.batteryLevel,
        powerSource: sensor.energy.powerSource,
        consumption: sensor.energy.consumption
      },
      alerts: sensor.alerts,
      createdAt: sensor.createdAt
    };
  }
}

module.exports = SensorService;