const express = require('express');
const router = express.Router();
const Factory = require('../models/Factory.model');

// ===== GET - قائمة المصانع =====
router.get('/', async (req, res) => {
  try {
    const factories = await Factory.find({ deletedAt: null }).select('-__v');
    res.json({
      success: true,
      message: 'Factories retrieved successfully',
      data: factories,
      count: factories.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching factories',
      error: error.message
    });
  }
});

// ===== GET - مصنع بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const factory = await Factory.findById(req.params.id);
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }
    res.json({
      success: true,
      message: 'Factory retrieved successfully',
      data: factory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching factory',
      error: error.message
    });
  }
});

// ===== GET - مصنع بالكود =====
router.get('/code/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const factory = await Factory.findOne({ code, deletedAt: null });
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }
    res.json({
      success: true,
      message: 'Factory retrieved successfully',
      data: factory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching factory',
      error: error.message
    });
  }
});

// ===== POST - إنشاء مصنع جديد =====
router.post('/', async (req, res) => {
  try {
    const { name, code, industry, contactEmail, companyId, contactPhone, address } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || !code || !industry || !contactEmail || !companyId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, industry, contactEmail, and companyId are required'
      });
    }

    // التحقق من عدم وجود مصنع بنفس الكود في نفس الشركة
    const existingFactory = await Factory.findOne({ code: code.toUpperCase(), companyId });
    if (existingFactory) {
      return res.status(409).json({
        success: false,
        message: 'Factory with this code already exists in this company'
      });
    }

    // إنشاء مصنع جديد
    const newFactory = new Factory({
      name,
      code: code.toUpperCase(),
      industry,
      contactEmail,
      companyId,
      contactPhone: contactPhone || null,
      address: address || {},
      status: 'active'
    });

    const savedFactory = await newFactory.save();

    res.status(201).json({
      success: true,
      message: 'Factory created successfully',
      data: savedFactory
    });
  } catch (error) {
    console.error('❌ Error creating factory:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating factory',
      error: error.message
    });
  }
});

// ===== PUT - تحديث مصنع =====
router.put('/:id', async (req, res) => {
  try {
    const { name, industry, contactEmail, contactPhone, address, status } = req.body;
    const factory = await Factory.findById(req.params.id);
    
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    // تحديث الحقول
    if (name) factory.name = name;
    if (industry) factory.industry = industry;
    if (contactEmail) factory.contactEmail = contactEmail;
    if (contactPhone) factory.contactPhone = contactPhone;
    if (address) factory.address = address;
    if (status) factory.status = status;

    factory.updatedAt = new Date();
    const updatedFactory = await factory.save();

    res.json({
      success: true,
      message: 'Factory updated successfully',
      data: updatedFactory
    });
  } catch (error) {
    console.error('❌ Error updating factory:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating factory',
      error: error.message
    });
  }
});

// ===== DELETE - حذف مصنع (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    const factory = await Factory.findById(req.params.id);
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: 'Factory not found'
      });
    }

    // Soft Delete
    factory.deletedAt = new Date();
    factory.status = 'archived';
    await factory.save();

    res.json({
      success: true,
      message: 'Factory deleted successfully',
      data: {
        id: factory._id,
        name: factory.name,
        status: 'deleted',
        deletedAt: factory.deletedAt
      }
    });
  } catch (error) {
    console.error('❌ Error deleting factory:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting factory',
      error: error.message
    });
  }
});

// ===== GET - إحصائيات المصانع =====
router.get('/stats', async (req, res) => {
  try {
    const total = await Factory.countDocuments({ deletedAt: null });
    const active = await Factory.countDocuments({ status: 'active', deletedAt: null });
    const inactive = await Factory.countDocuments({ status: 'inactive', deletedAt: null });
    const archived = await Factory.countDocuments({ status: 'archived', deletedAt: null });

    res.json({
      success: true,
      message: 'Factory statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        archived
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

module.exports = router;