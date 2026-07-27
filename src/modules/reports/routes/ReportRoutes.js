const express = require('express');
const router = express.Router();
const Report = require('../models/Report.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق الـ Middleware
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ===== GET - قائمة التقارير =====
router.get('/', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    const { type, status, limit = 50 } = req.query;

    const query = { companyId, deletedAt: null };
    if (type) query.type = type;
    if (status) query.status = status;

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      message: 'Reports retrieved successfully',
      data: reports,
      count: reports.length
    });
  } catch (error) {
    logger.error('❌ Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - تقرير بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    const { id } = req.params;
    const report = await Report.findOne({
      _id: id,
      companyId,
      deletedAt: null
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      message: 'Report retrieved successfully',
      data: report
    });
  } catch (error) {
    logger.error('❌ Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - تقرير بالكود =====
router.get('/code/:code', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    const { code } = req.params;
    const report = await Report.findOne({
      code: code.toUpperCase(),
      companyId,
      deletedAt: null
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      message: 'Report retrieved successfully',
      data: report
    });
  } catch (error) {
    logger.error('❌ Error fetching report by code:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - إنشاء تقرير جديد =====
router.post('/', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ التحقق من صحة companyId
    if (!companyId.startsWith('comp_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must start with "comp_"'
      });
    }

    const { 
      name, 
      code, 
      type, 
      factoryId, 
      period, 
      format, 
      filters,
      description,
      language,
      scheduling,
      delivery,
      tags
    } = req.body;

    // ✅ التحقق من الحقول المطلوبة
    if (!name || !code || !type || !factoryId || !period || !period.startDate || !period.endDate) {
      return res.status(400).json({
        success: false,
        message: 'name, code, type, factoryId, period.startDate, and period.endDate are required'
      });
    }

    // ✅ التحقق من عدم وجود تقرير بنفس الكود في نفس الشركة
    const existingReport = await Report.findOne({ 
      code: code.toUpperCase(),
      companyId,
      deletedAt: null 
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: `Report with code "${code}" already exists in this company`
      });
    }

    // ✅ إنشاء التقرير مع companyId الصحيح
    const newReport = new Report({
      companyId, // ✅ استخدام companyId الصحيح
      factoryId,
      createdBy: userId,
      updatedBy: userId,
      name: name.trim(),
      code: code.toUpperCase().trim(),
      type,
      description: description || null,
      format: format || 'pdf',
      language: language || 'en',
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        type: period.type || 'monthly'
      },
      filters: filters || {},
      scheduling: scheduling || {
        enabled: false,
        frequency: 'monthly',
        time: '08:00'
      },
      delivery: delivery || {
        email: false,
        recipients: [],
        download: true
      },
      tags: tags || [],
      status: 'draft'
    });

    const savedReport = await newReport.save();

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: savedReport
    });
  } catch (error) {
    logger.error('❌ Error creating report:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Report code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== POST - توليد تقرير =====
router.post('/:id/generate', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { id } = req.params;
    const report = await Report.findOne({
      _id: id,
      companyId,
      deletedAt: null
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // بدء التوليد
    await report.startGeneration();

    // محاكاة توليد التقرير (هنا هتضيف منطق التوليد الفعلي)
    // مثلاً: جلب البيانات من Carbon, Energy, Water, Waste modules

    // إكمال التقرير
    await report.complete({
      url: `/reports/${report._id}.${report.format}`,
      path: `./uploads/reports/${report._id}.${report.format}`,
      size: 1024,
      mimeType: report.format === 'pdf' ? 'application/pdf' : 'application/json'
    });

    res.json({
      success: true,
      message: 'Report generated successfully',
      data: report
    });
  } catch (error) {
    logger.error('❌ Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث تقرير =====
router.put('/:id', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { id } = req.params;
    const report = await Report.findOne({
      _id: id,
      companyId,
      deletedAt: null
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // ✅ منع تحديث companyId و code
    delete req.body.companyId;
    delete req.body.code;

    const { 
      name, 
      description, 
      format, 
      status, 
      filters,
      language,
      period,
      data,
      scheduling,
      delivery,
      tags
    } = req.body;

    if (name) report.name = name.trim();
    if (description !== undefined) report.description = description;
    if (format) report.format = format;
    if (language) report.language = language;
    if (status) report.status = status;
    if (filters) report.filters = filters;
    if (data) report.data = data;
    if (scheduling) report.scheduling = scheduling;
    if (delivery) report.delivery = delivery;
    if (tags) report.tags = tags;
    
    if (period) {
      report.period = {
        ...report.period,
        ...period,
        startDate: period.startDate ? new Date(period.startDate) : report.period.startDate,
        endDate: period.endDate ? new Date(period.endDate) : report.period.endDate
      };
    }

    report.updatedBy = userId;
    report.updatedAt = new Date();

    const updatedReport = await report.save();

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: updatedReport
    });
  } catch (error) {
    logger.error('❌ Error updating report:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== DELETE - حذف تقرير (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;
    const userId = req.user.id;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { id } = req.params;
    const report = await Report.findOne({
      _id: id,
      companyId,
      deletedAt: null
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.deletedAt = new Date();
    report.deletedBy = userId;
    report.status = 'archived';
    await report.save();

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logger.error('❌ Error deleting report:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== GET - إحصائيات التقارير =====
router.get('/stats', async (req, res) => {
  try {
    // ✅ استخدام companyId من الـ Body أو من الـ Auth
    const companyId = req.body.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId مطلوب في الـ Body أو من الـ Auth'
      });
    }

    const stats = await Report.getStats(companyId);
    const typeDistribution = await Report.getTypeDistribution(companyId);
    const statusDistribution = await Report.getStatusDistribution(companyId);

    res.json({
      success: true,
      message: 'Report statistics retrieved successfully',
      data: {
        stats,
        typeDistribution,
        statusDistribution
      }
    });
  } catch (error) {
    logger.error('❌ Error fetching report stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;