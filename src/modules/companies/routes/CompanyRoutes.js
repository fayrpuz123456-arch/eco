const express = require('express');
const router = express.Router();
const Company = require('../models/Company.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { checkPermissions, PERMISSIONS } = require('../../../core/middleware/permissions');

// ============ MIDDLEWARE ============
// تطبيق المصادقة على جميع Routes
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============ HELPER FUNCTIONS ============

/**
 * حساب إحصائيات الشركة ديناميكياً
 */
async function getCompanyWithStats(companyId) {
  try {
    const Factory = require('../../factories/models/Factory.model');
    const Department = require('../../departments/models/Department.model');
    const Machine = require('../../machines/models/Machine.model');
    const Sensor = require('../../sensors/models/Sensor.model');
    const User = require('../../users/models/User.model');
    const SensorReading = require('../../sensorReadings/models/SensorReading.model');
    const Alert = require('../../alerts/models/Alert.model');
    const Report = require('../../reports/models/Report.model');

    const [
      factories,
      departments,
      machines,
      sensors,
      users,
      readings,
      alerts,
      reports
    ] = await Promise.all([
      Factory.countDocuments({ companyId, deletedAt: null }),
      Department.countDocuments({ companyId, deletedAt: null }),
      Machine.countDocuments({ companyId, deletedAt: null }),
      Sensor.countDocuments({ companyId, deletedAt: null }),
      User.countDocuments({ companyId, deletedAt: null }),
      SensorReading.countDocuments({ companyId, deletedAt: null }),
      Alert.countDocuments({ companyId, deletedAt: null }),
      Report.countDocuments({ companyId, deletedAt: null })
    ]);

    return {
      totalFactories: factories,
      totalDepartments: departments,
      totalMachines: machines,
      totalSensors: sensors,
      totalUsers: users,
      totalReadings: readings,
      totalAlerts: alerts,
      totalReports: reports,
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error('Error calculating company stats:', error);
    return {
      totalFactories: 0,
      totalDepartments: 0,
      totalMachines: 0,
      totalSensors: 0,
      totalUsers: 0,
      totalReadings: 0,
      totalAlerts: 0,
      totalReports: 0,
      lastUpdated: new Date()
    };
  }
}

/**
 * دمج الإحصائيات مع بيانات الشركة
 */
async function enrichCompanyWithStats(company) {
  if (!company) return company;
  
  const stats = await getCompanyWithStats(company._id);
  
  // تحويل إلى Object عشان نقدر نعدله
  const companyObj = company.toObject ? company.toObject() : company;
  
  return {
    ...companyObj,
    statistics: {
      ...companyObj.statistics,
      ...stats
    }
  };
}

// ============ ROUTES ============

// ===== GET - قائمة الشركات مع إحصائيات =====
router.get('/', checkPermissions([PERMISSIONS.COMPANIES_VIEW]), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      Company.find({ deletedAt: null })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Company.countDocuments({ deletedAt: null })
    ]);

    // إضافة الإحصائيات لكل شركة
    const enrichedCompanies = await Promise.all(
      companies.map(company => enrichCompanyWithStats(company))
    );

    res.json({
      success: true,
      message: 'Companies retrieved successfully',
      data: enrichedCompanies,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ GET /companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error.message
    });
  }
});

// ===== GET - شركة بالمعرف مع إحصائيات =====
router.get('/:id', checkPermissions([PERMISSIONS.COMPANIES_VIEW]), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const enrichedCompany = await enrichCompanyWithStats(company);

    res.json({
      success: true,
      message: 'Company retrieved successfully',
      data: enrichedCompany
    });
  } catch (error) {
    console.error('❌ GET /companies/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
});

// ===== GET - شركة بالكود =====
router.get('/code/:code', checkPermissions([PERMISSIONS.COMPANIES_VIEW]), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const company = await Company.findOne({ code, deletedAt: null });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const enrichedCompany = await enrichCompanyWithStats(company);

    res.json({
      success: true,
      message: 'Company retrieved successfully',
      data: enrichedCompany
    });
  } catch (error) {
    console.error('❌ GET /companies/code/:code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
});

// ===== GET - الشركات النشطة =====
router.get('/active', checkPermissions([PERMISSIONS.COMPANIES_VIEW]), async (req, res) => {
  try {
    const companies = await Company.find({ 
      status: 'active', 
      deletedAt: null 
    }).select('-__v');

    // إضافة الإحصائيات لكل شركة
    const enrichedCompanies = await Promise.all(
      companies.map(company => enrichCompanyWithStats(company))
    );

    res.json({
      success: true,
      message: 'Active companies retrieved successfully',
      data: enrichedCompanies,
      count: enrichedCompanies.length
    });
  } catch (error) {
    console.error('❌ GET /companies/active error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active companies',
      error: error.message
    });
  }
});

// ===== GET - إحصائيات الشركات =====
router.get('/stats/global', checkPermissions([PERMISSIONS.COMPANIES_VIEW]), async (req, res) => {
  try {
    const total = await Company.countDocuments({ deletedAt: null });
    const active = await Company.countDocuments({ status: 'active', deletedAt: null });
    const inactive = await Company.countDocuments({ status: 'inactive', deletedAt: null });
    const suspended = await Company.countDocuments({ status: 'suspended', deletedAt: null });
    const archived = await Company.countDocuments({ status: 'archived', deletedAt: null });

    // حساب إجمالي المصانع والمستخدمين عبر جميع الشركات
    const Factory = require('../../factories/models/Factory.model');
    const User = require('../../users/models/User.model');

    const [totalFactories, totalUsers] = await Promise.all([
      Factory.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: null })
    ]);

    res.json({
      success: true,
      message: 'Company statistics retrieved successfully',
      data: {
        total,
        active,
        inactive,
        suspended,
        archived,
        totalFactories,
        totalUsers
      }
    });
  } catch (error) {
    console.error('❌ GET /companies/stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

// ===== POST - إنشاء شركة جديدة =====
router.post('/', checkPermissions([PERMISSIONS.COMPANIES_CREATE]), async (req, res) => {
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

    // ✅ إنشاء companyId تلقائي (بدل الاعتماد على الـ Request)
    const companyId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

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
      status: 'active',
      companyId: companyId // ✅ companyId من السيرفر مش من الـ Request
    });

    const savedCompany = await newCompany.save();

    // ✅ إرجاع الشركة مع الإحصائيات
    const enrichedCompany = await enrichCompanyWithStats(savedCompany);

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: enrichedCompany
    });
  } catch (error) {
    console.error('❌ Error creating company:', error);
    
    // معالجة أخطاء MongoDB
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key error. Company code or name already exists.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ===== PUT - تحديث شركة =====
router.put('/:id', checkPermissions([PERMISSIONS.COMPANIES_UPDATE]), async (req, res) => {
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

    // إرجاع الشركة مع الإحصائيات
    const enrichedCompany = await enrichCompanyWithStats(updatedCompany);

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: enrichedCompany
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

// ===== PUT - تحديث حالة الشركة =====
router.put('/:id/status', checkPermissions([PERMISSIONS.COMPANIES_UPDATE]), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    company.status = status;
    company.updatedAt = new Date();
    const updatedCompany = await company.save();

    res.json({
      success: true,
      message: `Company status updated to ${status} successfully`,
      data: updatedCompany
    });
  } catch (error) {
    console.error('❌ Error updating company status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company status',
      error: error.message
    });
  }
});

// ===== DELETE - حذف شركة (Soft Delete) =====
router.delete('/:id', checkPermissions([PERMISSIONS.COMPANIES_DELETE]), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // التحقق من عدم وجود بيانات مرتبطة
    const stats = await getCompanyWithStats(company._id);
    if (stats.totalFactories > 0 || stats.totalUsers > 0 || stats.totalSensors > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete company with active data. Please delete all associated data first.',
        data: {
          totalFactories: stats.totalFactories,
          totalUsers: stats.totalUsers,
          totalSensors: stats.totalSensors
        }
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
        status: 'archived',
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

module.exports = router;