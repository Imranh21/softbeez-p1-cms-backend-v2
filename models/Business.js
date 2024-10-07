const mongoose = require("mongoose");

const BusinessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: false },
    address: { type: String, required: false },
    totalCustomer: { type: Number, default: 0 },
    totalIncome: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", BusinessSchema);
