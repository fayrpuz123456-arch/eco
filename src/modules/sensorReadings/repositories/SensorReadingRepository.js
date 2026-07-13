const BaseRepository = require('../../../core/base/BaseRepository');
const SensorReading = require('../models/SensorReading.model');

/**
 * مستودع قراءات الحساسات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بقراءات الحساسات
 */
class SensorReadingRepository extends BaseRepository {
  constructor() {
    super(SensorReading);
    this.model = SensorReading;
  }

  // ============ CREATE METHODS ============

  async createReading(data) {
    return this.model.createReading(data);
  }

  async bulkCreateReadings(readings) {
    return this.model.bulkCreateReadings(readings);
  }

  // ============ FIND METHODS ============

  async getLastReading(sensorId) {
    return this.model.getLastReading(sensorId);
  }

  async getReadingsInRange(sensorId, startDate, endDate, limit = 1000) {
    return this.model.getReadingsInRange(sensorId, startDate, endDate, limit);
  }

  async getReadingsBySensorIds(sensorIds, startDate, endDate, limit = 1000) {
    const query = {
      sensorId: { $in: sensorIds },
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    return this.model.find(query)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();
  }

  async getReadingsByFactory(factoryId, startDate, endDate, limit = 1000) {
    const query = {
      factoryId,
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    return this.model.find(query)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();
  }

  async getReadingsByMachine(machineId, startDate, endDate, limit = 1000) {
    const query = {
      machineId,
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    return this.model.find(query)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();
  }

  // ============ STATISTICS METHODS ============

  async getAverageReading(sensorId, startDate, endDate) {
    return this.model.getAverageReading(sensorId, startDate, endDate);
  }

  async getReadingsStats(sensorId, startDate, endDate) {
    return this.model.getReadingsStats(sensorId, startDate, endDate);
  }

  async getReadingsByInterval(sensorId, startDate, endDate, interval) {
    return this.model.getReadingsByInterval(sensorId, startDate, endDate, interval);
  }

  async getSensorSummary(sensorId, startDate, endDate) {
    const stats = await this.getReadingsStats(sensorId, startDate, endDate);
    const lastReading = await this.getLastReading(sensorId);
    
    return {
      sensorId,
      period: { startDate, endDate },
      stats,
      lastReading: lastReading || null
    };
  }

  // ============ AGGREGATION METHODS ============

  async getDailyReadings(sensorId, startDate, endDate) {
    return this.getReadingsByInterval(sensorId, startDate, endDate, 'daily');
  }

  async getHourlyReadings(sensorId, startDate, endDate) {
    return this.getReadingsByInterval(sensorId, startDate, endDate, 'hourly');
  }

  async getMonthlyReadings(sensorId, startDate, endDate) {
    return this.getReadingsByInterval(sensorId, startDate, endDate, 'monthly');
  }

  async getCompanyReadingsStats(companyId, startDate, endDate) {
    const stats = await this.model.aggregate([
      {
        $match: {
          companyId,
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          sum: { $sum: '$value' }
        }
      }
    ]);
    
    return stats[0] || { total: 0, avg: null, min: null, max: null, sum: 0 };
  }

  async getFactoryReadingsStats(factoryId, startDate, endDate) {
    const stats = await this.model.aggregate([
      {
        $match: {
          factoryId,
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          sum: { $sum: '$value' }
        }
      }
    ]);
    
    return stats[0] || { total: 0, avg: null, min: null, max: null, sum: 0 };
  }

  async getMachineReadingsStats(machineId, startDate, endDate) {
    const stats = await this.model.aggregate([
      {
        $match: {
          machineId,
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          sum: { $sum: '$value' }
        }
      }
    ]);
    
    return stats[0] || { total: 0, avg: null, min: null, max: null, sum: 0 };
  }

  // ============ ANOMALY DETECTION ============

  async getAnomalies(sensorId, startDate, endDate, threshold = 3) {
    // حساب المتوسط والانحراف المعياري
    const stats = await this.getReadingsStats(sensorId, startDate, endDate);
    
    if (!stats.avg || !stats.stdDev) {
      return [];
    }
    
    const upperBound = stats.avg + (threshold * stats.stdDev);
    const lowerBound = stats.avg - (threshold * stats.stdDev);
    
    const anomalies = await this.model.find({
      sensorId,
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      $or: [
        { value: { $gt: upperBound } },
        { value: { $lt: lowerBound } }
      ]
    }).sort({ timestamp: -1 }).lean();
    
    return anomalies.map(a => ({
      ...a,
      anomalyScore: Math.abs(a.value - stats.avg) / stats.stdDev,
      bound: a.value > upperBound ? 'upper' : 'lower'
    }));
  }

  // ============ DELETE METHODS ============

  async deleteOldReadings(days) {
    return this.model.deleteOldReadings(days);
  }

  async deleteReadingsBySensor(sensorId) {
    return this.model.deleteMany({ sensorId });
  }

  // ============ EXPORT ============

  async exportReadings(sensorId, startDate, endDate, format = 'json') {
    const readings = await this.getReadingsInRange(sensorId, startDate, endDate, 10000);
    
    if (format === 'csv') {
      return this.convertToCSV(readings);
    }
    
    return readings;
  }

  convertToCSV(readings) {
    if (readings.length === 0) return '';
    
    const headers = ['timestamp', 'value', 'unit', 'quality', 'sensorId', 'machineId'];
    const csvRows = [headers.join(',')];
    
    for (const reading of readings) {
      const row = headers.map(header => {
        let value = reading[header] || '';
        if (header === 'timestamp') {
          value = new Date(value).toISOString();
        }
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = SensorReadingRepository;