const BaseService = require('../../../core/base/BaseService');
const ReportRepository = require('../repositories/ReportRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class ReportService extends BaseService {
  constructor() {
    super(new ReportRepository(), 'Report');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createReport(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'period.startDate', 'period.endDate']);

      // التحقق من عدم وجود كود مكرر
      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        throw new ConflictError('Report with this code already exists');
      }

      // تحضير البيانات
      const startDate = new Date(data.period.startDate);
      const endDate = new Date(data.period.endDate);
      
      const reportData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        companyId,
        status: 'draft',
        period: {
          ...data.period,
          startDate,
          endDate,
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          quarter: Math.ceil((startDate.getMonth() + 1) / 3)
        }
      };

      // إذا كان هناك جدولة
      if (data.scheduling?.enabled) {
        reportData.scheduling = {
          ...data.scheduling,
          nextGeneration: this.calculateNextGeneration(data.scheduling)
        };
      }

      const report = await this.repository.create(reportData);

      eventEmitter.emit('report.created', {
        reportId: report._id,
        name: report.name,
        type: report.type,
        companyId
      });

      logger.info('Report created successfully', {
        reportId: report._id,
        name: report.name,
        type: report.type
      });

      return report;
    } catch (error) {
      logger.error('Error creating report:', error);
      throw error;
    }
  }

  // ============ GENERATION ============

  async generateReport(id, userId, companyId) {
    try {
      const report = await this.repository.findById(id, companyId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }

      // بدء التوليد
      await this.repository.startGeneration(id);

      // توليد بيانات التقرير
      const reportData = await this.collectReportData(report);

      // توليد الملف
      const fileData = await this.generateFile(report, reportData);

      // إكمال التقرير
      const completed = await this.repository.completeGeneration(id, fileData);

      eventEmitter.emit('report.generated', {
        reportId: id,
        name: report.name,
        type: report.type,
        companyId,
        generatedBy: userId
      });

      logger.info('Report generated successfully', {
        reportId: id,
        name: report.name,
        type: report.type
      });

      return completed;
    } catch (error) {
      // فشل التوليد
      await this.repository.failGeneration(id, error.message);
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  async collectReportData(report) {
    // TODO: جمع البيانات حسب نوع التقرير
    // يمكن استخدام خدمات الكربون، الطاقة، المياه، النفايات
    const data = {
      summary: {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        count: 0,
        trend: 'stable',
        percentage: 0
      },
      charts: [],
      tables: [],
      sections: []
    };

    // بناء على نوع التقرير
    switch (report.type) {
      case 'carbon':
        data.summary = await this.getCarbonSummary(report);
        break;
      case 'energy':
        data.summary = await this.getEnergySummary(report);
        break;
      case 'water':
        data.summary = await this.getWaterSummary(report);
        break;
      case 'waste':
        data.summary = await this.getWasteSummary(report);
        break;
    }

    return data;
  }

  async getCarbonSummary(report) {
    // TODO: جلب بيانات الكربون
    return { total: 0, average: 0, min: 0, max: 0, count: 0, trend: 'stable', percentage: 0 };
  }

  async getEnergySummary(report) {
    // TODO: جلب بيانات الطاقة
    return { total: 0, average: 0, min: 0, max: 0, count: 0, trend: 'stable', percentage: 0 };
  }

  async getWaterSummary(report) {
    // TODO: جلب بيانات المياه
    return { total: 0, average: 0, min: 0, max: 0, count: 0, trend: 'stable', percentage: 0 };
  }

  async getWasteSummary(report) {
    // TODO: جلب بيانات النفايات
    return { total: 0, average: 0, min: 0, max: 0, count: 0, trend: 'stable', percentage: 0 };
  }

  async generateFile(report, data) {
    // TODO: توليد الملف حسب الصيغة
    // يمكن استخدام puppeteer للـ PDF، exceljs للـ Excel
    const fileData = {
      url: `/reports/${report._id}.${report.format}`,
      path: `./uploads/reports/${report._id}.${report.format}`,
      size: 0,
      mimeType: this.getMimeType(report.format),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 أيام
    };

    return fileData;
  }

  getMimeType(format) {
    const types = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html'
    };
    return types[format] || 'application/octet-stream';
  }

  // ============ SCHEDULING ============

  async processScheduledReports() {
    try {
      const reports = await this.repository.findScheduled();
      const results = [];

      for (const report of reports) {
        try {
          // توليد التقرير
          await this.generateReport(report._id, 'system', report.companyId);
          results.push({ reportId: report._id, status: 'success' });
        } catch (error) {
          results.push({ reportId: report._id, status: 'failed', error: error.message });
        }
      }

      logger.info('Scheduled reports processed', {
        total: reports.length,
        results
      });

      return results;
    } catch (error) {
      logger.error('Error processing scheduled reports:', error);
      throw error;
    }
  }

  calculateNextGeneration(schedule) {
    const now = new Date();
    let next = new Date(now);
    
    switch (schedule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
    }
    
    const timeParts = (schedule.time || '08:00').split(':');
    next.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
    
    return next;
  }

  // ============ FIND ============

  async getReportById(id, companyId) {
    const report = await this.repository.findById(id, companyId);
    if (!report) {
      throw new NotFoundError('Report not found');
    }
    return report;
  }

  async getReportByCode(code) {
    const report = await this.repository.findByCode(code);
    if (!report) {
      throw new NotFoundError('Report not found');
    }
    return report;
  }

  async getReports(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getReportsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getReportsByType(companyId, type) {
    return this.repository.findByType(companyId, type);
  }

  async getReportsByPeriod(companyId, startDate, endDate) {
    return this.repository.findByPeriod(companyId, startDate, endDate);
  }

  async getReportsByStatus(companyId, status) {
    return this.repository.findByStatus(companyId, status);
  }

  async getReportStats(companyId) {
    return this.repository.getStats(companyId);
  }

  // ============ UPDATE ============

  async updateReport(id, data, userId, companyId) {
    try {
      const existingReport = await this.repository.findById(id, companyId);
      if (!existingReport) {
        throw new NotFoundError('Report not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'format', 'language',
        'period', 'filters', 'scheduling', 'delivery',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.code && data.code.toUpperCase() !== existingReport.code) {
        const codeExists = await this.repository.findByCode(data.code);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Report with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedReport = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('report.updated', {
        reportId: updatedReport._id,
        name: updatedReport.name,
        companyId
      });

      logger.info('Report updated successfully', {
        reportId: updatedReport._id,
        name: updatedReport.name
      });

      return updatedReport;
    } catch (error) {
      logger.error('Error updating report:', error);
      throw error;
    }
  }

  // ============ COMMENTS ============

  async addComment(id, userId, userName, content, companyId) {
    try {
      const report = await this.repository.findById(id, companyId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }

      const updatedReport = await this.repository.addComment(id, userId, userName, content);

      logger.info('Comment added to report', {
        reportId: id,
        userId
      });

      return updatedReport;
    } catch (error) {
      logger.error('Error adding comment:', error);
      throw error;
    }
  }

  // ============ SHARING ============

  async shareReport(id, userIds, companyId) {
    try {
      const report = await this.repository.findById(id, companyId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }

      const updatedReport = await this.repository.shareReport(id, userIds);

      logger.info('Report shared', {
        reportId: id,
        userIds
      });

      return updatedReport;
    } catch (error) {
      logger.error('Error sharing report:', error);
      throw error;
    }
  }

  async unshareReport(id, userIds, companyId) {
    try {
      const report = await this.repository.findById(id, companyId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }

      const updatedReport = await this.repository.unshareReport(id, userIds);

      logger.info('Report unshared', {
        reportId: id,
        userIds
      });

      return updatedReport;
    } catch (error) {
      logger.error('Error unsharing report:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteReport(id, userId, companyId, reason = null) {
    try {
      const report = await this.repository.findById(id, companyId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }

      await this.repository.softDelete(id, companyId);

      logger.info('Report deleted', {
        reportId: id,
        name: report.name
      });

      return { message: 'Report deleted successfully' };
    } catch (error) {
      logger.error('Error deleting report:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  async exportReports(companyId, startDate, endDate, format = 'json') {
    return this.repository.exportReports(companyId, startDate, endDate, format);
  }
}

module.exports = ReportService;