const express = require('express');
const router = express.Router();
const Department = require('../models/Department.model');

// ===== GET - قائمة الأقسام =====
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({ deletedAt: null }).select('-__v');
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
    const department = await Department.findById(req.params.id);
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
    const { name, code, factoryId, description, type } = req.body;

    if (!name || !code || !factoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, and factoryId are required'
      });
    }

    const existingDepartment = await Department.findOne({ code: code.toUpperCase(), factoryId });
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
      status: 'active'
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
    const { name, type, description, status } = req.body;
    const department = await Department.findById(req.params.id);
    
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
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    department.deletedAt = new Date();
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