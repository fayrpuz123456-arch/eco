const BaseRepository = require('../../../core/base/BaseRepository');
const HeatRecovery = require('../models/HeatRecovery.model');

class HeatRecoveryRepository extends BaseRepository {
  constructor() {
    super(HeatRecovery);
    this.model = HeatRecovery;
  }

  async findByPriority(companyId, priority) {
    return this.model.findByPriority(companyId, priority);
  }

  async findByFactory(factoryId, companyId) {
    return this.model.findByFactory(factoryId, companyId);
  }

  async findByMachine(machineId, companyId) {
    return this.model.findByMachine(machineId, companyId);
  }

  async findHighPriority(companyId) {
    return this.model.findHighPriority(companyId);
  }

  async getStats(companyId) {
    return this.model.getStats(companyId);
  }

  async updateImplementation(id, data) {
    const heatRecovery = await this.model.findById(id);
    if (!heatRecovery) return null;
    await heatRecovery.updateImplementation(data);
    return heatRecovery.save();
  }

  async updateAIAnalysis(id, data) {
    const heatRecovery = await this.model.findById(id);
    if (!heatRecovery) return null;
    await heatRecovery.updateAIAnalysis(data);
    return heatRecovery.save();
  }

  async addSolution(id, solution) {
    const heatRecovery = await this.model.findById(id);
    if (!heatRecovery) return null;
    await heatRecovery.addSolution(solution);
    return heatRecovery.save();
  }

  async getTotalRecoverableHeat(companyId) {
    const stats = await this.model.aggregate([
      {
        $match: {
          companyId,
          deletedAt: null
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$heatCalculation.recoverableHeat' },
          count: { $sum: 1 }
        }
      }
    ]);

    return stats[0] || { total: 0, count: 0 };
  }
}

module.exports = HeatRecoveryRepository;