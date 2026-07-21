const BaseController = require('../../../core/base/BaseController');
const CompanyService = require('../services/CompanyService');
const {
  sendResponse,
  sendError,
  sendPaginatedResponse,
  sendCreated,
  sendDeleted,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError
} = require('../../../core/utils/response');
const { validate } = require('../../../core/middleware/validation');
const {
  createCompanySchema,
  updateCompanySchema,
  idSchema,
  paginationSchema,
  searchSchema,
  generalFilterSchema
} = require('../../../core/middleware/validation');
const { PERMISSIONS, checkPermissions, checkRole } = require('../../../core/middleware/permissions');
const logger = require('../../../core/utils/logger');
const Joi = require('joi');

// ============ SCHEMAS ============

// Schema لتحديث الاشتراك
const updateSubscriptionSchema = Joi.object({
  plan: Joi.string().valid('free', 'basic', 'professional', 'enterprise', 'custom').required(),
  features: Joi.object({
    maxUsers: Joi.number().integer().min(1),
    maxFactories: Joi.number().integer().min(1),
    maxDepartments: Joi.number().integer().min(1),
    maxMachines: Joi.number().integer().min(1),
    maxSensors: Joi.number().integer().min(1),
    maxStorage: Joi.number().integer().min(100),
    maxApiCalls: Joi.number().integer().min(1000),
    dataRetentionDays: Joi.number().integer().min(7),
    analyticsEnabled: Joi.boolean(),
    aiEnabled: Joi.boolean(),
    apiAccess: Joi.boolean(),
    advancedReports: Joi.boolean(),
    customBranding: Joi.boolean(),
    prioritySupport: Joi.boolean(),
    ssoEnabled: Joi.boolean(),
    auditLogs: Joi.boolean(),
    dataExport: Joi.boolean()
  }).required()
});

// Schema لتمديد الاشتراك
const extendSubscriptionSchema = Joi.object({
  endDate: Joi.date().iso().greater('now').required()
});

// Schema لتحديث ESG
const updateESGSchema = Joi.object({
  carbonReductionGoal: Joi.number().min(0).max(100),
  waterReductionGoal: Joi.number().min(0).max(100),
  wasteReductionGoal: Joi.number().min(0).max(100),
  energyEfficiencyGoal: Joi.number().min(0).max(100),
  renewableEnergyTarget: Joi.number().min(0).max(100),
  employeeCount: Joi.number().integer().min(0),
  safetyScore: Joi.number().min(0).max(100),
  communityEngagement: Joi.number().min(0).max(100),
  sustainabilityScore: Joi.number().min(0).max(100),
  certifications: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    issuer: Joi.string().required(),
    dateIssued: Joi.date().iso(),
    dateExpires: Joi.date().iso(),
    verificationUrl: Joi.string().uri(),
    status: Joi.string().valid('active', 'expired', 'pending')
  })),
  compliance: Joi.array().items(Joi.object({
    standard: Joi.string().required(),
    status: Joi.string().valid('compliant', 'non-compliant', 'pending'),
    lastAuditDate: Joi.date().iso(),
    nextAuditDate: Joi.date().iso()
  }))
});

// Schema لتحديث الحالة
const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended', 'archived').required()
});

// Schema للإضافات
const pluginActionSchema = Joi.object({
  pluginName: Joi.string().valid(
    'carbon', 'heatRecovery', 'industrialExchange', 'solar',
    'rainWater', 'digitalTwin', 'esg', 'gamification'
  ).required()
});

// Schema للتصدير
const exportSchema = Joi.object({
  format: Joi.string().valid('json', 'csv').default('json'),
  industry: Joi.string(),
  country: Joi.string(),
  status: Joi.string().valid('active', 'inactive', 'suspended')
});

// Schema للحذف
const deleteCompanySchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

// ============ CONTROLLER ============

/**
 * متحكم الشركات - مسؤول عن معالجة طلبات API المتعلقة بالشركات
 */
class CompanyController extends BaseController {
  constructor() {
    super(new CompanyService(), 'Company');
    this.service = this.service; // Type cast
  }

  // ============ CREATE ============

  /**
   * إنشاء شركة جديدة
   * POST /api/v1/companies
   */
  async create(req, res) {
    try {
      const { user } = req;
      const result = await this.service.createCompany(req.body, user.id);
      return sendCreated(res, 'Company created successfully', result);
    } catch (error) {
      logger.error('Create company error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ FIND ============

  /**
   * الحصول على قائمة الشركات مع إحصائيات محسوبة
   * GET /api/v1/companies
   */
  async getList(req, res) {
    try {
      const { page, limit, ...filter } = req.query;
      
      const result = await this.service.getCompaniesPaginated(
        parseInt(page) || 1,
        parseInt(limit) || 10,
        filter
      );
      
      return sendPaginatedResponse(
        res,
        'Companies retrieved successfully',
        result.data,
        result.meta
      );
    } catch (error) {
      logger.error('Get companies list error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على شركة بالمعرف مع إحصائيات محسوبة
   * GET /api/v1/companies/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getCompanyWithStats(id);
      return sendResponse(res, 200, 'Company retrieved successfully', result);
    } catch (error) {
      logger.error('Get company by id error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على شركة بالكود
   * GET /api/v1/companies/code/:code
   */
  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const result = await this.service.getCompanyByCode(code);
      return sendResponse(res, 200, 'Company retrieved successfully', result);
    } catch (error) {
      logger.error('Get company by code error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على شركات حسب الصناعة
   * GET /api/v1/companies/industry/:industry
   */
  async getByIndustry(req, res) {
    try {
      const { industry } = req.params;
      const result = await this.service.getCompaniesByIndustry(industry);
      return sendResponse(res, 200, 'Companies retrieved successfully', result);
    } catch (error) {
      logger.error('Get companies by industry error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على شركات حسب البلد
   * GET /api/v1/companies/country/:country
   */
  async getByCountry(req, res) {
    try {
      const { country } = req.params;
      const result = await this.service.getCompaniesByCountry(country);
      return sendResponse(res, 200, 'Companies retrieved successfully', result);
    } catch (error) {
      logger.error('Get companies by country error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على الشركات النشطة
   * GET /api/v1/companies/active
   */
  async getActive(req, res) {
    try {
      const result = await this.service.getActiveCompanies();
      return sendResponse(res, 200, 'Active companies retrieved successfully', result);
    } catch (error) {
      logger.error('Get active companies error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على شركات ذات ESG عالية
   * GET /api/v1/companies/top-esg
   */
  async getTopESG(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const minScore = parseInt(req.query.minScore) || 70;
      const result = await this.service.getHighESGCompanies(minScore);
      return sendResponse(res, 200, 'Top ESG companies retrieved successfully', result.slice(0, limit));
    } catch (error) {
      logger.error('Get top ESG companies error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * البحث عن الشركات
   * GET /api/v1/companies/search
   */
  async search(req, res) {
    try {
      const { query } = req.query;
      const result = await this.service.searchCompanies(query);
      return sendResponse(res, 200, 'Companies found successfully', result);
    } catch (error) {
      logger.error('Search companies error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ UPDATE ============

  /**
   * تحديث شركة
   * PUT /api/v1/companies/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const result = await this.service.updateCompany(id, req.body, user.id);
      return sendResponse(res, 200, 'Company updated successfully', result);
    } catch (error) {
      logger.error('Update company error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث اشتراك الشركة
   * PUT /api/v1/companies/:id/subscription
   */
  async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const { plan, features } = req.body;
      const result = await this.service.updateSubscription(id, plan, features, user.id);
      return sendResponse(res, 200, 'Subscription updated successfully', result);
    } catch (error) {
      logger.error('Update subscription error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تمديد اشتراك الشركة
   * POST /api/v1/companies/:id/subscription/extend
   */
  async extendSubscription(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const { endDate } = req.body;
      const result = await this.service.extendSubscription(id, endDate, user.id);
      return sendResponse(res, 200, 'Subscription extended successfully', result);
    } catch (error) {
      logger.error('Extend subscription error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث بيانات ESG
   * PUT /api/v1/companies/:id/esg
   */
  async updateESG(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const result = await this.service.updateESG(id, req.body, user.id);
      return sendResponse(res, 200, 'ESG data updated successfully', result);
    } catch (error) {
      logger.error('Update ESG error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تحديث حالة الشركة
   * PUT /api/v1/companies/:id/status
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const { status } = req.body;
      const result = await this.service.updateStatus(id, status, user.id);
      return sendResponse(res, 200, 'Company status updated successfully', result);
    } catch (error) {
      logger.error('Update status error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تفعيل شركة
   * POST /api/v1/companies/:id/verify
   */
  async verify(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const result = await this.service.verifyCompany(id, user.id);
      return sendResponse(res, 200, 'Company verified successfully', result);
    } catch (error) {
      logger.error('Verify company error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * إلغاء تفعيل شركة
   * POST /api/v1/companies/:id/unverify
   */
  async unverify(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const result = await this.service.unverifyCompany(id, user.id);
      return sendResponse(res, 200, 'Company unverified successfully', result);
    } catch (error) {
      logger.error('Unverify company error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ PLUGIN MANAGEMENT ============

  /**
   * تفعيل إضافة للشركة
   * POST /api/v1/companies/:id/plugins
   */
  async enablePlugin(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const { pluginName } = req.body;
      const result = await this.service.enablePlugin(id, pluginName, user.id);
      return sendResponse(res, 200, 'Plugin enabled successfully', result);
    } catch (error) {
      logger.error('Enable plugin error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * تعطيل إضافة للشركة
   * DELETE /api/v1/companies/:id/plugins
   */
  async disablePlugin(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const { pluginName } = req.body;
      const result = await this.service.disablePlugin(id, pluginName, user.id);
      return sendResponse(res, 200, 'Plugin disabled successfully', result);
    } catch (error) {
      logger.error('Disable plugin error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DELETE ============

  /**
   * حذف شركة (Soft Delete)
   * DELETE /api/v1/companies/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const result = await this.service.deleteCompany(id, user.id);
      return sendDeleted(res, 'Company deleted successfully');
    } catch (error) {
      logger.error('Delete company error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * حذف شركة نهائياً (Hard Delete)
   * DELETE /api/v1/companies/:id/permanent
   */
  async hardDelete(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const result = await this.service.hardDeleteCompany(id, user.id);
      return sendDeleted(res, 'Company permanently deleted');
    } catch (error) {
      logger.error('Hard delete company error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ STATISTICS ============

  /**
   * الحصول على إحصائيات الشركة
   * GET /api/v1/companies/:id/stats
   */
  async getStats(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getCompanyStats(id);
      return sendResponse(res, 200, 'Company statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get company stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على إحصائيات عامة للشركات
   * GET /api/v1/companies/stats/global
   */
  async getGlobalStats(req, res) {
    try {
      const result = await this.service.getGlobalStats();
      return sendResponse(res, 200, 'Global statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get global stats error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على توزيع الشركات حسب الصناعة
   * GET /api/v1/companies/distribution/industry
   */
  async getIndustryDistribution(req, res) {
    try {
      const result = await this.service.getIndustryDistribution();
      return sendResponse(res, 200, 'Industry distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get industry distribution error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على توزيع الشركات حسب البلد
   * GET /api/v1/companies/distribution/country
   */
  async getCountryDistribution(req, res) {
    try {
      const result = await this.service.getCountryDistribution();
      return sendResponse(res, 200, 'Country distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get country distribution error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على توزيع الشركات حسب خطة الاشتراك
   * GET /api/v1/companies/distribution/subscription
   */
  async getSubscriptionDistribution(req, res) {
    try {
      const result = await this.service.getSubscriptionDistribution();
      return sendResponse(res, 200, 'Subscription distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get subscription distribution error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على توزيع الشركات حسب تصنيف ESG
   * GET /api/v1/companies/distribution/esg
   */
  async getESGRatingDistribution(req, res) {
    try {
      const result = await this.service.getESGRatingDistribution();
      return sendResponse(res, 200, 'ESG rating distribution retrieved successfully', result);
    } catch (error) {
      logger.error('Get ESG rating distribution error:', error);
      return this.handleError(res, error);
    }
  }

  /**
   * الحصول على إحصائيات الاشتراكات
   * GET /api/v1/companies/stats/subscription
   */
  async getSubscriptionStats(req, res) {
    try {
      const result = await this.service.getSubscriptionStats();
      return sendResponse(res, 200, 'Subscription statistics retrieved successfully', result);
    } catch (error) {
      logger.error('Get subscription stats error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ DASHBOARD ============

  /**
   * الحصول على لوحة التحكم للشركة
   * GET /api/v1/companies/:id/dashboard
   */
  async getDashboard(req, res) {
    try {
      const { id } = req.params;
      const result = await this.service.getCompanyDashboard(id);
      return sendResponse(res, 200, 'Company dashboard retrieved successfully', result);
    } catch (error) {
      logger.error('Get company dashboard error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ SEARCH ============

  /**
   * البحث المتقدم مع التصفية
   * GET /api/v1/companies/filter
   */
  async filter(req, res) {
    try {
      const filters = req.query;
      const result = await this.service.findWithFilters(filters);
      return sendPaginatedResponse(
        res,
        'Companies filtered successfully',
        result.data,
        result.meta
      );
    } catch (error) {
      logger.error('Filter companies error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ EXPORT ============

  /**
   * تصدير الشركات
   * GET /api/v1/companies/export
   */
  async export(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;
      
      const data = await this.service.exportCompanies(format, filters);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=companies.csv');
        return res.send(data);
      }
      
      return sendResponse(res, 200, 'Companies exported successfully', data);
    } catch (error) {
      logger.error('Export companies error:', error);
      return this.handleError(res, error);
    }
  }

  // ============ ERROR HANDLER ============

  /**
   * معالجة الأخطاء بشكل موحد
   */
  handleError(res, error) {
    switch (error.constructor.name) {
      case 'ValidationError':
        return sendValidationError(res, error.message, error.errors);
      case 'NotFoundError':
        return sendNotFound(res, error.message);
      case 'ConflictError':
        return sendConflict(res, error.message);
      case 'UnauthorizedError':
        return sendUnauthorized(res, error.message);
      case 'ForbiddenError':
        return sendForbidden(res, error.message);
      default:
        return sendError(res, error.statusCode || 500, error.message);
    }
  }
}

module.exports = CompanyController;