const express = require('express');
const router = express.Router();
const Department = require('../models/Department.model');

// ⚠️ مهم جداً: لازم يكون فيه auth middleware قبل الراوتس دي بيحط بيانات
// المستخدم المسجل دخول على req.user (companyId, uid/id ...). لو اسم
// الحقل مختلف في مشروعك (مثلاً req.auth بدل req.user)، غيّر الأسطر
// المعلّمة بـ 👈 تحت لتطابق الـ middleware الفعلي عندك.

// ===== GET - قائمة الأقسام =====
router.get('/', async (req, res) => {
  try {
    const companyId = req.user?.companyId; // 👈 تأكد من اسم الحقل الصحيح
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    const departments = await Department.find({ companyId, deletedAt: null }).select('-__v');
    res.json({
      success: true,
      message: 'Departments retrieved successfully',
      data: departments,
      count: departments.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
});

// ===== GET - قسم بالمعرف =====
router.get('/:id', async (req, res) => {
  try {
    const companyId = req.user?.companyId; // 👈 تأكد من اسم الحقل الصحيح
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: companyId not found on request'
      });
    }

    // ✅ فلترة بـ companyId كمان هنا عشان مستخدم من شركة معينة
    // ميقدرش يشوف قسم بتاع شركة تانية لو عرف الـ ID بتاعه
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    res.json({
      success: true,
      message: 'Department retrieved successfully',
      data: department
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching department',
      error: error.message
    });
  }
});

// ===== POST - إنشاء قسم جديد =====
router.post('/', async (req, res) => {
  try {
    const companyId = req.user?.companyId; // 👈 تأكد من اسم الحقل الصحيح
    const userId = req.user?.uid || req.user?.id; // 👈 تأكد من اسم الحقل الصحيح

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { name, code, factoryId, description, type } = req.body;

    if (!name || !code || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, and factoryId are required'
      });
    }

    // ✅ فحص التكرار بقى ضمن نطاق نفس الشركة كمان (companyId)، مش بس factoryId
    const existingDepartment = await Department.findOne({
      code: code.toUpperCase(),
      factoryId,
      companyId,
      deletedAt: null
    });
    if (existingDepartment) {
      return res.status(409).json({
        success: false,
        message: 'Department with this code already exists in this factory'
      });
    }

    const newDepartment = new Department({
      name,
      code: code.toUpperCase(),
      factoryId,
      type: type || 'production',
      description: description || null,
      status: 'active',
      // ✅ دي الحقول اللي كانت ناقصة وسببت الخطأ (companyId required)
      companyId,
      createdBy: userId,
      updatedBy: userId
    });

    const savedDepartment = await newDepartment.save();

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: savedDepartment
    });
  } catch (error) {
    console.error('❌ Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating department',
      error: error.message
    });
  }
});

// ===== PUT - تحديث قسم =====
router.put('/:id', async (req, res) => {
  try {
    const companyId = req.user?.companyId; // 👈 تأكد من اسم الحقل الصحيح
    const userId = req.user?.uid || req.user?.id; // 👈 تأكد من اسم الحقل الصحيح

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    const { name, type, description, status } = req.body;

    // ✅ فلترة بـ companyId عشان ميعدلش قسم بتاع شركة تانية
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    if (name) department.name = name;
    if (type) department.type = type;
    if (description) department.description = description;
    if (status) department.status = status;

    department.updatedBy = userId;
    department.updatedAt = new Date();
    const updatedDepartment = await department.save();

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating department',
      error: error.message
    });
  }
});

// ===== DELETE - حذف قسم =====
router.delete('/:id', async (req, res) => {
  try {
    const companyId = req.user?.companyId; // 👈 تأكد من اسم الحقل الصحيح
    const userId = req.user?.uid || req.user?.id; // 👈 تأكد من اسم الحقل الصحيح

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user/company context missing from request'
      });
    }

    // ✅ فلترة بـ companyId عشان ميحذفش قسم بتاع شركة تانية
    const department = await Department.findOne({
      _id: req.params.id,
      companyId,
      deletedAt: null
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    department.deletedAt = new Date();
    department.deletedBy = userId;
    department.status = 'archived';
    await department.save();

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting department',
      error: error.message
    });
  }
});

module.exports = router;