const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * النموذج الأساسي - يوفر وظائف مشتركة لجميع النماذج
 */
class BaseModel {
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

  static applySoftDelete(schema) {
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

  static getIndexes() {
    return [
      { fields: { companyId: 1 } },
      { fields: { status: 1 } },
      { fields: { createdAt: -1 } },
      { fields: { deletedAt: 1 }, options: { sparse: true } }
    ];
  }

  static async createIndexes(model) {
    if (!model || !model.schema) return;

    const indexes = this.getIndexes();
    for (const index of indexes) {
      model.schema.index(index.fields, index.options || {});
    }
    await model.syncIndexes();
  }

  static applyCommonSettings(schema) {
    // Pre-save middleware
    // ✅ لا نستخدم next() اليدوي هنا؛ في نسخ Mongoose الحديثة الـ hooks بدون
    // باراميتر next تُعامل كـ sync/async تلقائيًا، وأي throw بيتحول لـ rejection صح.
    schema.pre('save', function() {
      this.updatedAt = new Date();
    });

    // Pre-validate middleware
    schema.pre('validate', function() {
      if (this.email) {
        this.email = String(this.email).toLowerCase().trim();
      }
      if (this.name) {
        this.name = String(this.name).trim();
      }
      if (this.code) {
        this.code = String(this.code).toUpperCase().trim();
      }
      if (this.displayName) {
        this.displayName = String(this.displayName).trim();
      }
    });

    // Pre-findOneAndUpdate middleware
    schema.pre('findOneAndUpdate', function() {
      this.set({ updatedAt: new Date() });
    });

    // Pre-updateOne middleware
    schema.pre('updateOne', function() {
      this.set({ updatedAt: new Date() });
    });

    // Pre-updateMany middleware
    schema.pre('updateMany', function() {
      this.set({ updatedAt: new Date() });
    });

    // ✅ Post-save - Success
    schema.post('save', function(doc) {
      console.log(`✅ ${doc.constructor.modelName} saved successfully:`, doc._id);
    });

    // ✅ Post-save - Error Handler (error-handling middleware لازم تفضل بنفس الشكل: (error, doc, next))
    schema.post('save', function(error, doc, next) {
      if (error) {
        console.error(`❌ Error saving ${doc.constructor.modelName}:`, error.message);
        return next(error);
      }
      next();
    });

    // ✅ Post-findOneAndUpdate - Success
    schema.post('findOneAndUpdate', function(doc) {
      if (doc) {
        console.log(`✅ ${doc.constructor.modelName} updated successfully:`, doc._id);
      }
    });

    // ✅ Post-findOneAndUpdate - Error Handler
    schema.post('findOneAndUpdate', function(error, doc, next) {
      if (error) {
        console.error(`❌ Error updating ${doc.constructor.modelName}:`, error.message);
        return next(error);
      }
      next();
    });

    // عامة
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

    this.applySoftDelete(schema);
    this.applyCommonSettings(schema);

    return schema;
  }
}

module.exports = BaseModel;