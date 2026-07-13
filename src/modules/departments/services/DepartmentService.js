const BaseService = require('../../../core/base/BaseService');
const DepartmentRepository = require('../repositories/DepartmentRepository');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../../../core/middleware/errorHandler');
const { eventEmitter, EventTypes } = require('../../../core/events/eventEmitter');
const logger = require('../../../core/utils/logger');

class DepartmentService extends BaseService {
  constructor() {
    super(new DepartmentRepository(), 'Department');
    this.repository = this.repository;
  }

  // ============ CREATE ============

  async createDepartment(data, userId, companyId) {
    try {
      this.validateRequiredFields(data, ['name', 'code', 'type', 'factoryId']);

      // التحقق من عدم وجود قسم بنفس الاسم في المصنع
      const existingName = await this.repository.findByName(data.name, data.factoryId, companyId);
      if (existingName) {
        throw new ConflictError('Department with this name already exists in this factory');
      }

      // التحقق من عدم وجود قسم بنفس الكود في المصنع
      const existingCode = await this.repository.findByCode(data.code, data.factoryId, companyId);
      if (existingCode) {
        throw new ConflictError('Department with this code already exists in this factory');
      }

      const departmentData = {
        ...data,
        code: data.code.toUpperCase(),
        createdBy: userId,
        updatedBy: userId,
        companyId
      };

      const department = await this.repository.create(departmentData);

      eventEmitter.emit('department.created', {
        departmentId: department._id,
        name: department.name,
        factoryId: department.factoryId,
        companyId,
        createdBy: userId
      });

      logger.info('Department created successfully', {
        departmentId: department._id,
        name: department.name,
        factoryId: department.factoryId,
        companyId
      });

      return department;
    } catch (error) {
      logger.error('Error creating department:', error);
      throw error;
    }
  }

  // ============ FIND ============

  async getDepartmentById(id, companyId) {
    const department = await this.repository.findById(id, companyId);
    if (!department) {
      throw new NotFoundError('Department not found');
    }
    return department;
  }

  async getDepartmentByCode(code, factoryId, companyId) {
    const department = await this.repository.findByCode(code, factoryId, companyId);
    if (!department) {
      throw new NotFoundError('Department not found');
    }
    return department;
  }

  async getDepartments(companyId, filter = {}, options = {}) {
    return this.repository.find(filter, companyId, options);
  }

  async getDepartmentsPaginated(companyId, page, limit, filter = {}) {
    return this.repository.paginate(filter, companyId, page, limit);
  }

  async getFactoryDepartments(factoryId, companyId) {
    return this.repository.find({ factoryId }, companyId);
  }

  async getActiveDepartments(factoryId, companyId) {
    return this.repository.findActive(factoryId, companyId);
  }

  async getHighGreenScoreDepartments(minScore = 70, factoryId, companyId) {
    return this.repository.findHighGreenScore(minScore, factoryId, companyId);
  }

  async searchDepartments(query, factoryId, companyId) {
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }
    return this.repository.search(query, factoryId, companyId);
  }

  async getDepartmentStats(id) {
    const stats = await this.repository.getDepartmentStats(id);
    if (!stats) {
      throw new NotFoundError('Department not found');
    }
    return stats;
  }

  async getFactoryDepartmentStats(factoryId) {
    return this.repository.getFactoryDepartmentStats(factoryId);
  }

  async getTypeDistribution(factoryId, companyId) {
    return this.repository.getTypeDistribution(factoryId, companyId);
  }

  // ============ UPDATE ============

  async updateDepartment(id, data, userId, companyId) {
    try {
      const existingDepartment = await this.repository.findById(id, companyId);
      if (!existingDepartment) {
        throw new NotFoundError('Department not found');
      }

      const allowedUpdates = [
        'name', 'description', 'type', 'departmentHead',
        'location', 'productionDetails', 'safety', 'settings',
        'tags', 'metadata'
      ];

      const updateData = {};
      for (const key of allowedUpdates) {
        if (data[key] !== undefined) {
          updateData[key] = data[key];
        }
      }

      if (data.name && data.name !== existingDepartment.name) {
        const nameExists = await this.repository.findByName(
          data.name,
          existingDepartment.factoryId,
          companyId
        );
        if (nameExists && nameExists._id !== id) {
          throw new ConflictError('Department with this name already exists in this factory');
        }
        updateData.name = data.name;
      }

      if (data.code && data.code.toUpperCase() !== existingDepartment.code) {
        const codeExists = await this.repository.findByCode(
          data.code,
          existingDepartment.factoryId,
          companyId
        );
        if (codeExists && codeExists._id !== id) {
          throw new ConflictError('Department with this code already exists in this factory');
        }
        updateData.code = data.code.toUpperCase();
      }

      updateData.updatedBy = userId;

      const updatedDepartment = await this.repository.update(id, updateData, companyId);

      eventEmitter.emit('department.updated', {
        departmentId: updatedDepartment._id,
        name: updatedDepartment.name,
        factoryId: updatedDepartment.factoryId,
        companyId,
        updatedBy: userId
      });

      logger.info('Department updated successfully', {
        departmentId: updatedDepartment._id,
        name: updatedDepartment.name,
        companyId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating department:', error);
      throw error;
    }
  }

  async updateStatus(id, status, userId, companyId) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = await this.repository.updateStatus(id, status);

      logger.info('Department status updated', {
        departmentId: id,
        oldStatus: department.status,
        newStatus: status,
        updatedBy: userId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw error;
    }
  }

  async updateEmployees(id, stats, userId, companyId) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = await this.repository.updateEmployees(id, stats);

      logger.info('Department employees updated', {
        departmentId: id,
        stats,
        updatedBy: userId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating employees:', error);
      throw error;
    }
  }

  async updateAssets(id, assets, userId, companyId) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = await this.repository.updateAssets(id, assets);

      logger.info('Department assets updated', {
        departmentId: id,
        assets,
        updatedBy: userId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating assets:', error);
      throw error;
    }
  }

  async updateGreenScore(id, score, userId, companyId) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = await this.repository.updateGreenScore(id, score);

      logger.info('Department green score updated', {
        departmentId: id,
        oldScore: department.environmental.greenScore,
        newScore: score,
        updatedBy: userId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating green score:', error);
      throw error;
    }
  }

  async updateBudget(id, budget, userId, companyId) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = await this.repository.updateBudget(id, budget);

      logger.info('Department budget updated', {
        departmentId: id,
        budget,
        updatedBy: userId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating budget:', error);
      throw error;
    }
  }

  async updateKPIs(id, kpis, userId, companyId) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = await this.repository.updateKPIs(id, kpis);

      logger.info('Department KPIs updated', {
        departmentId: id,
        kpis,
        updatedBy: userId
      });

      return updatedDepartment;
    } catch (error) {
      logger.error('Error updating KPIs:', error);
      throw error;
    }
  }

  // ============ DELETE ============

  async deleteDepartment(id, userId, companyId, reason = null) {
    try {
      const department = await this.repository.findById(id, companyId);
      if (!department) {
        throw new NotFoundError('Department not found');
      }

      // التحقق من عدم وجود بيانات مرتبطة
      const stats = await this.repository.getDepartmentStats(id);
      if (stats && (stats.statistics?.totalMachines > 0 || 
                    stats.statistics?.totalSensors > 0 || 
                    stats.statistics?.totalUsers > 0)) {
        throw new ValidationError('Cannot delete department with active data. Please delete all associated data first.');
      }

      await this.repository.softDelete(id, companyId);

      eventEmitter.emit('department.deleted', {
        departmentId: id,
        name: department.name,
        factoryId: department.factoryId,
        companyId,
        deletedBy: userId
      });

      logger.info('Department deleted successfully', {
        departmentId: id,
        name: department.name,
        companyId
      });

      return { message: 'Department deleted successfully' };
    } catch (error) {
      logger.error('Error deleting department:', error);
      throw error;
    }
  }

  // ============ FILTERS ============

  async findWithFilters(filters = {}, factoryId, companyId) {
    return this.repository.findWithFilters(filters, factoryId, companyId);
  }

  // ============ DASHBOARD ============

  async getDepartmentDashboard(id, companyId) {
    const stats = await this.getDepartmentStats(id);
    const department = await this.getDepartmentById(id, companyId);
    
    return {
      department: {
        id: department._id,
        name: department.name,
        code: department.code,
        type: department.type,
        status: department.status,
        departmentHead: department.departmentHead
      },
      location: department.location,
      employees: department.employees,
      production: {
        shiftCount: department.productionDetails.shiftCount,
        operatingHours: department.productionDetails.operatingHours,
        productionCapacity: department.productionDetails.productionCapacity,
        efficiency: department.productionDetails.efficiency
      },
      environmental: {
        greenScore: department.environmental.greenScore,
        carbonFootprint: department.environmental.carbonFootprint,
        certifications: department.environmental.certifications
      },
      kpis: department.kpis,
      budget: department.budget,
      statistics: stats.statistics || {},
      createdAt: department.createdAt
    };
  }
}

module.exports = DepartmentService;