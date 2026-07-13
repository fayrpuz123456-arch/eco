const express = require('express');
const router = express.Router();
const Report = require('../models/Report.model');

// ===== GET - قائمة التقارير =====
router.get('/', async (req, res) => {
  try {
    const { companyId } = req;
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
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// ===== GET - تقرير بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);

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
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message
    });
  }
});

// ===== POST - إنشاء تقرير جديد =====
router.post('/', async (req, res) => {
  try {
    const { name, code, type, factoryId, period, format, filters } = req.body;
    const companyId = req.companyId || 'comp_test_001';

    if (!name || !code || !type || !factoryId || !period || !period.startDate || !period.endDate) {
      return res.status(400).json({
        success: false,
        message: 'name, code, type, factoryId, period.startDate, and period.endDate are required'
      });
    }

    const existingReport = await Report.findOne({ code: code.toUpperCase() });
    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: 'Report with this code already exists'
      });
    }

    const newReport = new Report({
      companyId,
      factoryId,
      name,
      code: code.toUpperCase(),
      type,
      format: format || 'pdf',
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        type: period.type || 'monthly'
      },
      filters: filters || {},
      status: 'draft'
    });

    const savedReport = await newReport.save();

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: savedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating report',
      error: error.message
    });
  }
});

// ===== POST - توليد تقرير =====
router.post('/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);

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
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: error.message
    });
  }
});

// ===== PUT - تحديث تقرير =====
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, format, status, filters } = req.body;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (name) report.name = name;
    if (description) report.description = description;
    if (format) report.format = format;
    if (status) report.status = status;
    if (filters) report.filters = filters;

    const updatedReport = await report.save();

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: updatedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating report',
      error: error.message
    });
  }
});

// ===== DELETE - حذف تقرير =====
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.deletedAt = new Date();
    report.status = 'archived';
    await report.save();

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: error.message
    });
  }
});

module.exports = router;