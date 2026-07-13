 
const { AppError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * المستودع الأساسي - يوفر عمليات CRUD مشتركة
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
    this.modelName = model.modelName || 'Model';
  }

  // ============ CREATE ============

  /**
   * إنشاء مستند جديد
   */
  async create(data) {
    try {
      const doc = new this.model(data);
      await doc.save();
      return doc;
    } catch (error) {
      logger.error(`Error creating ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * إنشاء مستندات متعددة
   */
  async bulkCreate(dataArray) {
    try {
      return this.model.insertMany(dataArray);
    } catch (error) {
      logger.error(`Error bulk creating ${this.modelName}:`, error);
      throw error;
    }
  }

  // ============ READ ============

  /**
   * البحث عن مستند بالمعرف
   */
  async findById(id, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOne(query);
      return doc;
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by id:`, error);
      throw error;
    }
  }

  /**
   * البحث عن مستند واحد
   */
  async findOne(filter = {}, companyId = null) {
    try {
      const query = { ...filter };
      if (companyId) query.companyId = companyId;
      
      return this.model.findOne(query);
    } catch (error) {
      logger.error(`Error finding ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * البحث عن مستندات
   */
  async find(filter = {}, companyId = null, options = {}) {
    try {
      const query = { ...filter };
      if (companyId) query.companyId = companyId;
      
      let findQuery = this.model.find(query);

      // تطبيق الفرز
      if (options.sort) {
        findQuery = findQuery.sort(options.sort);
      }
      
      // تطبيق الحد
      if (options.limit) {
        findQuery = findQuery.limit(options.limit);
      }
      
      // تطبيق التخطي
      if (options.skip) {
        findQuery = findQuery.skip(options.skip);
      }
      
      // تطبيق الحقول المطلوبة
      if (options.select) {
        findQuery = findQuery.select(options.select);
      }
      
      // تطبيق الـ populate
      if (options.populate) {
        findQuery = findQuery.populate(options.populate);
      }
      
      // تطبيق الـ lean
      if (options.lean) {
        findQuery = findQuery.lean();
      }

      return findQuery.exec();
    } catch (error) {
      logger.error(`Error finding ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * الترقيم (Pagination)
   */
  async paginate(filter = {}, companyId = null, page = 1, limit = 10, sort = { createdAt: -1 }, options = {}) {
    try {
      const query = { ...filter };
      if (companyId) query.companyId = companyId;
      
      const skip = (page - 1) * limit;
      
      let findQuery = this.model.find(query).sort(sort).skip(skip).limit(limit);
      
      if (options.select) {
        findQuery = findQuery.select(options.select);
      }
      
      if (options.populate) {
        findQuery = findQuery.populate(options.populate);
      }
      
      if (options.lean) {
        findQuery = findQuery.lean();
      }

      const [data, total] = await Promise.all([
        findQuery.exec(),
        this.model.countDocuments(query)
      ]);

      return {
        data,
        meta: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error(`Error paginating ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * عد المستندات
   */
  async count(filter = {}, companyId = null) {
    try {
      const query = { ...filter };
      if (companyId) query.companyId = companyId;
      
      return this.model.countDocuments(query);
    } catch (error) {
      logger.error(`Error counting ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * التحقق من وجود مستند
   */
  async exists(filter = {}, companyId = null) {
    try {
      const query = { ...filter };
      if (companyId) query.companyId = companyId;
      
      const count = await this.model.countDocuments(query);
      return count > 0;
    } catch (error) {
      logger.error(`Error checking existence of ${this.modelName}:`, error);
      throw error;
    }
  }

  // ============ UPDATE ============

  /**
   * تحديث مستند
   */
  async update(id, data, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndUpdate(
        query,
        { ...data, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error updating ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * تحديث مستندات متعددة
   */
  async updateMany(filter = {}, data, companyId = null) {
    try {
      const query = { ...filter };
      if (companyId) query.companyId = companyId;
      
      return this.model.updateMany(
        query,
        { ...data, updatedAt: new Date() },
        { runValidators: true }
      );
    } catch (error) {
      logger.error(`Error updating many ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * زيادة قيمة حقل
   */
  async increment(id, field, value = 1, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndUpdate(
        query,
        { $inc: { [field]: value }, updatedAt: new Date() },
        { new: true }
      );
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error incrementing ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * إضافة عنصر إلى مصفوفة
   */
  async pushToArray(id, field, value, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndUpdate(
        query,
        { $push: { [field]: value }, updatedAt: new Date() },
        { new: true }
      );
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error pushing to array in ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * إزالة عنصر من مصفوفة
   */
  async pullFromArray(id, field, value, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndUpdate(
        query,
        { $pull: { [field]: value }, updatedAt: new Date() },
        { new: true }
      );
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error pulling from array in ${this.modelName}:`, error);
      throw error;
    }
  }

  // ============ DELETE ============

  /**
   * حذف ناعم (Soft Delete)
   */
  async softDelete(id, companyId = null, deletedBy = null, reason = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndUpdate(
        query,
        {
          deletedAt: new Date(),
          status: 'archived',
          ...(deletedBy && { deletedBy }),
          ...(reason && { deletedReason }),
          updatedAt: new Date()
        },
        { new: true }
      );
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error soft deleting ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * حذف ناعم لمستندات متعددة
   */
  async softDeleteMany(ids, companyId = null, deletedBy = null) {
    try {
      const query = { _id: { $in: ids } };
      if (companyId) query.companyId = companyId;
      
      return this.model.updateMany(
        query,
        {
          deletedAt: new Date(),
          status: 'archived',
          ...(deletedBy && { deletedBy }),
          updatedAt: new Date()
        }
      );
    } catch (error) {
      logger.error(`Error soft deleting many ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * استعادة مستند محذوف
   */
  async restore(id, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndUpdate(
        query,
        {
          deletedAt: null,
          status: 'active',
          updatedAt: new Date()
        },
        { new: true }
      );
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error restoring ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * حذف نهائي (Hard Delete)
   */
  async delete(id, companyId = null) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      
      const doc = await this.model.findOneAndDelete(query);
      
      if (!doc) {
        throw new NotFoundError(`${this.modelName} not found`);
      }
      
      return doc;
    } catch (error) {
      logger.error(`Error deleting ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * حذف نهائي لمستندات متعددة
   */
  async deleteMany(ids, companyId = null) {
    try {
      const query = { _id: { $in: ids } };
      if (companyId) query.companyId = companyId;
      
      return this.model.deleteMany(query);
    } catch (error) {
      logger.error(`Error deleting many ${this.modelName}:`, error);
      throw error;
    }
  }

  // ============ AGGREGATION ============

  /**
   * تنفيذ Aggregation Pipeline
   */
  async aggregate(pipeline, companyId = null) {
    try {
      let finalPipeline = pipeline;
      
      // إضافة فلتر الشركة إذا وجد
      if (companyId) {
        const matchStage = { $match: { companyId } };
        finalPipeline = [matchStage, ...pipeline];
      }
      
      return this.model.aggregate(finalPipeline);
    } catch (error) {
      logger.error(`Error aggregating ${this.modelName}:`, error);
      throw error;
    }
  }

  /**
   * الحصول على إحصائيات
   */
  async getStats(companyId = null, groupBy = null, filter = {}) {
    try {
      const match = { ...filter };
      if (companyId) match.companyId = companyId;
      
      const pipeline = [
        { $match: match }
      ];
      
      if (groupBy) {
        pipeline.push({
          $group: {
            _id: `$${groupBy}`,
            count: { $sum: 1 },
            createdAt: { $first: '$createdAt' }
          }
        });
        pipeline.push({ $sort: { count: -1 } });
      } else {
        pipeline.push({
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            inactive: {
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
            },
            archived: {
              $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
            }
          }
        });
      }
      
      const result = await this.model.aggregate(pipeline);
      return result[0] || { total: 0, active: 0, inactive: 0, archived: 0 };
    } catch (error) {
      logger.error(`Error getting stats for ${this.modelName}:`, error);
      throw error;
    }
  }

  // ============ TRANSACTIONS ============

  /**
   * بدء جلسة (Session) للمعاملات
   */
  startSession() {
    return this.model.db.startSession();
  }

  /**
   * تنفيذ معاملة
   */
  async transaction(callback) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      const result = await callback(session);
      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = BaseRepository;