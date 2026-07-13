const express = require('express');
const router = express.Router();
const Company = require('../models/Company.model');

// ===== GET - قائمة الشركات =====
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find({ deletedAt: null }).select('-__v');
    res.json({
      success: true,
      message: 'Companies retrieved successfully',
      data: companies,
      count: companies.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error.message
    });
  }
});

// ===== GET - شركة بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    res.json({
      success: true,
      message: 'Company retrieved successfully',
      data: company
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
});

// ===== GET - شركة بالكود =====
router.get('/code/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const company = await Company.findOne({ code, deletedAt: null });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    res.json({
      success: true,
      message: 'Company retrieved successfully',
      data: company
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
});

// ===== POST - إنشاء شركة جديدة =====
router.post('/', async (req, res) => {
  try {
    const { name, code, industry, contactEmail, contactPhone, address, description, website } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || !code || !industry || !contactEmail) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, industry, and contactEmail are required'
      });
    }

    // التحقق من عدم وجود شركة بنفس الكود
    const existingCompany = await Company.findOne({ code: code.toUpperCase() });
    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: 'Company with this code already exists'
      });
    }

    // إنشاء شركة جديدة
    const newCompany = new Company({
      name,
      code: code.toUpperCase(),
      industry,
      contactEmail,
      contactPhone: contactPhone || null,
      address: address || {},
      description: description || null,
      website: website || null,
      status: 'active'
    });

    const savedCompany = await newCompany.save();

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: savedCompany
    });
  } catch (error) {
    console.error('❌ Error creating company:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
  }
});

// ===== PUT - تحديث شركة =====
router.put('/:id', async (req, res) => {
  try {
    const { name, industry, contactEmail, contactPhone, address, description, website, status } = req.body;
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // تحديث الحقول
    if (name) company.name = name;
    if (industry) company.industry = industry;
    if (contactEmail) company.contactEmail = contactEmail;
    if (contactPhone) company.contactPhone = contactPhone;
    if (address) company.address = address;
    if (description) company.description = description;
    if (website) company.website = website;
    if (status) company.status = status;

    company.updatedAt = new Date();
    const updatedCompany = await company.save();

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: updatedCompany
    });
  } catch (error) {
    console.error('❌ Error updating company:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company',
      error: error.message
    });
  }
});

// ===== DELETE - حذف شركة (Soft Delete) =====
router.delete('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Soft Delete
    company.deletedAt = new Date();
    company.status = 'archived';
    await company.save();

    res.json({
      success: true,
      message: 'Company deleted successfully',
      data: {
        id: company._id,
        name: company.name,
        status: 'deleted',
        deletedAt: company.deletedAt
      }
    });
  } catch (error) {
    console.error('❌ Error deleting company:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company',
      error: error.message
    });
  }
});

// ===== GET - إحصائيات الشركات =====
router.get('/stats', async (req, res) => {
  try {
    const total = await Company.countDocuments({ deletedAt: null });
    const active = await Company.countDocuments({ status: 'active', deletedAt: null });
    const inactive = await Company.countDocuments({ status: 'inactive', deletedAt: null });
    const archived = await Company.countDocuments({ status: 'archived', deletedAt: null });

    res.json({
      success: true,
      message: 'Company statistics retrieved successfully',
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