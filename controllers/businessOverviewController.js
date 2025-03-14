const mongoose = require("mongoose");
const Business = require("../models/Business");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");

// exports.getBusinessOverview = async (req, res) => {
//   try {
//     const { businessId } = req.params;

//     const business = await Business.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ message: "Business not found" });
//     }

//     const [incomeAndDue, customerCount, yearsWithData] = await Promise.all([
//       Payment.aggregate([
//         {
//           $match: {
//             businessId: new mongoose.Types.ObjectId(businessId),
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalIncome: { $sum: "$paidAmount" },
//             totalDue: { $sum: "$remainingAmount" },
//           },
//         },
//       ]),
//       Customer.countDocuments({ "businesses.businessId": businessId }),
//       Payment.aggregate([
//         {
//           $match: {
//             businessId: new mongoose.Types.ObjectId(businessId),
//           },
//         },
//         {
//           $group: {
//             _id: { $year: "$createdAt" },
//           },
//         },
//         {
//           $sort: { _id: -1 },
//         },
//       ]),
//     ]);

//     const totalIncome = incomeAndDue[0]?.totalIncome || 0;
//     const totalDue = incomeAndDue[0]?.totalDue || 0;
//     const totalCustomer = customerCount;

//     // Update the business document with the latest calculations
//     await Business.findByIdAndUpdate(businessId, {
//       totalIncome,
//       totalDue,
//       totalCustomer,
//     });

//     // Extract years and get the most recent year
//     const years = yearsWithData.map((item) => item._id);
//     const mostRecentYear = years[0] || new Date().getFullYear();

//     const monthlyStats = await Payment.aggregate([
//       {
//         $match: {
//           businessId: new mongoose.Types.ObjectId(businessId),
//           createdAt: {
//             $gte: new Date(`${mostRecentYear}-01-01`),
//             $lte: new Date(`${mostRecentYear}-12-31`),
//           },
//         },
//       },
//       {
//         $group: {
//           _id: { $month: "$createdAt" },
//           income: { $sum: "$paidAmount" },
//           due: { $sum: "$remainingAmount" },
//         },
//       },
//       {
//         $sort: { _id: 1 },
//       },
//     ]);

//     const monthNames = [
//       "January",
//       "February",
//       "March",
//       "April",
//       "May",
//       "June",
//       "July",
//       "August",
//       "September",
//       "October",
//       "November",
//       "December",
//     ];

//     const monthlyIncomeVsDue = Array(12)
//       .fill()
//       .map((_, index) => {
//         const monthData = monthlyStats.find(
//           (stat) => stat._id === index + 1
//         ) || { income: 0, due: 0 };
//         return {
//           month: monthNames[index],
//           income: monthData.income,
//           due: monthData.due,
//         };
//       });

//     const recentPayments = await Payment.find({ businessId: businessId })
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .populate("customerId", "name phone uuid")
//       .lean();

//     const formattedRecentPayments = recentPayments.map((payment) => ({
//       id: payment._id,
//       customerName: payment.customerId?.name,
//       customerPhone: payment.customerId?.phone,
//       customerUuid: payment.customerId?.uuid,
//       payableAmount: payment.dueAmount,
//       remainingAmount: payment.remainingAmount,
//       amount: payment.paidAmount,
//       date: payment.createdAt,
//       status: payment.status,
//       monthlyFee: payment.monthlyFee,
//     }));

//     res.json({
//       totalIncome,
//       totalDue,
//       totalCustomer,
//       monthlyIncomeVsDue,
//       recentPayments: formattedRecentPayments,
//       years,
//       currentYear: mostRecentYear,
//     });
//   } catch (error) {
//     console.error("Error in getBusinessOverview:", error);
//     res.status(500).json({
//       message: "An error occurred while fetching business overview",
//       error: error.message,
//     });
//   }
// };

// const mongoose = require("mongoose");
// const Business = require("../models/Business");
// const Payment = require("../models/Payment");
// const Customer = require("../models/Customer");

// exports.getBusinessOverview = async (req, res) => {
//   try {
//     const { businessId } = req.params;
//     const { year } = req.query;

//     const business = await Business.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ message: "Business not found" });
//     }

//     const totalIncome = business.totalIncome;
//     const totalDue = business.totalDue;
//     const totalCustomer = business.totalCustomer;

//     const monthlyStats = await Payment.aggregate([
//       {
//         $match: {
//           businessId: new mongoose.Types.ObjectId(businessId),
//           createdAt: {
//             $gte: new Date(`${year}-01-01`),
//             $lte: new Date(`${year}-12-31`),
//           },
//         },
//       },
//       {
//         $group: {
//           _id: { $month: "$createdAt" },
//           income: { $sum: "$paidAmount" },
//           due: { $sum: "$remainingAmount" },
//         },
//       },
//       {
//         $sort: { _id: 1 },
//       },
//     ]);

//     const monthNames = [
//       "January",
//       "February",
//       "March",
//       "April",
//       "May",
//       "June",
//       "July",
//       "August",
//       "September",
//       "October",
//       "November",
//       "December",
//     ];

//     const monthlyIncomeVsDue = Array(12)
//       .fill()
//       .map((_, index) => {
//         const monthData = monthlyStats.find(
//           (stat) => stat._id === index + 1
//         ) || { income: 0, due: 0 };
//         return {
//           month: monthNames[index],
//           income: monthData.income,
//           due: monthData.due,
//         };
//       });

//     const recentPayments = await Payment.find({ businessId: businessId })
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .populate("customerId", "name phone uuid")
//       .lean();

//     const formattedRecentPayments = recentPayments.map((payment) => ({
//       id: payment._id,
//       customerName: payment.customerId?.name,
//       customerPhone: payment.customerId?.phone,
//       customerUuid: payment.customerId?.uuid,
//       payableAmount: payment?.dueAmount,
//       remainingAmount: payment?.remainingAmount,
//       amount: payment.paidAmount,
//       date: payment.createdAt,
//       status: payment.status,
//       payableAmount: payment?.monthlyFee,
//     }));

//     res.json({
//       totalIncome,
//       totalDue,
//       totalCustomer,
//       monthlyIncomeVsDue,
//       recentPayments: formattedRecentPayments,
//     });
//   } catch (error) {
//     console.error("Error in getBusinessOverview:", error);
//     res.status(500).json({ message: error.message });
//   }
// };

// exports.getBusinessOverview = async (req, res) => {
//   try {
//     const { businessId } = req.params;

//     const business = await Business.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ message: "Business not found" });
//     }

//     const [incomeAndDue, customerCount, yearsWithData] = await Promise.all([
//       Payment.aggregate([
//         {
//           $match: {
//             businessId: new mongoose.Types.ObjectId(businessId),
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalIncome: { $sum: "$paidAmount" },
//             totalDue: { $sum: "$remainingAmount" },
//           },
//         },
//       ]),
//       Customer.countDocuments({ "businesses.businessId": businessId }),
//       Payment.aggregate([
//         {
//           $match: {
//             businessId: new mongoose.Types.ObjectId(businessId),
//           },
//         },
//         {
//           $group: {
//             _id: { $year: "$dueDate" },
//           },
//         },
//         {
//           $sort: { _id: -1 },
//         },
//       ]),
//     ]);

//     const totalIncome = incomeAndDue[0]?.totalIncome || 0;
//     const totalDue = incomeAndDue[0]?.totalDue || 0;
//     const totalCustomer = customerCount;

//     await Business.findByIdAndUpdate(businessId, {
//       totalIncome,
//       totalDue,
//       totalCustomer,
//     });

//     // Extract years and get the most recent year
//     const years = yearsWithData.map((item) => item._id);
//     const mostRecentYear = years[0] || new Date().getFullYear();

//     const monthlyStats = await Payment.aggregate([
//       {
//         $match: {
//           businessId: new mongoose.Types.ObjectId(businessId),
//           dueDate: {
//             $gte: new Date(`${mostRecentYear}-01-01`),
//             $lte: new Date(`${mostRecentYear}-12-31`),
//           },
//         },
//       },
//       {
//         $group: {
//           _id: { $month: "$dueDate" },
//           income: { $sum: "$paidAmount" },
//           due: { $sum: "$remainingAmount" },
//         },
//       },
//       {
//         $sort: { _id: 1 },
//       },
//     ]);

//     const monthNames = [
//       "January",
//       "February",
//       "March",
//       "April",
//       "May",
//       "June",
//       "July",
//       "August",
//       "September",
//       "October",
//       "November",
//       "December",
//     ];

//     const monthlyIncomeVsDue = Array(12)
//       .fill()
//       .map((_, index) => {
//         const monthData = monthlyStats.find(
//           (stat) => stat._id === index + 1
//         ) || { income: 0, due: 0 };
//         return {
//           month: monthNames[index],
//           income: monthData.income,
//           due: monthData.due,
//         };
//       });

//     const recentPayments = await Payment.find({ businessId: businessId })
//       .sort({ dueDate: -1 })
//       .limit(5)
//       .populate("customerId", "name phone uuid")
//       .lean();

//     const formattedRecentPayments = recentPayments.map((payment) => ({
//       id: payment._id,
//       customerName: payment.customerId?.name,
//       customerPhone: payment.customerId?.phone,
//       customerUuid: payment.customerId?.uuid,
//       payableAmount: payment.dueAmount,
//       remainingAmount: payment.remainingAmount,
//       amount: payment.paidAmount,
//       date: payment.dueDate,
//       status: payment.status,
//       monthlyFee: payment.monthlyFee,
//     }));

//     res.json({
//       totalIncome,
//       totalDue,
//       totalCustomer,
//       monthlyIncomeVsDue,
//       recentPayments: formattedRecentPayments,
//       years,
//       currentYear: mostRecentYear,
//     });
//   } catch (error) {
//     console.error("Error in getBusinessOverview:", error);
//     res.status(500).json({
//       message: "An error occurred while fetching business overview",
//       error: error.message,
//     });
//   }
// };

exports.getBusinessOverview = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { year } = req.query;

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const [incomeAndDue, customerCount, yearsWithData] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            dueDate: {
              $gte: new Date(`${currentYear}-01-01`),
              $lte: new Date(`${currentYear}-12-31`),
            },
          },
        },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: "$paidAmount" },
            totalDue: { $sum: "$remainingAmount" },
          },
        },
      ]),
      Customer.countDocuments({ "businesses.businessId": businessId }),
      Payment.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
          },
        },
        {
          $group: {
            _id: { $year: "$dueDate" },
          },
        },
        {
          $sort: { _id: -1 },
        },
      ]),
    ]);

    const totalIncome = incomeAndDue[0]?.totalIncome || 0;
    const totalDue = incomeAndDue[0]?.totalDue || 0;
    const totalCustomer = customerCount;

    await Business.findByIdAndUpdate(businessId, {
      totalIncome,
      totalDue,
      totalCustomer,
    });

    // Extract years
    const years = yearsWithData.map((item) => item._id);

    const monthlyStats = await Payment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          dueDate: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$dueDate" },
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

    const recentPayments = await Payment.find({
      businessId: businessId,
      dueDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    })
      .sort({ dueDate: -1 })
      .limit(5)
      .populate("customerId", "name phone uuid")
      .lean();

    const formattedRecentPayments = recentPayments.map((payment) => ({
      id: payment._id,
      customerName: payment.customerId?.name,
      customerPhone: payment.customerId?.phone,
      customerUuid: payment.customerId?.uuid,
      payableAmount: payment.dueAmount,
      remainingAmount: payment.remainingAmount,
      amount: payment.paidAmount,
      date: payment.dueDate,
      status: payment.status,
      monthlyFee: payment.monthlyFee,
    }));

    res.json({
      totalIncome,
      totalDue,
      totalCustomer,
      monthlyIncomeVsDue,
      recentPayments: formattedRecentPayments,
      years,
      currentYear,
    });
  } catch (error) {
    console.error("Error in getBusinessOverview:", error);
    res.status(500).json({
      message: "An error occurred while fetching business overview",
      error: error.message,
    });
  }
};
