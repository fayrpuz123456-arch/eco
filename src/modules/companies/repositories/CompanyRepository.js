const BaseRepository = require('../../../core/base/BaseRepository');
const Company = require('../models/Company.model');
const { NotFoundError } = require('../../../core/middleware/errorHandler');
const logger = require('../../../core/utils/logger');

/**
 * مستودع الشركات - مسؤول عن جميع عمليات قاعدة البيانات المتعلقة بالشركات
 */
class CompanyRepository extends BaseRepository {
  constructor() {
    super(Company);
    this.model = Company;
  }

  // ============ FIND METHODS ============

  /**
   * البحث عن شركة بالكود
   */
  async findByCode(code) {
    return this.model.findOne({ 
      code: code.toUpperCase(), 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركة بالاسم
   */
  async findByName(name) {
    return this.model.findOne({ 
      name: name.trim(), 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات حسب الصناعة
   */
  async findByIndustry(industry) {
    return this.model.find({ 
      industry, 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات حسب البلد
   */
  async findByCountry(country) {
    return this.model.find({ 
      'address.country': country, 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات حسب المدينة
   */
  async findByCity(city) {
    return this.model.find({ 
      'address.city': city, 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات نشطة
   */
  async findActive() {
    return this.model.find({ 
      status: 'active', 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات غير نشطة
   */
  async findInactive() {
    return this.model.find({ 
      status: { $in: ['inactive', 'suspended'] }, 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات حسب خطة الاشتراك
   */
  async findBySubscriptionPlan(plan) {
    return this.model.find({ 
      'subscription.plan': plan, 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات حسب حالة الاشتراك
   */
  async findBySubscriptionStatus(status) {
    return this.model.find({ 
      'subscription.status': status, 
      deletedAt: null 
    });
  }

  /**
   * البحث عن شركات ذات اشتراكات منتهية قريباً
   */
  async findExpiringSubscriptions(daysBeforeExpiry) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);
    
    return this.model.find({
      'subscription.endDate': { $lte: expiryDate },
      'subscription.status': { $ne: 'expired' },
      'subscription.status': { $ne: 'cancelled' },
      deletedAt: null
    });
  }

  /**
   * البحث عن شركات ذات اشتراكات منتهية
   */
  async findExpiredSubscriptions() {
    const now = new Date();
    
    return this.model.find({
      'subscription.endDate': { $lt: now },
      'subscription.status': { $ne: 'expired' },
      'subscription.status': { $ne: 'cancelled' },
      deletedAt: null
    });
  }

  /**
   * البحث عن شركات ذات ESG عالية
   */
  async findHighESGCompanies(minScore = 70) {
    return this.model.find({
      'esg.sustainabilityScore': { $gte: minScore },
      deletedAt: null
    }).sort({ 'esg.sustainabilityScore': -1 });
  }

  /**
   * البحث عن شركات حسب تصنيف ESG
   */
  async findByESGRating(rating) {
    return this.model.find({
      'esg.esgRating': rating,
      deletedAt: null
    });
  }

  /**
   * البحث عن شركات تستخدم إضافة معينة
   */
  async findByPlugin(pluginName) {
    return this.model.find({
      activePlugins: pluginName,
      deletedAt: null
    });
  }

  /**
   * البحث عن شركات مفعلة
   */
  async findVerified() {
    return this.model.find({
      verified: true,
      deletedAt: null
    });
  }

  /**
   * البحث عن شركات غير مفعلة
   */
  async findUnverified() {
    return this.model.find({
      verified: false,
      deletedAt: null
    });
  }

  /**
   * البحث عن شركات حسب الوسم (Tag)
   */
  async findByTag(tag) {
    return this.model.find({
      tags: tag,
      deletedAt: null
    });
  }

  /**
   * البحث النصي
   */
  async search(searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.model.find({
      deletedAt: null,
      $or: [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { industry: searchRegex },
        { 'address.city': searchRegex },
        { 'address.country': searchRegex },
        { contactEmail: searchRegex },
        { 'address.formattedAddress': searchRegex }
      ]
    });
  }

  // ============ COUNT METHODS ============

  /**
   * حساب عدد الشركات حسب الصناعة
   */
  async countByIndustry(industry) {
    return this.model.countDocuments({
      industry,
      deletedAt: null
    });
  }

  /**
   * حساب عدد الشركات حسب البلد
   */
  async countByCountry(country) {
    return this.model.countDocuments({
      'address.country': country,
      deletedAt: null
    });
  }

  /**
   * حساب عدد الشركات حسب خطة الاشتراك
   */
  async countBySubscriptionPlan(plan) {
    return this.model.countDocuments({
      'subscription.plan': plan,
      deletedAt: null
    });
  }

  /**
   * حساب عدد الشركات النشطة
   */
  async countActive() {
    return this.model.countDocuments({
      status: 'active',
      deletedAt: null
    });
  }

  /**
   * حساب عدد الشركات المفعلة
   */
  async countVerified() {
    return this.model.countDocuments({
      verified: true,
      deletedAt: null
    });
  }

  // ============ UPDATE METHODS ============

  /**
   * تحديث خطة الاشتراك
   */
  async updateSubscriptionPlan(companyId, plan, features) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        'subscription.plan': plan,
        'subscription.features': features,
        'subscription.status': 'active',
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تحديث حالة الاشتراك
   */
  async updateSubscriptionStatus(companyId, status) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        'subscription.status': status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تمديد الاشتراك
   */
  async extendSubscription(companyId, endDate) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        'subscription.endDate': endDate,
        'subscription.status': 'active',
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تحديث بيانات ESG
   */
  async updateESGData(companyId, esgData) {
    const company = await this.model.findById(companyId);
    if (!company) return null;
    
    // دمج بيانات ESG الجديدة مع القديمة
    const updatedESG = {
      ...company.esg.toObject(),
      ...esgData
    };
    
    // حساب التصنيف تلقائياً
    if (esgData.sustainabilityScore !== undefined) {
      updatedESG.esgRating = company.calculateESGRating(esgData.sustainabilityScore);
    }
    
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        esg: updatedESG,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تفعيل شركة
   */
  async verifyCompany(companyId, verifiedBy) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        verified: true,
        verifiedAt: new Date(),
        verifiedBy,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * إلغاء تفعيل شركة
   */
  async unverifyCompany(companyId) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تحديث حالة الشركة
   */
  async updateStatus(companyId, status) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تفعيل إضافة
   */
  async enablePlugin(companyId, pluginName) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        $addToSet: { activePlugins: pluginName },
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تعطيل إضافة
   */
  async disablePlugin(companyId, pluginName) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        $pull: { activePlugins: pluginName },
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تحديث الإحصائيات
   */
  async updateStatistics(companyId, statsData) {
    const updateFields = {};
    
    Object.keys(statsData).forEach(key => {
      updateFields[`statistics.${key}`] = statsData[key];
    });
    
    updateFields['statistics.lastUpdated'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      updateFields,
      { new: true }
    );
  }

  /**
   * إضافة وثيقة تحقق
   */
  async addVerificationDocument(companyId, document) {
    return this.model.findOneAndUpdate(
      { _id: companyId, deletedAt: null },
      {
        $push: { verificationDocuments: document },
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * تحديث وثيقة تحقق
   */
  async updateVerificationDocument(companyId, documentId, status) {
    return this.model.findOneAndUpdate(
      { 
        _id: companyId, 
        deletedAt: null,
        'verificationDocuments._id': documentId 
      },
      {
        $set: {
          'verificationDocuments.$.status': status,
          'verificationDocuments.$.updatedAt': new Date()
        },
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  // ============ BULK OPERATIONS ============

  /**
   * تحديث حالة عدة شركات
   */
  async bulkUpdateStatus(companyIds, status) {
    return this.model.updateMany(
      { _id: { $in: companyIds }, deletedAt: null },
      {
        status,
        updatedAt: new Date()
      }
    );
  }

  /**
   * حذف عدة شركات (Soft Delete)
   */
  async bulkSoftDelete(companyIds, deletedBy) {
    return this.model.updateMany(
      { _id: { $in: companyIds }, deletedAt: null },
      {
        deletedAt: new Date(),
        status: 'archived',
        deletedBy,
        updatedAt: new Date()
      }
    );
  }

  /**
   * تفعيل عدة شركات
   */
  async bulkVerify(companyIds, verifiedBy) {
    return this.model.updateMany(
      { _id: { $in: companyIds }, deletedAt: null },
      {
        verified: true,
        verifiedAt: new Date(),
        verifiedBy,
        updatedAt: new Date()
      }
    );
  }

  /**
   * تفعيل إضافة لعدة شركات
   */
  async bulkEnablePlugin(companyIds, pluginName) {
    return this.model.updateMany(
      { _id: { $in: companyIds }, deletedAt: null },
      {
        $addToSet: { activePlugins: pluginName },
        updatedAt: new Date()
      }
    );
  }

  /**
   * تعطيل إضافة من عدة شركات
   */
  async bulkDisablePlugin(companyIds, pluginName) {
    return this.model.updateMany(
      { _id: { $in: companyIds }, deletedAt: null },
      {
        $pull: { activePlugins: pluginName },
        updatedAt: new Date()
      }
    );
  }

  // ============ AGGREGATION METHODS ============

  /**
   * الحصول على إحصائيات الشركة
   */
  async getCompanyStats(companyId) {
    const stats = await this.model.getStats(companyId);
    return stats;
  }

  /**
   * الحصول على إحصائيات عامة للشركات
   */
  async getGlobalStats() {
    const stats = await this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
          verified: { $sum: { $cond: ['$verified', 1, 0] } },
          unverified: { $sum: { $cond: [{ $not: ['$verified'] }, 1, 0] } },
          avgESGScore: { $avg: '$esg.sustainabilityScore' },
          avgCarbonGoal: { $avg: '$esg.carbonReductionGoal' },
          avgWaterGoal: { $avg: '$esg.waterReductionGoal' },
          avgWasteGoal: { $avg: '$esg.wasteReductionGoal' },
          totalFactories: { $sum: '$statistics.totalFactories' },
          totalUsers: { $sum: '$statistics.totalUsers' },
          totalSensors: { $sum: '$statistics.totalSensors' },
          totalReadings: { $sum: '$statistics.totalReadings' }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      verified: 0,
      unverified: 0,
      avgESGScore: 0,
      avgCarbonGoal: 0,
      avgWaterGoal: 0,
      avgWasteGoal: 0,
      totalFactories: 0,
      totalUsers: 0,
      totalSensors: 0,
      totalReadings: 0
    };
  }

  /**
   * توزيع الشركات حسب الصناعة
   */
  async getIndustryDistribution() {
    return this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$industry',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * توزيع الشركات حسب البلد
   */
  async getCountryDistribution() {
    return this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$address.country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * توزيع الشركات حسب خطة الاشتراك
   */
  async getSubscriptionDistribution() {
    return this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * توزيع الشركات حسب تصنيف ESG
   */
  async getESGRatingDistribution() {
    return this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$esg.esgRating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  /**
   * الحصول على أفضل الشركات حسب ESG
   */
  async getTopESGCompanies(limit = 10) {
    return this.model.find({
      deletedAt: null,
      'esg.sustainabilityScore': { $gt: 0 }
    })
    .sort({ 'esg.sustainabilityScore': -1 })
    .limit(limit)
    .select('name code industry esg.sustainabilityScore esg.esgRating');
  }

  /**
   * الحصول على الشركات حسب نطاق ESG
   */
  async getCompaniesByESGRange(minScore, maxScore) {
    return this.model.find({
      deletedAt: null,
      'esg.sustainabilityScore': { 
        $gte: minScore, 
        $lte: maxScore 
      }
    }).sort({ 'esg.sustainabilityScore': -1 });
  }

  /**
   * الحصول على إحصائيات الاشتراكات
   */
  async getSubscriptionStats() {
    const stats = await this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          totalCompanies: { $sum: 1 },
          activeSubscriptions: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.status', 'active'] }, 1, 0] 
            } 
          },
          trialSubscriptions: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.status', 'trial'] }, 1, 0] 
            } 
          },
          expiredSubscriptions: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.status', 'expired'] }, 1, 0] 
            } 
          },
          cancelledSubscriptions: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.status', 'cancelled'] }, 1, 0] 
            } 
          },
          freePlan: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.plan', 'free'] }, 1, 0] 
            } 
          },
          basicPlan: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.plan', 'basic'] }, 1, 0] 
            } 
          },
          professionalPlan: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.plan', 'professional'] }, 1, 0] 
            } 
          },
          enterprisePlan: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.plan', 'enterprise'] }, 1, 0] 
            } 
          },
          customPlan: { 
            $sum: { 
              $cond: [{ $eq: ['$subscription.plan', 'custom'] }, 1, 0] 
            } 
          },
          totalRevenue: { 
            $sum: { 
              $cond: [
                { $eq: ['$subscription.plan', 'professional'] }, 
                99, 
                { $cond: [{ $eq: ['$subscription.plan', 'enterprise'] }, 299, 0] }
              ] 
            } 
          }
        }
      }
    ]);
    
    return stats[0] || {
      totalCompanies: 0,
      activeSubscriptions: 0,
      trialSubscriptions: 0,
      expiredSubscriptions: 0,
      cancelledSubscriptions: 0,
      freePlan: 0,
      basicPlan: 0,
      professionalPlan: 0,
      enterprisePlan: 0,
      customPlan: 0,
      totalRevenue: 0
    };
  }

  /**
   * البحث المتقدم مع التصفية
   */
  async findWithFilters(filters = {}) {
    const query = { deletedAt: null };
    
    // تصفية حسب الصناعة
    if (filters.industry) {
      query.industry = filters.industry;
    }
    
    // تصفية حسب البلد
    if (filters.country) {
      query['address.country'] = filters.country;
    }
    
    // تصفية حسب المدينة
    if (filters.city) {
      query['address.city'] = filters.city;
    }
    
    // تصفية حسب الحالة
    if (filters.status) {
      query.status = filters.status;
    }
    
    // تصفية حسب خطة الاشتراك
    if (filters.subscriptionPlan) {
      query['subscription.plan'] = filters.subscriptionPlan;
    }
    
    // تصفية حسب حالة الاشتراك
    if (filters.subscriptionStatus) {
      query['subscription.status'] = filters.subscriptionStatus;
    }
    
    // تصفية حسب التفعل
    if (filters.verified !== undefined) {
      query.verified = filters.verified;
    }
    
    // تصفية حسب درجة ESG
    if (filters.minESGScore) {
      query['esg.sustainabilityScore'] = { 
        $gte: parseInt(filters.minESGScore) 
      };
    }
    if (filters.maxESGScore) {
      if (!query['esg.sustainabilityScore']) {
        query['esg.sustainabilityScore'] = {};
      }
      query['esg.sustainabilityScore']['$lte'] = parseInt(filters.maxESGScore);
    }
    
    // تصفية حسب تصنيف ESG
    if (filters.esgRating) {
      query['esg.esgRating'] = filters.esgRating;
    }
    
    // تصفية حسب الإضافة
    if (filters.plugin) {
      query.activePlugins = filters.plugin;
    }
    
    // تصفية حسب الوسم
    if (filters.tag) {
      query.tags = filters.tag;
    }
    
    // بحث نصي
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { contactEmail: searchRegex }
      ];
    }
    
    // تصفية حسب التاريخ
    if (filters.fromDate) {
      query.createdAt = { $gte: new Date(filters.fromDate) };
    }
    if (filters.toDate) {
      query.createdAt = { ...query.createdAt, $lte: new Date(filters.toDate) };
    }
    
    // خيارات الفرز
    const sort = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }
    
    // خيارات الصفحات
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(query)
    ]);
    
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * تصدير الشركات
   */
  async exportCompanies(format = 'json', filters = {}) {
    const query = { deletedAt: null };
    
    if (filters.industry) query.industry = filters.industry;
    if (filters.country) query['address.country'] = filters.country;
    if (filters.status) query.status = filters.status;
    
    const companies = await this.model.find(query).lean();
    
    if (format === 'csv') {
      return this.convertToCSV(companies);
    }
    
    return companies;
  }

  /**
   * تحويل الشركات إلى CSV
   */
  convertToCSV(companies) {
    if (companies.length === 0) return '';
    
    const headers = [
      'id', 'name', 'code', 'industry', 'industrySubtype',
      'contactEmail', 'contactPhone', 'city', 'country',
      'subscriptionPlan', 'subscriptionStatus',
      'esgScore', 'esgRating', 'verified',
      'createdAt', 'status'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const company of companies) {
      const row = headers.map(header => {
        let value = '';
        
        switch (header) {
          case 'id':
            value = company._id || '';
            break;
          case 'name':
            value = company.name || '';
            break;
          case 'code':
            value = company.code || '';
            break;
          case 'industry':
            value = company.industry || '';
            break;
          case 'industrySubtype':
            value = company.industrySubtype || '';
            break;
          case 'contactEmail':
            value = company.contactEmail || '';
            break;
          case 'contactPhone':
            value = company.contactPhone || '';
            break;
          case 'city':
            value = company.address?.city || '';
            break;
          case 'country':
            value = company.address?.country || '';
            break;
          case 'subscriptionPlan':
            value = company.subscription?.plan || '';
            break;
          case 'subscriptionStatus':
            value = company.subscription?.status || '';
            break;
          case 'esgScore':
            value = company.esg?.sustainabilityScore || 0;
            break;
          case 'esgRating':
            value = company.esg?.esgRating || '';
            break;
          case 'verified':
            value = company.verified ? 'true' : 'false';
            break;
          case 'createdAt':
            value = company.createdAt ? new Date(company.createdAt).toISOString().split('T')[0] : '';
            break;
          case 'status':
            value = company.status || '';
            break;
          default:
            value = '';
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

module.exports = CompanyRepository; 
