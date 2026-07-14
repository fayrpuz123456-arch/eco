const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * النموذج الأساسي - يوفر وظائف مشتركة لجميع النماذج
 */
class BaseModel {
  /**
   * الحصول على مخطط النموذج الأساسي
   * @returns {Object} - مخطط النموذج
   */
  static getSchema() {
    return {
      _id: { type: String, default: () => uuidv4() },
      companyId: { type: String, required: true, index: true },
      createdBy: { type: String },
      updatedBy: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null, index: true },
      status: {
        type: String,
        enum: ['active', 'inactive', 'archived'],
        default: 'active',
        index: true
      },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    };
  }

  /**
   * تطبيق الحذف الناعم (Soft Delete) على المخطط
   * @param {mongoose.Schema} schema - مخطط Mongoose
   */
  static applySoftDelete(schema) {
    // فلترة المستندات غير المحذوفة في findAll
    schema.pre('find', function() {
      this.where({ deletedAt: null });
    });
    
    schema.pre('findOne', function() {
      this.where({ deletedAt: null });
    });
    
    schema.pre('findOneAndUpdate', function() {
      this._conditions.deletedAt = null;
    });
    
    schema.pre('countDocuments', function() {
      this.where({ deletedAt: null });
    });
    
    schema.pre('aggregate', function() {
      if (this.pipeline().length > 0) {
        const firstStage = this.pipeline()[0];
        if (firstStage && firstStage.$match) {
          firstStage.$match.deletedAt = null;
        } else {
          this.pipeline().unshift({ $match: { deletedAt: null } });
        }
      }
    });

    // إضافة دوال للمستند
    schema.methods.softDelete = async function(deletedBy = null, reason = null) {
      this.deletedAt = new Date();
      this.status = 'archived';
      if (deletedBy) this.deletedBy = deletedBy;
      if (reason) this.deletedReason = reason;
      return this.save();
    };

    schema.methods.restore = async function() {
      this.deletedAt = null;
      this.status = 'active';
      return this.save();
    };

    schema.methods.isDeleted = function() {
      return this.deletedAt !== null;
    };

    // إضافة دوال ثابتة
    schema.statics.findActive = function(filter = {}) {
      return this.find({ ...filter, deletedAt: null });
    };

    schema.statics.findDeleted = function(filter = {}) {
      return this.find({ ...filter, deletedAt: { $ne: null } });
    };

    schema.statics.restoreMany = async function(ids) {
      return this.updateMany(
        { _id: { $in: ids }, deletedAt: { $ne: null } },
        { deletedAt: null, status: 'active', updatedAt: new Date() }
      );
    };

    schema.statics.hardDelete = async function(id) {
      return this.findByIdAndDelete(id);
    };

    schema.statics.hardDeleteMany = async function(ids) {
      return this.deleteMany({ _id: { $in: ids } });
    };
  }

  /**
   * الحصول على الفهارس الموصى بها
   * @returns {Array} - قائمة الفهارس
   */
  static getIndexes() {
    return [
      { fields: { companyId: 1 } },
      { fields: { status: 1 } },
      { fields: { createdAt: -1 } },
      { fields: { deletedAt: 1 }, options: { sparse: true } }
    ];
  }

  /**
   * إنشاء الفهارس على النموذج
   * @param {mongoose.Model} model - نموذج Mongoose
   */
  static async createIndexes(model) {
    if (!model || !model.schema) return;
    
    const indexes = this.getIndexes();
    for (const index of indexes) {
      model.schema.index(index.fields, index.options || {});
    }
    await model.syncIndexes();
  }

  /**
   * تطبيق الإعدادات المشتركة على المخطط
   * @param {mongoose.Schema} schema - مخطط Mongoose
   */
  static applyCommonSettings(schema) {
    // ⚠️ تم تعطيل Pre-save middleware مؤقتاً لحل مشكلة "next is not a function"
    // سيتم إعادة تفعيلها بعد تحديث Mongoose
    // schema.pre('save', function(next) {
    //   try {
    //     this.updatedAt = new Date();
    //     next();
    //   } catch (error) {
    //     next(error);
    //   }
    // });

    // schema.pre('save', function(next) {
    //   try {
    //     if (this.email) {
    //       this.email = this.email.toLowerCase().trim();
    //     }
    //     if (this.name) {
    //       this.name = this.name.trim();
    //     }
    //     if (this.code) {
    //       this.code = this.code.toUpperCase().trim();
    //     }
    //     next();
    //   } catch (error) {
    //     next(error);
    //   }
    // });

    // إضافة دوال عامة
    schema.methods.toJSON = function() {
      const obj = this.toObject();
      delete obj.__v;
      return obj;
    };

    schema.methods.toPublicJSON = function() {
      const obj = this.toJSON();
      delete obj.metadata;
      delete obj.createdBy;
      delete obj.updatedBy;
      return obj;
    };
  }

  /**
   * إنشاء مخطط جديد مع التطبيقات الأساسية
   * @param {Object} customSchema - مخطط مخصص
   * @param {Object} options - خيارات إضافية
   * @returns {mongoose.Schema} - مخطط Mongoose
   */
  static createSchema(customSchema = {}, options = {}) {
    const schema = new mongoose.Schema(
      {
        ...this.getSchema(),
        ...customSchema
      },
      {
        timestamps: {
          createdAt: 'createdAt',
          updatedAt: 'updatedAt'
        },
        toJSON: {
          transform: (doc, ret) => {
            delete ret.__v;
            return ret;
          }
        },
        ...options
      }
    );

    // تطبيق الحذف الناعم
    this.applySoftDelete(schema);
    
    // تطبيق الإعدادات المشتركة
    this.applyCommonSettings(schema);

    return schema;
  }
}

module.exports = BaseModel;