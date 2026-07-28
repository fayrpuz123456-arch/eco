const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine.model');
const { authMiddleware } = require('../../../core/middleware/auth');
const { tenantMiddleware } = require('../../../core/middleware/tenant');
const { getCompanyId, isValidCompanyId } = require('../../../core/utils/tenantHelper');
const logger = require('../../../core/utils/logger');

// ✅ تطبيق authMiddleware على جميع الراوتات
router.use(authMiddleware);
router.use(tenantMiddleware(true));

// ============================================================
// ===== خريطة تحويل الأنواع غير المعروفة =====
// ============================================================
const typeNormalizer = {
    // الأنواع اللي بتبعت من الـ Frontend → الأنواع الصحيحة في الـ Schema
    'ana_mach': 'other',
    'cnc_mach4': 'cnc_machine',
    'cnc_mach3': 'cnc_machine',
    'cnc_mach2': 'cnc_machine',
    'cnc_mach1': 'cnc_machine',
    'assembly_line': 'conveyor',
    'assembly': 'conveyor',
    'robot_arm': 'other',
    'robot': 'other',
    'packaging_line': 'packaging',
    'filling_line': 'filling',
    'testing_equipment': 'testing',
    'inspection': 'quality_inspection',
    'quality': 'quality_inspection',
    'measure': 'measurement',
    'anaerobic': 'other',
    'anaerobic_machine': 'other',
    // أضف أي تحويلات تانية حسب الحاجة
};

// ===== قائمة الأنواع المسموحة (نفس الـ Schema) =====
const VALID_MACHINE_TYPES = [
    'cnc_machine', 'lathe', 'milling', 'drilling', 'grinding',
    'welding', 'press', 'injection_molding', 'extrusion', 'stamping',
    'laser', 'waterjet', 'plasma', 'packaging', 'labeling',
    'capping', 'filling', 'conveyor', 'forklift', 'crane',
    'generator', 'compressor', 'boiler', 'chiller', 'pump',
    'quality_inspection', 'testing', 'measurement', 'other'
];

// ===== دالة تطبيع النوع =====
function normalizeMachineType(type) {
    if (!type) return 'other';
    
    // 1. تحويل من الخريطة إذا كان موجود
    if (typeNormalizer[type]) {
        logger.info(`🔄 Normalizing machine type: ${type} → ${typeNormalizer[type]}`);
        return typeNormalizer[type];
    }
    
    // 2. إذا كان النوع في القائمة، استخدمه
    if (VALID_MACHINE_TYPES.includes(type)) {
        return type;
    }
    
    // 3. وإلا استخدم 'other'
    logger.warn(`⚠️ Unknown machine type: ${type}, defaulting to 'other'`);
    return 'other';
}

// ===== Middleware لتطبيع نوع الماكينة =====
router.use((req, res, next) => {
    // يطبق على POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body?.type) {
        const originalType = req.body.type;
        req.body.type = normalizeMachineType(req.body.type);
        
        if (originalType !== req.body.type) {
            logger.info(`🔄 Type normalized: ${originalType} → ${req.body.type}`);
        }
    }
    next();
});

// ============================================================
// ===== GET - قائمة الأنواع المسموحة =====
// ============================================================
router.get('/types', async (req, res) => {
    try {
        const typesWithLabels = [
            { value: 'cnc_machine', label: 'ماكينة CNC' },
            { value: 'lathe', label: 'مخرطة' },
            { value: 'milling', label: 'ماكينة تفريز' },
            { value: 'drilling', label: 'ماكينة ثقب' },
            { value: 'grinding', label: 'ماكينة تجليخ' },
            { value: 'welding', label: 'ماكينة لحام' },
            { value: 'press', label: 'مكبس' },
            { value: 'injection_molding', label: 'حقن بلاستيك' },
            { value: 'extrusion', label: 'بثق' },
            { value: 'stamping', label: 'ختم' },
            { value: 'laser', label: 'ليزر' },
            { value: 'waterjet', label: 'نفث مائي' },
            { value: 'plasma', label: 'بلازما' },
            { value: 'packaging', label: 'تغليف' },
            { value: 'labeling', label: 'توسيم' },
            { value: 'capping', label: 'إغلاق' },
            { value: 'filling', label: 'تعبئة' },
            { value: 'conveyor', label: 'سير ناقل' },
            { value: 'forklift', label: 'رافعة شوكية' },
            { value: 'crane', label: 'ونش' },
            { value: 'generator', label: 'مولد كهرباء' },
            { value: 'compressor', label: 'ضاغط' },
            { value: 'boiler', label: 'غلاية' },
            { value: 'chiller', label: 'مبرد' },
            { value: 'pump', label: 'مضخة' },
            { value: 'quality_inspection', label: 'فحص جودة' },
            { value: 'testing', label: 'اختبار' },
            { value: 'measurement', label: 'قياس' },
            { value: 'other', label: 'أخرى' }
        ];

        res.json({
            success: true,
            data: typesWithLabels
        });
    } catch (error) {
        logger.error('❌ GET /machines/types error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machine types',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - إحصائيات الآلات =====
// ============================================================
router.get('/stats', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const [total, active, inactive, online, offline, idle, maintenance, error] = await Promise.all([
            Machine.countDocuments({ companyId, deletedAt: null }),
            Machine.countDocuments({ companyId, status: 'active', deletedAt: null }),
            Machine.countDocuments({ companyId, status: 'inactive', deletedAt: null }),
            Machine.countDocuments({ companyId, operationalStatus: 'online', deletedAt: null }),
            Machine.countDocuments({ companyId, operationalStatus: 'offline', deletedAt: null }),
            Machine.countDocuments({ companyId, operationalStatus: 'idle', deletedAt: null }),
            Machine.countDocuments({ companyId, operationalStatus: 'maintenance', deletedAt: null }),
            Machine.countDocuments({ companyId, operationalStatus: 'error', deletedAt: null })
        ]);

        const byFactory = await Machine.aggregate([
            { $match: { companyId, deletedAt: null } },
            { $group: { _id: '$factoryId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            message: 'Machine statistics retrieved successfully',
            data: {
                total,
                active,
                inactive,
                operational: {
                    online,
                    offline,
                    idle,
                    maintenance,
                    error
                },
                byFactory
            }
        });
    } catch (error) {
        logger.error('❌ GET /machines/stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machine statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - آلات حسب المصنع =====
// ============================================================
router.get('/factory/:factoryId', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const machines = await Machine.find({
            factoryId: req.params.factoryId,
            companyId,
            deletedAt: null
        }).select('-__v');

        res.json({
            success: true,
            message: 'Machines by factory retrieved successfully',
            data: machines,
            count: machines.length
        });
    } catch (error) {
        logger.error('❌ GET /machines/factory/:factoryId error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machines by factory',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - آلات حسب القسم =====
// ============================================================
router.get('/department/:departmentId', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const machines = await Machine.find({
            departmentId: req.params.departmentId,
            companyId,
            deletedAt: null
        }).select('-__v');

        res.json({
            success: true,
            message: 'Machines by department retrieved successfully',
            data: machines,
            count: machines.length
        });
    } catch (error) {
        logger.error('❌ GET /machines/department/:departmentId error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machines by department',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - آلات حسب خط الإنتاج =====
// ============================================================
router.get('/production-line/:productionLineId', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const machines = await Machine.find({
            productionLineId: req.params.productionLineId,
            companyId,
            deletedAt: null
        }).select('-__v');

        res.json({
            success: true,
            message: 'Machines by production line retrieved successfully',
            data: machines,
            count: machines.length
        });
    } catch (error) {
        logger.error('❌ GET /machines/production-line/:productionLineId error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machines by production line',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - آلات حسب الحالة التشغيلية =====
// ============================================================
router.get('/operational/:status', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const validStatuses = ['online', 'offline', 'idle', 'maintenance', 'error'];
        if (!validStatuses.includes(req.params.status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid operational status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const machines = await Machine.find({
            operationalStatus: req.params.status,
            companyId,
            deletedAt: null
        }).select('-__v');

        res.json({
            success: true,
            message: 'Machines by operational status retrieved successfully',
            data: machines,
            count: machines.length
        });
    } catch (error) {
        logger.error('❌ GET /machines/operational/:status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machines by operational status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - آلة بالكود =====
// ============================================================
router.get('/code/:code', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const code = req.params.code.toUpperCase();
        const machine = await Machine.findOne({
            code,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        res.json({
            success: true,
            message: 'Machine retrieved successfully',
            data: machine
        });
    } catch (error) {
        logger.error('❌ GET /machines/code/:code error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machine by code',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - قائمة الآلات =====
// ============================================================
router.get('/', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const { page = 1, limit = 10, factoryId, departmentId, productionLineId, status, operationalStatus, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = { companyId, deletedAt: null };
        if (factoryId) query.factoryId = factoryId;
        if (departmentId) query.departmentId = departmentId;
        if (productionLineId) query.productionLineId = productionLineId;
        if (status) query.status = status;
        if (operationalStatus) query.operationalStatus = operationalStatus;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { type: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const [machines, total] = await Promise.all([
            Machine.find(query)
                .select('-__v')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Machine.countDocuments(query)
        ]);
        
        res.json({
            success: true,
            message: 'Machines retrieved successfully',
            data: machines,
            count: machines.length,
            meta: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasNext: skip + machines.length < total,
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        logger.error('❌ GET /machines error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machines',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== GET - آلة بالمعرف =====
// ============================================================
router.get('/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'companyId مطلوب في الـ Body أو الـ Header (x-company-id) أو من الـ Auth'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        res.json({
            success: true,
            message: 'Machine retrieved successfully',
            data: machine
        });
    } catch (error) {
        logger.error('❌ GET /machines/:id error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching machine',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== POST - إنشاء آلة جديدة =====
// ============================================================
router.post('/', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const { 
            name, 
            code, 
            type, 
            factoryId, 
            departmentId, 
            productionLineId,
            model, 
            serialNumber,
            description,
            manufacturer,
            operationalStatus,
            specifications,
            yearOfManufacture,
            installationDate,
            warrantyExpiry
        } = req.body;

        // ===== التحقق من الحقول المطلوبة =====
        if (!name || !code || !type || !factoryId || !departmentId) {
            return res.status(400).json({
                success: false,
                message: 'Name, code, type, factoryId, and departmentId are required'
            });
        }

        // ✅ التحقق من صحة الكود (حروف كبيرة وأرقام فقط)
        if (!/^[A-Z0-9]+$/.test(code.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Code must contain only uppercase letters and numbers'
            });
        }

        // ===== التحقق من عدم وجود آلة بنفس الكود =====
        const existingMachine = await Machine.findOne({ 
            code: code.toUpperCase(), 
            factoryId,
            companyId,
            deletedAt: null 
        });
        
        if (existingMachine) {
            return res.status(409).json({
                success: false,
                message: `Machine with code "${code}" already exists in this factory`
            });
        }

        // ===== إنشاء الآلة =====
        // ✅ النوع تم تطبيعه تلقائياً بواسطة الـ Middleware
        const newMachine = new Machine({
            name: name.trim(),
            code: code.toUpperCase().trim(),
            type, // تم تطبيعه بالفعل
            factoryId,
            departmentId,
            productionLineId: productionLineId || null,
            model: model || null,
            serialNumber: serialNumber || null,
            description: description || null,
            manufacturer: manufacturer || null,
            operationalStatus: operationalStatus || 'idle',
            specifications: specifications || {},
            yearOfManufacture: yearOfManufacture || null,
            installationDate: installationDate || null,
            warrantyExpiry: warrantyExpiry || null,
            companyId,
            createdBy: userId,
            updatedBy: userId,
            status: 'active'
        });

        const savedMachine = await newMachine.save();

        logger.info(`✅ Machine created successfully: ${savedMachine.code} (${savedMachine.type})`);

        res.status(201).json({
            success: true,
            message: 'Machine created successfully',
            data: savedMachine
        });
    } catch (error) {
        logger.error('❌ POST /machines error:', {
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Machine with this code already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating machine',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== PUT - تحديث آلة =====
// ============================================================
router.put('/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        // ✅ منع تحديث الحقول الحساسة
        delete req.body.companyId;
        delete req.body.factoryId;
        delete req.body.departmentId;
        delete req.body.code;

        const { 
            name, 
            type, 
            model, 
            serialNumber, 
            description,
            operationalStatus,
            specifications,
            status,
            productionLineId,
            yearOfManufacture,
            installationDate,
            warrantyExpiry
        } = req.body;

        if (name) machine.name = name.trim();
        if (type) machine.type = type; // تم تطبيعه بواسطة الـ Middleware
        if (model) machine.model = model.trim();
        if (serialNumber) machine.serialNumber = serialNumber.trim();
        if (description !== undefined) machine.description = description ? description.trim() : null;
        if (operationalStatus) machine.operationalStatus = operationalStatus;
        if (specifications) machine.specifications = specifications;
        if (status) machine.status = status;
        if (productionLineId !== undefined) machine.productionLineId = productionLineId;
        if (yearOfManufacture) machine.yearOfManufacture = yearOfManufacture;
        if (installationDate) machine.installationDate = new Date(installationDate);
        if (warrantyExpiry) machine.warrantyExpiry = new Date(warrantyExpiry);

        machine.updatedBy = userId;
        machine.updatedAt = new Date();

        const updatedMachine = await machine.save();

        logger.info(`✅ Machine updated successfully: ${updatedMachine.code}`);

        res.json({
            success: true,
            message: 'Machine updated successfully',
            data: updatedMachine
        });
    } catch (error) {
        logger.error('❌ PUT /machines/:id error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating machine',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== PATCH - تحديث جزئي لآلة =====
// ============================================================
router.patch('/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const updates = req.body;
        delete updates._id;
        delete updates.__v;
        delete updates.createdAt;
        delete updates.createdBy;
        delete updates.companyId;
        delete updates.factoryId;
        delete updates.departmentId;
        delete updates.code;

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        Object.keys(updates).forEach(key => {
            if (key === 'name') updates[key] = updates[key].trim();
            if (key === 'model') updates[key] = updates[key].trim();
            if (key === 'serialNumber') updates[key] = updates[key].trim();
            if (key === 'description') updates[key] = updates[key] ? updates[key].trim() : null;
            if (key === 'installationDate' || key === 'warrantyExpiry') {
                updates[key] = new Date(updates[key]);
            }
            machine[key] = updates[key];
        });

        machine.updatedBy = userId;
        machine.updatedAt = new Date();

        const updatedMachine = await machine.save();

        res.json({
            success: true,
            message: 'Machine updated successfully',
            data: updatedMachine
        });
    } catch (error) {
        logger.error('❌ PATCH /machines/:id error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating machine',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== DELETE - حذف آلة (Soft Delete) =====
// ============================================================
router.delete('/:id', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        // ✅ التحقق من وجود حساسات تابعة للآلة
        const { default: Sensor } = require('../sensors/models/Sensor.model');
        const sensorsCount = await Sensor.countDocuments({ machineId: machine._id, deletedAt: null });
        
        if (sensorsCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete machine. It has ${sensorsCount} associated sensor(s)`
            });
        }

        machine.deletedAt = new Date();
        machine.deletedBy = userId;
        machine.status = 'archived';
        await machine.save();

        logger.info(`✅ Machine deleted successfully: ${machine.code}`);

        res.json({
            success: true,
            message: 'Machine deleted successfully'
        });
    } catch (error) {
        logger.error('❌ DELETE /machines/:id error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting machine',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== POST - استعادة آلة محذوفة =====
// ============================================================
router.post('/:id/restore', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;
        const userRole = req.user?.role || 'viewer';

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators can restore machines.'
            });
        }

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: { $ne: null }
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Deleted machine not found'
            });
        }

        machine.deletedAt = null;
        machine.deletedBy = null;
        machine.status = 'active';
        machine.updatedBy = userId;
        machine.updatedAt = new Date();

        const restoredMachine = await machine.save();

        logger.info(`✅ Machine restored successfully: ${restoredMachine.code}`);

        res.json({
            success: true,
            message: 'Machine restored successfully',
            data: restoredMachine
        });
    } catch (error) {
        logger.error('❌ POST /machines/:id/restore error:', error);
        res.status(500).json({
            success: false,
            message: 'Error restoring machine',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== PUT - تحديث حالة الآلة =====
// ============================================================
router.put('/:id/status', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['active', 'inactive', 'maintenance', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        machine.status = status;
        machine.updatedBy = userId;
        machine.updatedAt = new Date();

        const updatedMachine = await machine.save();

        res.json({
            success: true,
            message: 'Machine status updated successfully',
            data: updatedMachine
        });
    } catch (error) {
        logger.error('❌ PUT /machines/:id/status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating machine status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ============================================================
// ===== PUT - تحديث الحالة التشغيلية =====
// ============================================================
router.put('/:id/operational', async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const userId = req.user?.id;

        if (!companyId || !userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: user/company context missing from request'
            });
        }

        if (!isValidCompanyId(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID format. Must be ObjectId or start with "comp_"',
                received: companyId
            });
        }

        const { operationalStatus } = req.body;

        if (!operationalStatus) {
            return res.status(400).json({
                success: false,
                message: 'Operational status is required'
            });
        }

        const validStatuses = ['online', 'offline', 'idle', 'maintenance', 'error'];
        if (!validStatuses.includes(operationalStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid operational status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const machine = await Machine.findOne({
            _id: req.params.id,
            companyId,
            deletedAt: null
        });

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found'
            });
        }

        machine.operationalStatus = operationalStatus;
        machine.updatedBy = userId;
        machine.updatedAt = new Date();

        const updatedMachine = await machine.save();

        res.json({
            success: true,
            message: 'Machine operational status updated successfully',
            data: updatedMachine
        });
    } catch (error) {
        logger.error('❌ PUT /machines/:id/operational error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating machine operational status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;