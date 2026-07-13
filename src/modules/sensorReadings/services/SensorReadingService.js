const BaseService = require('../../../core/base/BaseService');
const SensorReadingRepository = require('../repositories/SensorReadingRepository');
const Sensor = require('../../sensors/models/Sensor.model');
const {
  AppError,
  ValidationError,
  NotFoundError,
  BadRequestError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class SensorReadingService extends BaseService {
  constructor() {
    super(new SensorReadingRepository(), 'SensorReading');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  /**
   * إنشاء قراءة جديدة
   */
  async createReading(data, userId, companyId) {
    try {
      // التحقق من وجود الحساس
      const sensor = await Sensor.findOne({ _id: data.sensorId, companyId });
      if (!sensor) {
        throw new NotFoundError('Sensor not found');
      }

      // إضافة البيانات الإضافية
      const readingData = {
        ...data,
        companyId,
        factoryId: sensor.factoryId,
        departmentId: sensor.departmentId,
        productionLineId: sensor.productionLineId,
        machineId: sensor.machineId,
        unit: sensor.unit || data.unit,
        timestamp: data.timestamp || new Date()
      };

      // إنشاء القراءة
      const reading = await this.repository.createReading(readingData);

      // تحديث آخر قراءة في الحساس
      await sensor.updateLastReading(reading.value, reading.timestamp, reading.quality);

      // إرسال حدث
      eventEmitter.emit(EventTypes.SENSOR_DATA_RECEIVED, {
        sensorId: sensor._id,
        value: reading.value,
        timestamp: reading.timestamp,
        companyId,
        readingId: reading._id
      });

      logger.info('Sensor reading created', {
        sensorId: sensor._id,
        value: reading.value,
        companyId
      });

      return reading;
    } catch (error) {
      logger.error('Error creating sensor reading:', error);
      throw error;
    }
  }

  /**
   * إنشاء قراءات متعددة
   */
  async bulkCreateReadings(readings, userId, companyId) {
    try {
      if (!readings || readings.length === 0) {
        throw new ValidationError('No readings provided');
      }

      if (readings.length > 1000) {
        throw new ValidationError('Maximum 1000 readings per batch');
      }

      // التحقق من جميع الحساسات
      const sensorIds = [...new Set(readings.map(r => r.sensorId))];
      const sensors = await Sensor.find({ _id: { $in: sensorIds }, companyId });
      
      if (sensors.length !== sensorIds.length) {
        throw new NotFoundError('One or more sensors not found');
      }

      // إضافة البيانات لكل قراءة
      const sensorMap = {};
      sensors.forEach(s => { sensorMap[s._id] = s; });

      const enrichedReadings = readings.map(r => {
        const sensor = sensorMap[r.sensorId];
        return {
          ...r,
          companyId,
          factoryId: sensor.factoryId,
          departmentId: sensor.departmentId,
          productionLineId: sensor.productionLineId,
          machineId: sensor.machineId,
          unit: sensor.unit || r.unit,
          timestamp: r.timestamp || new Date()
        };
      });

      // إنشاء القراءات
      const result = await this.repository.bulkCreateReadings(enrichedReadings);

      // تحديث آخر قراءة لكل حساس
      for (const sensor of sensors) {
        const lastReading = await this.repository.getLastReading(sensor._id);
        if (lastReading) {
          await sensor.updateLastReading(
            lastReading.value,
            lastReading.timestamp,
            lastReading.quality
          );
        }
      }

      // إرسال حدث
      eventEmitter.emit('sensor.readings.bulk_created', {
        count: result.inserted,
        companyId
      });

      logger.info('Bulk sensor readings created', {
        count: result.inserted,
        companyId
      });

      return result;
    } catch (error) {
      logger.error('Error bulk creating sensor readings:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getLastReading(sensorId, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    return this.repository.getLastReading(sensorId);
  }

  async getReadingsInRange(sensorId, startDate, endDate, limit = 1000, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    if (new Date(startDate) > new Date(endDate)) {
      throw new ValidationError('Start date must be before end date');
    }

    return this.repository.getReadingsInRange(sensorId, startDate, endDate, limit);
  }

  async getReadingsStats(sensorId, startDate, endDate, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    return this.repository.getReadingsStats(sensorId, startDate, endDate);
  }

  async getReadingsByInterval(sensorId, startDate, endDate, interval, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(interval)) {
      throw new ValidationError('Invalid interval. Must be: hourly, daily, weekly, monthly');
    }

    return this.repository.getReadingsByInterval(sensorId, startDate, endDate, interval);
  }

  async getMachineReadings(machineId, startDate, endDate, limit = 1000, companyId) {
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    return this.repository.getReadingsByMachine(machineId, startDate, endDate, limit);
  }

  async getFactoryReadings(factoryId, startDate, endDate, limit = 1000, companyId) {
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    return this.repository.getReadingsByFactory(factoryId, startDate, endDate, limit);
  }

  // ============ STATISTICS ============

  async getSensorSummary(sensorId, startDate, endDate, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    return this.repository.getSensorSummary(sensorId, startDate, endDate);
  }

  async getCompanyReadingsStats(companyId, startDate, endDate) {
    return this.repository.getCompanyReadingsStats(companyId, startDate, endDate);
  }

  async getFactoryReadingsStats(factoryId, startDate, endDate, companyId) {
    return this.repository.getFactoryReadingsStats(factoryId, startDate, endDate);
  }

  async getMachineReadingsStats(machineId, startDate, endDate, companyId) {
    return this.repository.getMachineReadingsStats(machineId, startDate, endDate);
  }

  // ============ ANOMALY DETECTION ============

  async detectAnomalies(sensorId, startDate, endDate, threshold = 3, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    return this.repository.getAnomalies(sensorId, startDate, endDate, threshold);
  }

  // ============ EXPORT ============

  async exportReadings(sensorId, startDate, endDate, format = 'json', companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    return this.repository.exportReadings(sensorId, startDate, endDate, format);
  }

  // ============ DELETE ============

  async deleteOldReadings(days, companyId) {
    if (!days || days < 1) {
      throw new ValidationError('Days must be a positive number');
    }

    const deletedCount = await this.repository.deleteOldReadings(days);

    logger.info('Old readings deleted', {
      days,
      deletedCount,
      companyId
    });

    return { deletedCount };
  }

  // ============ DASHBOARD ============

  async getSensorReadingsDashboard(sensorId, startDate, endDate, companyId) {
    const sensor = await Sensor.findOne({ _id: sensorId, companyId });
    if (!sensor) {
      throw new NotFoundError('Sensor not found');
    }

    const [lastReading, stats, hourlyData, dailyData] = await Promise.all([
      this.repository.getLastReading(sensorId),
      this.repository.getReadingsStats(sensorId, startDate, endDate),
      this.repository.getReadingsByInterval(sensorId, startDate, endDate, 'hourly'),
      this.repository.getReadingsByInterval(sensorId, startDate, endDate, 'daily')
    ]);

    return {
      sensor: {
        id: sensor._id,
        name: sensor.name,
        code: sensor.code,
        type: sensor.type,
        unit: sensor.unit
      },
      lastReading: lastReading || null,
      statistics: stats,
      hourlyData: hourlyData,
      dailyData: dailyData,
      period: { startDate, endDate }
    };
  }

  async getRealtimeReadings(companyId, limit = 50) {
    // الحصول على أحدث القراءات من جميع الحساسات
    const readings = await this.repository.model.aggregate([
      { $match: { companyId } },
      { $sort: { timestamp: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensorId',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      { $unwind: { path: '$sensor', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          value: 1,
          unit: 1,
          timestamp: 1,
          quality: 1,
          sensorId: 1,
          'sensor.name': 1,
          'sensor.type': 1,
          'sensor.code': 1
        }
      }
    ]);

    return readings;
  }
}

module.exports = SensorReadingService;