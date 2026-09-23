import Joi from 'joi';
import mongoose from 'mongoose';
import { Item } from '../models/Item.js';

const categories = ['electronics', 'clothing', 'documents', 'accessories', 'other'];
const statuses = ['lost', 'found', 'claimed'];

const createSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  category: Joi.string().valid(...categories),
  status: Joi.string().valid(...statuses),
  location: Joi.string().allow(''),
  reportedBy: Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  title: Joi.string().min(1),
  description: Joi.string().allow(''),
  category: Joi.string().valid(...categories),
  status: Joi.string().valid(...statuses),
  location: Joi.string().allow(''),
  reportedBy: Joi.string().hex().length(24)
});

const filterSchema = Joi.object({
  status: Joi.string().valid(...statuses),
  category: Joi.string().valid(...categories)
});

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && /^[a-fA-F0-9]{24}$/.test(String(id));
}

function handleItemError(err, res, next) {
  if (err && err.code === 11000) {
    return res.status(409).json({
      message: 'An item with this title already exists at this location'
    });
  }
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  next(err);
}

// GET /api/items?status=lost&category=electronics
export async function getAllItems(req, res, next) {
  try {
    const filterInput = {};
    if (req.query.status !== undefined) filterInput.status = req.query.status;
    if (req.query.category !== undefined) filterInput.category = req.query.category;

    const { value, error } = filterSchema.validate(filterInput);
    if (error) return res.status(400).json({ message: error.message });

    const items = await Item.find(value)
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ items });
  } catch (err) { next(err); }
}

// GET /api/items/:id
export async function getItem(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item });
  } catch (err) { next(err); }
}

// POST /api/items
export async function createItem(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const item = await Item.create(value);
    res.status(201).json({ item });
  } catch (err) {
    handleItemError(err, res, next);
  }
}

// PATCH /api/items/:id
export async function updateItem(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const { value, error } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.message });
    if (Object.keys(value).length === 0) {
      return res.status(400).json({ message: 'At least one field is required to update' });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('reportedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item });
  } catch (err) {
    handleItemError(err, res, next);
  }
}

// DELETE /api/items/:id
export async function deleteItem(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
