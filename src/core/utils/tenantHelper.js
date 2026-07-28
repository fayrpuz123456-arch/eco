// src/core/utils/tenantHelper.js

const logger = require('./logger');

/**
 * الحصول على companyId من الـ Request بشكل آمن
 * @param {Object} req - Request object
 * @returns {string|null} - companyId أو null
 */
const getCompanyId = (req) => {
  // ✅ التحقق من وجود req
  if (!req) {
    logger.error('❌ getCompanyId: req is undefined');
    return null;
  }

  // ✅ التحقق من وجود headers و body
  const fromHeader = req.headers?.['x-company-id'] || req.headers?.['company-id'];
  const fromBody = req.body?.companyId || req.body?.company_id;
  const fromAuth = req.companyId;

  // ✅ تسجيل المصدر للـ Debug
  const source = fromHeader ? 'header' : fromBody ? 'body' : fromAuth ? 'auth' : 'none';

  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`🔍 getCompanyId source: ${source}, value: ${fromHeader || fromBody || fromAuth || 'not found'}`);
  }

  return fromHeader || fromBody || fromAuth || null;
};

/**
 * التحقق من صحة companyId
 * @param {string} companyId - companyId للتحقق
 * @returns {boolean} - هل companyId صحيح؟
 */
const isValidCompanyId = (companyId) => {
  if (!companyId) return false;
  
  // ✅ دعم ObjectId (24 حرف Hex) و comp_xxxxx
  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(companyId);
  const isValidCompanyCode = companyId.startsWith('comp_') && companyId.length >= 10;
  
  return isValidObjectId || isValidCompanyCode;
};

/**
 * التحقق من وجود companyId في الـ Request
 * @param {Object} req - Request object
 * @returns {boolean}
 */
const hasCompanyId = (req) => {
  if (!req) return false;
  return !!(req.body?.companyId || req.headers?.['x-company-id'] || req.companyId);
};

/**
 * الحصول على companyId مع رسالة خطأ مخصصة
 * @param {Object} req - Request object
 * @param {string} customMessage - رسالة مخصصة
 * @returns {string|null}
 */
const getCompanyIdOrThrow = (req, customMessage = null) => {
  const companyId = getCompanyId(req);
  
  if (!companyId) {
    throw new Error(customMessage || 'Company ID is required. Please provide via x-company-id header or companyId in body.');
  }
  
  if (!isValidCompanyId(companyId)) {
    throw new Error(`Invalid company ID format: ${companyId}. Must be ObjectId (24 hex) or start with "comp_"`);
  }
  
  return companyId;
};

module.exports = {
  getCompanyId,
  isValidCompanyId,
  hasCompanyId,
  getCompanyIdOrThrow
};