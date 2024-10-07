const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    uuid: { type: String, required: true, unique: true },
    mainTotalPayment: { type: Number, default: 0 },
    businesses: [
      {
        businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
        totalPaymentAmount: { type: Number, default: 0 },
        totalDueAmount: { type: Number, default: 0 },
        payableAmount: { type: Number, default: 0 },
        monthlyFee: { type: Number, required: true },
        paymentHistory: [
          {
            amount: Number,
            date: Date,
            month: Number,
            year: Number,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", CustomerSchema);
