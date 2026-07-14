const BaseRepository = require('../../../core/base/BaseRepository');
const Exchange = require('../models/Exchange.model');

class ExchangeRepository extends BaseRepository {
  constructor() {
    super(Exchange);
    this.model = Exchange;
  }

  async findAvailable(companyId) {
    return this.model.findAvailable(companyId);
  }

  async findByResourceType(resourceType, companyId) {
    return this.model.findByResourceType(resourceType, companyId);
  }

  async findMatched(companyId) {
    return this.model.findMatched(companyId);
  }

  async findByFactory(factoryId, companyId) {
    return this.model.find({
      factoryId,
      companyId,
      deletedAt: null
    }).sort({ createdAt: -1 });
  }

  async reserveQuantity(id, quantity) {
    const exchange = await this.model.findById(id);
    if (!exchange) return null;
    await exchange.reserveQuantity(quantity);
    return exchange.save();
  }

  async sellQuantity(id, quantity) {
    const exchange = await this.model.findById(id);
    if (!exchange) return null;
    await exchange.sellQuantity(quantity);
    return exchange.save();
  }

  async addInterest(id, interest) {
    const exchange = await this.model.findById(id);
    if (!exchange) return null;
    await exchange.addInterest(interest);
    return exchange.save();
  }

  async updateMatch(id, matchData) {
    const exchange = await this.model.findById(id);
    if (!exchange) return null;
    await exchange.updateMatch(matchData);
    return exchange.save();
  }

  async getAvailableStats(companyId) {
    const stats = await this.model.aggregate([
      {
        $match: {
          companyId,
          'availability.status': 'available',
          'availability.quantityAvailable': { $gt: 0 },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$resourceType',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$resourceDetails.quantity' },
          totalValue: { $sum: { $multiply: ['$resourceDetails.quantity', '$pricing.pricePerUnit'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return stats;
  }
}

module.exports = ExchangeRepository;