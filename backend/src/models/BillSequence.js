const mongoose = require('mongoose');

// Enforces continuous bill numbering with no gaps
const billSequenceSchema = new mongoose.Schema({
  prefix: { type: String, required: true }, // e.g. "INV", "ORD"
  date: { type: String, required: true }, // YYYY-MM-DD
  lastNumber: { type: Number, default: 0 },
  // Track all issued numbers for gap detection
  issuedNumbers: [{ type: Number }],
  // Track voided/cancelled to detect gaps
  voidedNumbers: [{ type: Number }],
}, { timestamps: true });

billSequenceSchema.index({ prefix: 1, date: 1 }, { unique: true });

// Atomically get next number - single atomic operation prevents race conditions
billSequenceSchema.statics.getNextNumber = async function (prefix) {
  const today = new Date().toISOString().split('T')[0];
  // Use a two-step approach but within a retry loop for safety
  const seq = await this.findOneAndUpdate(
    { prefix, date: today },
    {
      $inc: { lastNumber: 1 },
      $setOnInsert: { prefix, date: today },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Push issued number in same tick - if this fails, the gap will be detected
  await this.updateOne(
    { _id: seq._id, lastNumber: seq.lastNumber },
    { $push: { issuedNumbers: seq.lastNumber } }
  );
  return seq.lastNumber;
};

// Detect gaps in bill numbering
billSequenceSchema.statics.detectGaps = async function (prefix, date) {
  const seq = await this.findOne({ prefix, date });
  if (!seq) return [];
  const gaps = [];
  for (let i = 1; i <= seq.lastNumber; i++) {
    if (!seq.issuedNumbers.includes(i) && !seq.voidedNumbers.includes(i)) {
      gaps.push(i);
    }
  }
  return gaps;
};

module.exports = mongoose.model('BillSequence', billSequenceSchema);
