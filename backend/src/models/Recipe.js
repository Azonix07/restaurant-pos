const mongoose = require('mongoose');

// Bill of Materials - Recipe ingredient
const ingredientSchema = new mongoose.Schema({
  rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  wastagePercent: { type: Number, default: 0, min: 0, max: 100 },
}, { _id: true });

const recipeSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true, trim: true },
  ingredients: [ingredientSchema],
  yield: { type: Number, default: 1 }, // number of portions this recipe makes
  preparationSteps: [{ type: String }],
  kitchenSection: {
    type: String,
    enum: ['kitchen', 'bakery', 'bar', 'desserts'],
    default: 'kitchen',
  },
  estimatedCost: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

recipeSchema.index({ menuItem: 1 });

// Calculate estimated cost from ingredients
recipeSchema.methods.calculateCost = async function () {
  const RawMaterial = mongoose.model('RawMaterial');
  let totalCost = 0;
  for (const ing of this.ingredients) {
    const rm = await RawMaterial.findById(ing.rawMaterial);
    if (rm) {
      const effectiveQty = ing.quantity * (1 + ing.wastagePercent / 100);
      totalCost += effectiveQty * rm.costPerUnit;
    }
  }
  this.estimatedCost = totalCost / this.yield;
  return this.estimatedCost;
};

module.exports = mongoose.model('Recipe', recipeSchema);
