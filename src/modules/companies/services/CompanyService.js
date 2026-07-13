 
const BaseService = require('../../../core/base/BaseService');
const CompanyRepository = require('../repositories/CompanyRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');
const { PERMISSIONS, hasPermission } = require('../../../core/middleware/permissions');

/**
 * خدمة الشركات - مسؤول عن منطق الأعمال المتعلق بالشركات
 */
class CompanyService extends BaseService {
  constructor() {
    super(new CompanyRepository(), 'Company');
    this.repository = this.repository; // Type cast
  }

  // ============ CREATE ============

  /**
   * إنشاء شركة جديدة
   */
  async createCompany(data, userId) {
    try {
      // 1. التحقق من الحقول المطلوبة
      this.validateRequiredFields(data, ['name', 'code', 'industry', 'contactEmail']);

      // 2. التحقق من عدم وجود شركة بنفس الاسم
      const existingName = await this.repository.findByName(data.name);
      if (existingName) {
        throw new ConflictError('Company with this name already exists');
      }

      // 3. التحقق من عدم وجود شركة بنفس الكود
      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        throw new ConflictError('Company with this code already exists');
      }

      // 4. تحضير بيانات الشركة
      const companyData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        status: 'active',
        verified: false
      };

      // 5. إضافة إعدادات افتراضية
      if (!companyData.settings) {
        companyData.settings = {
          defaultLanguage: 'en',
          defaultTimezone: 'UTC',
          defaultCurrency: 'USD',
          notificationPreferences: {
            email: true,
            sms: false,
            push: true,
            inApp: true
          },
          reportingSettings: {
            reportFormat: 'pdf',
            autoGenerateReports: false,
            reportFrequency: 'monthly',
            reportRecipients: []
          },
          dataRetention: {
            sensorDataDays: 365,
            auditLogDays: 180,
            reportDays: 730,
            alertDays: 90
          },
          securitySettings: {
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: true,
              expiryDays: 90
            },
            sessionTimeout: 480,
            maxLoginAttempts: 5,
            twoFactorRequired: false
          }
        };
      }

      // 6. إضافة اشتراك افتراضي
      if (!companyData.subscription) {
        companyData.subscription = {
          plan: 'free',
          status: 'active',
          startDate: new Date(),
          features: {
            maxUsers: 5,
            maxFactories: 1,
            maxDepartments: 5,
            maxMachines: 10,
            maxSensors: 20,
            maxStorage: 1024,
            maxApiCalls: 10000,
            dataRetentionDays: 90,
            analyticsEnabled: false,
            aiEnabled: false,
            apiAccess: false,
            advancedReports: false,
            customBranding: false,
            prioritySupport: false,
            ssoEnabled: false,
            auditLogs: false,
            dataExport: false
          }
        };
      }

      // 7. إنشاء الشركة
      const company = await this.repository.create(companyData);

      // 8. إرسال حدث
      eventEmitter.emit(EventTypes.COMPANY_CREATED, {
        companyId: company._id,
        name: company.name,
        code: company.code,
        createdBy: userId
      });

      // 9. تسجيل العملية
      logger.info('Company created successfully', {
        companyId: company._id,
        name: company.name,
        code: company.code,
        createdBy: userId
      });

      return company;
    } catch (error) {
      logger.error('Error creating company:', error);
      throw error;
    }
  }

  // ============ FIND ============

  /**
   * الحصول على شركة بالمعرف
   */
  async getCompanyById(id) {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    return company;
  }

  /**
   * الحصول على شركة بالكود
   */
  async getCompanyByCode(code) {
    const company = await this.repository.findByCode(code);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    return company;
  }

  /**
   * الحصول على شركة بالاسم
   */
  async getCompanyByName(name) {
    const company = await this.repository.findByName(name);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    return company;
  }

  /**
   * الحصول على قائمة الشركات
   */
  async getCompanies(filter = {}, options = {}) {
    return this.repository.find(filter, null, options);
  }

  /**
   * الحصول على قائمة الشركات مع Pagination
   */
  async getCompaniesPaginated(page, limit, filter = {}) {
    return this.repository.paginate(filter, null, page, limit);
  }

  /**
   * الحصول على شركات حسب الصناعة
   */
  async getCompaniesByIndustry(industry) {
    return this.repository.findByIndustry(industry);
  }

  /**
   * الحصول على شركات حسب البلد
   */
  async getCompaniesByCountry(country) {
    return this.repository.findByCountry(country);
  }

  /**
   * الحصول على الشركات النشطة
   */
  async getActiveCompanies() {
    return this.repository.findActive();
  }

  /**
   * البحث عن الشركات
   */
  async searchCompanies(query) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query);
  }

  /**
   * الحصول على شركات ذات ESG عالية
   */
  async getHighESGCompanies(minScore = 70) {
    return this.repository.findHighESGCompanies(minScore);
  }

  /**
   * الحصول على شركات تستخدم إضافة معينة
   */
  async getCompaniesByPlugin(pluginName) {
    return this.repository.findByPlugin(pluginName);
  }

  // ============ UPDATE ============

  /**
   * تحديث شركة
   */
  async updateCompany(id, data, userId) {
    try {
      // 1. التحقق من وجود الشركة
      const existingCompany = await this.repository.findById(id);
      if (!existingCompany) {
        throw new NotFoundError('Company not found');
      }

      // 2. التحقق من الصلاحيات
      if (!this.canManageCompany(userId, existingCompany)) {
        throw new ForbiddenError('You do not have permission to update this company');
      }

      // 3. الحقول المسموح بتحديثها
      const allowedUpdates = [
        'name', 'industry', 'industrySubtype', 'description',
        'website', 'logo', 'coverImage', 'contactEmail', 'contactPhone',
        'contactPerson', 'alternativeContacts', 'address',
        'timezone', 'currency', 'language', 'settings',
        'esg', 'branding', 'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      // 4. التحقق من عدم وجود اسم مكرر
      if (data.name && data.name !== existingCompany.name) {
        const nameExists = await this.repository.findByName(data.name);
        if (nameExists && nameExists._id !== id) {
          throw new ConflictError('Company with this name already exists');
        }
        updateData.name = data.name;
      }

      // 5. التحقق من عدم وجود كود مكرر
      if (data.code && data.code.toUpperCase() !== existingCompany.code) {
        const codeExists = await this.repository.findByCode(data.code);
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Company with this code already exists');
        }
        updateData.code = data.code.toUpperCase();
      }

      // 6. إضافة المستخدم الحالي كمحرر
      updateData.updatedBy = userId;

      // 7. تحديث الشركة
      const updatedCompany = await this.repository.update(id, updateData);

      // 8. إرسال حدث
      eventEmitter.emit(EventTypes.COMPANY_UPDATED, {
        companyId: updatedCompany._id,
        name: updatedCompany.name,
        updatedBy: userId
      });

      // 9. تسجيل العملية
      logger.info('Company updated successfully', {
        companyId: updatedCompany._id,
        name: updatedCompany.name,
        updatedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error updating company:', error);
      throw error;
    }
  }

  /**
   * تحديث اشتراك الشركة
   */
  async updateSubscription(id, plan, features, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to update this company\'s subscription');
      }

      // تحديث الاشتراك
      const updatedCompany = await this.repository.updateSubscriptionPlan(id, plan, features);

      // تسجيل العملية
      logger.info('Company subscription updated', {
        companyId: id,
        plan,
        features,
        updatedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * تمديد اشتراك الشركة
   */
  async extendSubscription(id, endDate, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to extend this company\'s subscription');
      }

      // تمديد الاشتراك
      const updatedCompany = await this.repository.extendSubscription(id, endDate);

      logger.info('Company subscription extended', {
        companyId: id,
        endDate,
        updatedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error extending subscription:', error);
      throw error;
    }
  }

  /**
   * تحديث بيانات ESG
   */
  async updateESG(id, esgData, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to update this company\'s ESG data');
      }

      // تحديث ESG
      const updatedCompany = await this.repository.updateESGData(id, esgData);

      // إرسال حدث
      eventEmitter.emit('company.esg.updated', {
        companyId: id,
        esg: esgData,
        updatedBy: userId
      });

      logger.info('Company ESG updated', {
        companyId: id,
        esgScore: updatedCompany.esg.sustainabilityScore,
        esgRating: updatedCompany.esg.esgRating,
        updatedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error updating ESG:', error);
      throw error;
    }
  }

  /**
   * تفعيل شركة
   */
  async verifyCompany(id, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to verify this company');
      }

      const updatedCompany = await this.repository.verifyCompany(id, userId);

      logger.info('Company verified', {
        companyId: id,
        name: company.name,
        verifiedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error verifying company:', error);
      throw error;
    }
  }

  /**
   * إلغاء تفعيل شركة
   */
  async unverifyCompany(id, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to unverify this company');
      }

      const updatedCompany = await this.repository.unverifyCompany(id);

      logger.info('Company unverified', {
        companyId: id,
        name: company.name,
        unverifiedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error unverifying company:', error);
      throw error;
    }
  }

  /**
   * تحديث حالة الشركة
   */
  async updateStatus(id, status, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to update this company\'s status');
      }

      const updatedCompany = await this.repository.updateStatus(id, status);

      logger.info('Company status updated', {
        companyId: id,
        oldStatus: company.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  // ============ PLUGIN MANAGEMENT ============

  /**
   * تفعيل إضافة للشركة
   */
  async enablePlugin(id, pluginName, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to enable plugins for this company');
      }

      // التحقق من وجود الإضافة
      const availablePlugins = ['carbon', 'heatRecovery', 'industrialExchange', 'solar', 'rainWater', 'digitalTwin', 'esg', 'gamification'];
      if (!availablePlugins.includes(pluginName)) {
        throw new ValidationError('Plugin not found');
      }

      // التحقق من أن الإضافة غير مفعلة بالفعل
      if (company.activePlugins.includes(pluginName)) {
        throw new ConflictError('Plugin already enabled');
      }

      const updatedCompany = await this.repository.enablePlugin(id, pluginName);

      // إرسال حدث
      eventEmitter.emit(EventTypes.PLUGIN_ENABLED, {
        companyId: id,
        pluginName,
        enabledBy: userId
      });

      logger.info('Plugin enabled for company', {
        companyId: id,
        pluginName,
        enabledBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error enabling plugin:', error);
      throw error;
    }
  }

  /**
   * تعطيل إضافة للشركة
   */
  async disablePlugin(id, pluginName, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to disable plugins for this company');
      }

      // التحقق من أن الإضافة مفعلة
      if (!company.activePlugins.includes(pluginName)) {
        throw new ConflictError('Plugin is not enabled');
      }

      const updatedCompany = await this.repository.disablePlugin(id, pluginName);

      // إرسال حدث
      eventEmitter.emit(EventTypes.PLUGIN_DISABLED, {
        companyId: id,
        pluginName,
        disabledBy: userId
      });

      logger.info('Plugin disabled for company', {
        companyId: id,
        pluginName,
        disabledBy: userId
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Error disabling plugin:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  /**
   * حذف شركة (Soft Delete)
   */
  async deleteCompany(id, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to delete this company');
      }

      // التحقق من عدم وجود بيانات مرتبطة
      const stats = await this.repository.getCompanyStats(id);
      if (stats && (stats.statistics?.totalFactories > 0 || 
                    stats.statistics?.totalUsers > 0 || 
                    stats.statistics?.totalSensors > 0)) {
        throw new ValidationError('Cannot delete company with active data. Please delete all associated data first.');
      }

      // حذف الشركة
      await this.repository.softDelete(id);

      // إرسال حدث
      eventEmitter.emit(EventTypes.COMPANY_DELETED, {
        companyId: id,
        name: company.name,
        deletedBy: userId
      });

      logger.info('Company deleted successfully', {
        companyId: id,
        name: company.name,
        deletedBy: userId
      });

      return { message: 'Company deleted successfully' };
    } catch (error) {
      logger.error('Error deleting company:', error);
      throw error;
    }
  }

  /**
   * حذف شركة نهائياً (Hard Delete)
   */
  async hardDeleteCompany(id, userId) {
    try {
      const company = await this.repository.findById(id);
      if (!company) {
        throw new NotFoundError('Company not found');
      }

      // التحقق من الصلاحيات
      if (!this.canManageCompany(userId, company)) {
        throw new ForbiddenError('You do not have permission to delete this company');
      }

      // حذف الشركة نهائياً
      await this.repository.delete(id);

      logger.info('Company permanently deleted', {
        companyId: id,
        name: company.name,
        deletedBy: userId
      });

      return { message: 'Company permanently deleted' };
    } catch (error) {
      logger.error('Error hard deleting company:', error);
      throw error;
    }
  }

  // ============ STATISTICS ============

  /**
   * الحصول على إحصائيات الشركة
   */
  async getCompanyStats(id) {
    const stats = await this.repository.getCompanyStats(id);
    if (!stats) {
      throw new NotFoundError('Company not found');
    }
    return stats;
  }

  /**
   * الحصول على إحصائيات عامة للشركات
   */
  async getGlobalStats() {
    return this.repository.getGlobalStats();
  }

  /**
   * الحصول على توزيع الشركات حسب الصناعة
   */
  async getIndustryDistribution() {
    return this.repository.getIndustryDistribution();
  }

  /**
   * الحصول على توزيع الشركات حسب البلد
   */
  async getCountryDistribution() {
    return this.repository.getCountryDistribution();
  }

  /**
   * الحصول على توزيع الشركات حسب خطة الاشتراك
   */
  async getSubscriptionDistribution() {
    return this.repository.getSubscriptionDistribution();
  }

  /**
   * الحصول على توزيع الشركات حسب تصنيف ESG
   */
  async getESGRatingDistribution() {
    return this.repository.getESGRatingDistribution();
  }

  /**
   * الحصول على أفضل الشركات حسب ESG
   */
  async getTopESGCompanies(limit = 10) {
    return this.repository.getTopESGCompanies(limit);
  }

  /**
   * الحصول على إحصائيات الاشتراكات
   */
  async getSubscriptionStats() {
    return this.repository.getSubscriptionStats();
  }

  // ============ SEARCH ============

  /**
   * البحث المتقدم مع التصفية
   */
  async findWithFilters(filters = {}) {
    return this.repository.findWithFilters(filters);
  }

  // ============ EXPORT ============

  /**
   * تصدير الشركات
   */
  async exportCompanies(format = 'json', filters = {}) {
    return this.repository.exportCompanies(format, filters);
  }

  // ============ VALIDATION ============

  /**
   * التحقق من صلاحية إدارة شركة
   */
  canManageCompany(userId, company) {
    // TODO: التحقق من صلاحيات المستخدم
    // هنا نفترض أن المستخدم لديه صلاحيات كافية
    // يمكن إضافة منطق أكثر تعقيداً هنا
    return true;
  }

  /**
   * التحقق من صحة الشركة
   */
  async validateCompany(id) {
    const company = await this.repository.findById(id);
    if (!company || company.status !== 'active' || company.deletedAt) {
      throw new ForbiddenError('Company not found or inactive');
    }
    return company;
  }

  /**
   * التحقق من صحة الاشتراك
   */
  async validateSubscription(id) {
    const company = await this.repository.findById(id);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    
    if (!company.isSubscriptionValid()) {
      throw new ForbiddenError('Company subscription is not active');
    }
    
    return company;
  }

  // ============ DASHBOARD ============

  /**
   * الحصول على بيانات لوحة التحكم للشركة
   */
  async getCompanyDashboard(id) {
    const stats = await this.getCompanyStats(id);
    const company = await this.getCompanyById(id);
    
    return {
      company: {
        id: company._id,
        name: company.name,
        code: company.code,
        industry: company.industry,
        logo: company.logo,
        verified: company.verified
      },
      statistics: {
        factories: stats.statistics?.totalFactories || 0,
        departments: stats.statistics?.totalDepartments || 0,
        machines: stats.statistics?.totalMachines || 0,
        sensors: stats.statistics?.totalSensors || 0,
        users: stats.statistics?.totalUsers || 0,
        readings: stats.statistics?.totalReadings || 0,
        alerts: stats.statistics?.totalAlerts || 0,
        reports: stats.statistics?.totalReports || 0,
        carbonSaved: stats.statistics?.totalCarbonSaved || 0,
        energySaved: stats.statistics?.totalEnergySaved || 0,
        waterSaved: stats.statistics?.totalWaterSaved || 0,
        wasteReduced: stats.statistics?.totalWasteReduced || 0
      },
      subscription: {
        plan: company.subscription.plan,
        status: company.subscription.status,
        endDate: company.subscription.endDate,
        features: company.subscription.features
      },
      esg: {
        sustainabilityScore: company.esg.sustainabilityScore,
        esgRating: company.esg.esgRating,
        carbonReductionGoal: company.esg.carbonReductionGoal,
        waterReductionGoal: company.esg.waterReductionGoal,
        wasteReductionGoal: company.esg.wasteReductionGoal,
        energyEfficiencyGoal: company.esg.energyEfficiencyGoal
      },
      plugins: company.activePlugins,
      createdAt: company.createdAt,
      status: company.status
    };
  }
}

module.exports = CompanyService;