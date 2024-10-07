const mongoose = require("mongoose");
const Business = require("../models/Business");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");

exports.getBusinessOverview = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { year } = req.query;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const totalIncome = business.totalIncome;
    const totalDue = business.totalDue;
    const totalCustomer = business.totalCustomer;

    const monthlyStats = await Payment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          income: { $sum: "$paidAmount" },
          due: { $sum: "$remainingAmount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const monthlyIncomeVsDue = Array(12)
      .fill()
      .map((_, index) => {
        const monthData = monthlyStats.find(
          (stat) => stat._id === index + 1
        ) || { income: 0, due: 0 };
        return {
          month: monthNames[index],
          income: monthData.income,
          due: monthData.due,
        };
      });

    const recentPayments = await Payment.find({ businessId: businessId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customerId", "name phone")
      .lean();

    const formattedRecentPayments = recentPayments.map((payment) => ({
      id: payment._id,
      customerName: payment.customerId.name,
      customerPhone: payment.customerId.phone,
      customerUuid: payment.customerId.uuid,
      amount: payment.paidAmount,
      date: payment.createdAt,
      status: payment.status,
      payableAmount: payment?.monthlyFee,
    }));

    res.json({
      totalIncome,
      totalDue,
      totalCustomer,
      monthlyIncomeVsDue,
      recentPayments: formattedRecentPayments,
    });
  } catch (error) {
    console.error("Error in getBusinessOverview:", error);
    res.status(500).json({ message: error.message });
  }
};
