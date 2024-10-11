const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const Business = require("../models/Business");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

// previous createPayment
// exports.createPayment = async (req, res) => {
//   try {
//     const { uuid, businessId, paidAmount, dueDate } = req.body;

//     const customer = await Customer.findOne({ uuid });
//     if (!customer) {
//       return res.status(404).json({ message: "Customer not found" });
//     }

//     if (!customer.businesses || !Array.isArray(customer.businesses)) {
//       return res.status(400).json({
//         message: "Customer data is invalid. Businesses array is missing.",
//       });
//     }

//     const business = await Business.findById(businessId);
//     if (!business) {
//       return res.status(404).json({ message: "Business not found" });
//     }

//     const businessIndex = customer.businesses.findIndex(
//       (b) => b.businessId.toString() === businessId
//     );
//     if (businessIndex === -1) {
//       return res
//         .status(400)
//         .json({ message: "Customer is not associated with this business" });
//     }

//     const customerBusiness = customer.businesses[businessIndex];
//     const monthlyFee = customerBusiness.monthlyFee;
//     const previousDue = customerBusiness.totalDueAmount;
//     let remainingAmount = previousDue + monthlyFee - paidAmount;

//     // Parse the dueDate string into a Date object
//     const parsedDueDate = new Date(dueDate);
//     if (isNaN(parsedDueDate.getTime())) {
//       return res
//         .status(400)
//         .json({ message: "Invalid date format. Please use YYYY-MM-DD." });
//     }

//     const payment = new Payment({
//       customerId: customer._id,
//       businessId,
//       dueAmount: previousDue + monthlyFee,
//       paidAmount,
//       remainingAmount: Math.max(remainingAmount, 0),
//       dueDate: parsedDueDate,
//       status: remainingAmount <= 0 ? "settled" : "partially_settled",
//     });

//     await payment.save();
//     await settlePayments(customer._id, businessId, paidAmount);

//     res.status(201).json(payment);
//   } catch (error) {
//     console.error("Error in createPayment:", error);
//     res.status(500).json({
//       message: "An error occurred while processing the payment",
//       error: error.message,
//     });
//   }
// };

// previous code of settlePayment
// async function settlePayments(customerId, businessId, paidAmount) {
//   const customer = await Customer.findById(customerId);
//   const business = await Business.findById(businessId);

//   if (!customer || !business) {
//     throw new Error("Customer or Business not found");
//   }

//   const businessIndex = customer.businesses.findIndex(
//     (b) => b.businessId.toString() === businessId.toString()
//   );

//   if (businessIndex === -1) {
//     throw new Error("Business not found in customer data");
//   }

//   const customerBusiness = customer.businesses[businessIndex];
//   let remainingPaidAmount = paidAmount;

//   if (customerBusiness.totalDueAmount > 0) {
//     const settledAmount = Math.min(
//       remainingPaidAmount,
//       customerBusiness.totalDueAmount
//     );
//     customerBusiness.totalDueAmount -= settledAmount;
//     remainingPaidAmount -= settledAmount;
//   }

//   if (remainingPaidAmount > 0) {
//     customerBusiness.totalDueAmount = Math.max(
//       customerBusiness.monthlyFee - remainingPaidAmount,
//       0
//     );
//   } else {
//     customerBusiness.totalDueAmount += customerBusiness.monthlyFee;
//   }

//   // Ensure numerical addition
//   customerBusiness.totalPaymentAmount =
//     Number(customerBusiness.totalPaymentAmount) + Number(paidAmount);
//   customerBusiness.paymentHistory.push({
//     amount: paidAmount,
//     date: new Date(),
//     month: new Date().getMonth() + 1,
//     year: new Date().getFullYear(),
//   });

//   // Ensure numerical addition for mainTotalPayment
//   customer.mainTotalPayment =
//     Number(customer.mainTotalPayment) + Number(paidAmount);
//   await customer.save();

//   // Update business statistics
//   // Ensure numerical addition for totalIncome
//   business.totalIncome = Number(business.totalIncome) + Number(paidAmount);
//   business.totalDue = customerBusiness.totalDueAmount;
//   await business.save();

//   await Payment.updateMany(
//     {
//       customerId,
//       businessId,
//       status: { $ne: "settled" },
//     },
//     {
//       $set: {
//         status:
//           customerBusiness.totalDueAmount === 0
//             ? "settled"
//             : "partially_settled",
//         remainingAmount: customerBusiness.totalDueAmount,
//       },
//     }
//   );
// }

// new code of settlePayment

// new CreatePayment
exports.createPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { uuid, businessId, paidAmount, dueDate } = req.body;

    const customer = await Customer.findOne({ uuid }).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Customer not found" });
    }

    const business = await Business.findById(businessId).session(session);
    if (!business) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Business not found" });
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );
    if (businessIndex === -1) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Customer is not associated with this business" });
    }

    const customerBusiness = customer.businesses[businessIndex];
    const monthlyFee = customerBusiness.monthlyFee;
    const previousDue = customerBusiness.totalDueAmount;
    const totalDueForThisPayment = previousDue + monthlyFee;

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Invalid date format. Please use YYYY-MM-DD." });
    }

    const { settledPreviousDue, settledCurrentFee, updatedPreviousPayment } =
      await settlePayments(
        customer._id,
        businessId,
        Number(paidAmount),
        parsedDueDate,
        session
      );

    const newRemainingAmount = Math.max(
      totalDueForThisPayment - Number(paidAmount),
      0
    );

    const payment = new Payment({
      customerId: customer._id,
      businessId,
      dueAmount: totalDueForThisPayment,
      paidAmount: Number(paidAmount),
      remainingAmount: newRemainingAmount,
      dueDate: parsedDueDate,
      status: newRemainingAmount === 0 ? "settled" : "partially_settled",
      settledPreviousDue,
      settledCurrentFee,
    });

    await payment.save({ session });

    // Update customer's business info
    customerBusiness.totalPaymentAmount += Number(paidAmount);
    customerBusiness.totalDueAmount = newRemainingAmount;
    customerBusiness.paymentHistory.push({
      amount: paidAmount,
      date: new Date(),
      month: parsedDueDate.getMonth() + 1,
      year: parsedDueDate.getFullYear(),
    });

    // Update customer's main total payment
    customer.mainTotalPayment += Number(paidAmount);
    await customer.save({ session });

    // Update business statistics
    business.totalIncome += Number(paidAmount);
    business.totalDue = newRemainingAmount;
    await business.save({ session });

    await session.commitTransaction();
    res.status(201).json({ newPayment: payment, updatedPreviousPayment });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in createPayment:", error);
    res.status(500).json({
      message: "An error occurred while processing the payment",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// previous settlePayment
// async function settlePayments(customerId, businessId, paidAmount) {
//   const customer = await Customer.findById(customerId);
//   const business = await Business.findById(businessId);

//   if (!customer || !business) {
//     throw new Error("Customer or Business not found");
//   }

//   const businessIndex = customer.businesses.findIndex(
//     (b) => b.businessId.toString() === businessId.toString()
//   );

//   if (businessIndex === -1) {
//     throw new Error("Business not found in customer data");
//   }

//   const customerBusiness = customer.businesses[businessIndex];
//   let remainingPaidAmount = paidAmount;
//   let settledPreviousDue = 0;
//   let settledCurrentFee = 0;

//   // First, settle any previous due amount
//   if (customerBusiness.totalDueAmount > 0) {
//     settledPreviousDue = Math.min(
//       remainingPaidAmount,
//       customerBusiness.totalDueAmount
//     );
//     customerBusiness.totalDueAmount -= settledPreviousDue;
//     remainingPaidAmount -= settledPreviousDue;

//     // Update the status of previous month's payment to "settled"
//     await Payment.updateMany(
//       {
//         customerId,
//         businessId,
//         status: { $ne: "settled" },
//         dueDate: { $lt: new Date() },
//       },
//       {
//         $set: {
//           status: "settled",
//           remainingAmount: 0,
//         },
//       }
//     );
//   }

//   // Then, apply the remaining amount to the current month's fee
//   if (remainingPaidAmount > 0) {
//     settledCurrentFee = Math.min(
//       remainingPaidAmount,
//       customerBusiness.monthlyFee
//     );
//     const currentMonthDue = Math.max(
//       customerBusiness.monthlyFee - settledCurrentFee,
//       0
//     );
//     customerBusiness.totalDueAmount += currentMonthDue;
//   } else {
//     // If no remaining amount, add the full monthly fee to the total due
//     customerBusiness.totalDueAmount += customerBusiness.monthlyFee;
//   }

//   // Ensure numerical addition
//   customerBusiness.totalPaymentAmount =
//     Number(customerBusiness.totalPaymentAmount) + Number(paidAmount);
//   customerBusiness.paymentHistory.push({
//     amount: paidAmount,
//     date: new Date(),
//     month: new Date().getMonth() + 1,
//     year: new Date().getFullYear(),
//   });

//   // Ensure numerical addition for mainTotalPayment
//   customer.mainTotalPayment =
//     Number(customer.mainTotalPayment) + Number(paidAmount);
//   await customer.save();

//   // Update business statistics
//   // Ensure numerical addition for totalIncome
//   business.totalIncome = Number(business.totalIncome) + Number(paidAmount);
//   business.totalDue = customerBusiness.totalDueAmount;
//   await business.save();

//   // Update the current month's payment status
//   const currentMonthStatus =
//     customerBusiness.totalDueAmount === 0 ? "settled" : "partially_settled";
//   await Payment.updateMany(
//     {
//       customerId,
//       businessId,
//       status: { $ne: "settled" },
//       dueDate: { $gte: new Date() },
//     },
//     {
//       $set: {
//         status: currentMonthStatus,
//         remainingAmount: customerBusiness.totalDueAmount,
//       },
//     }
//   );

//   return { settledPreviousDue, settledCurrentFee };
// }

// new settlePayment
async function settlePayments(
  customerId,
  businessId,
  paidAmount,
  dueDate,
  session
) {
  const customer = await Customer.findById(customerId).session(session);
  const business = await Business.findById(businessId).session(session);

  if (!customer || !business) {
    throw new Error("Customer or Business not found");
  }

  const businessIndex = customer.businesses.findIndex(
    (b) => b.businessId.toString() === businessId.toString()
  );

  if (businessIndex === -1) {
    throw new Error("Business not found in customer data");
  }

  const customerBusiness = customer.businesses[businessIndex];
  let remainingPaidAmount = paidAmount;
  let settledPreviousDue = 0;
  let settledCurrentFee = 0;
  let updatedPreviousPayment = null;

  // First, settle any previous due amount
  if (customerBusiness.totalDueAmount > 0) {
    settledPreviousDue = Math.min(
      remainingPaidAmount,
      customerBusiness.totalDueAmount
    );
    customerBusiness.totalDueAmount -= settledPreviousDue;
    remainingPaidAmount -= settledPreviousDue;

    // Update the status of previous month's payment
    const previousPayment = await Payment.findOne({
      customerId,
      businessId,
      status: { $ne: "settled" },
      dueDate: { $lt: dueDate },
    })
      .sort({ dueDate: -1 })
      .session(session);

    if (previousPayment) {
      previousPayment.remainingAmount = Math.max(
        previousPayment.remainingAmount - settledPreviousDue,
        0
      );
      previousPayment.status =
        previousPayment.remainingAmount === 0 ? "settled" : "partially_settled";
      await previousPayment.save({ session });
      updatedPreviousPayment = previousPayment;
    }
  }

  // Then, apply the remaining amount to the current month's fee
  if (remainingPaidAmount > 0) {
    settledCurrentFee = Math.min(
      remainingPaidAmount,
      customerBusiness.monthlyFee
    );
    const currentMonthDue = Math.max(
      customerBusiness.monthlyFee - settledCurrentFee,
      0
    );
    customerBusiness.totalDueAmount += currentMonthDue;
  } else {
    // If no remaining amount, add the full monthly fee to the total due
    customerBusiness.totalDueAmount += customerBusiness.monthlyFee;
  }

  return { settledPreviousDue, settledCurrentFee, updatedPreviousPayment };
}

exports.getPaymentsByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { status, month, year = "all", page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    let query = { businessId: new mongoose.Types.ObjectId(businessId) };

    if (status && status !== "all") {
      if (status === "settled") {
        query.status = "settled";
      } else if (status === "partially_settled") {
        query.status = "partially_settled";
      }
    }

    if (month && month !== "all") {
      if (year === "all") {
        // If month is specified but year is 'all', use the current year
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, parseInt(month) - 1, 1);
        const endDate = new Date(currentYear, parseInt(month), 0);
        query.dueDate = { $gte: startDate, $lte: endDate };
      } else {
        const startDate = new Date(year, parseInt(month) - 1, 1);
        const endDate = new Date(year, parseInt(month), 0);
        query.dueDate = { $gte: startDate, $lte: endDate };
      }
    } else if (year !== "all") {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      query.dueDate = { $gte: startDate, $lte: endDate };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Payment.countDocuments(query);

    const payments = await Payment.find(query)
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("customerId", "name uuid phone");

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      payments,
      currentPage: pageNum,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("Error in getPaymentsByBusiness:", error);
    res.status(500).json({
      message: "An error occurred while fetching payments",
      error: error.message,
    });
  }
};

exports.getCustomerPayments = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sortField || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    if (!businessId || !searchTerm) {
      return res
        .status(200)
        .json({ message: "Business ID and search term are required" });
    }

    const customer = await Customer.findOne({
      $or: [{ uuid: searchTerm }, { phone: searchTerm }],
    });

    if (!customer) {
      return res.status(200).json([]);
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );

    if (businessIndex === -1) {
      return res
        .status(200)
        .json({
          message: "Customer is not associated with this business",
          payments: [],
        });
    }

    const query = {
      customerId: customer._id,
      businessId: new mongoose.Types.ObjectId(businessId),
    };

    const totalCount = await Payment.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const payments = await Payment.find(query)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("customerId", "name phone uuid")
      .lean();

    res.json({
      payments: payments,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("Error in getCustomerPayments:", error);
    res.status(500).json({
      message: "An error occurred while fetching customer payments",
      error: error.message,
    });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .sort({ dueDate: 1 })
      .populate("customerId", "name uuid phone");

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDuePayments = async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const duePayments = await Payment.find({
      dueDate: { $gte: startDate, $lte: endDate },
      status: { $in: ["unsettled", "partially_settled"] },
    }).sort({ dueDate: 1 });

    res.json(duePayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Requested Payment ID:", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid Payment ID");
      return res.status(400).json({ message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(id)
      .populate("customerId", "name phone")
      .populate("businessId", "name");

    console.log("Payment found:", payment);

    if (!payment) {
      console.log("Payment not found");
      return res.status(404).json({ message: "Payment not found" });
    }

    const paymentUuid = await Customer.findOne({ _id: payment.customerId });

    const paymentDetails = {
      _id: payment._id,
      uuid: paymentUuid.uuid,
      customerId: payment.customerId ? payment.customerId._id : null,
      customerName: payment.customerId ? payment.customerId.name : null,
      customerPhone: payment.customerId ? payment.customerId.phone : null,
      businessId: payment.businessId ? payment.businessId._id : null,
      businessName: payment.businessId ? payment.businessId.name : null,
      amount: payment.amount,
      paidAmount: payment.paidAmount,
      remainingAmount: payment.remainingAmount,
      dueAmount: payment.dueAmount,
      dueDate: payment.dueDate,
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };

    console.log("Payment details to be sent:", paymentDetails);

    res.json(paymentDetails);
  } catch (error) {
    console.error("Error in getPayment:", error);
    res.status(500).json({
      message: "An error occurred while fetching the payment",
      error: error.message,
    });
  }
};

exports.updatePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { paidAmount, dueDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid payment ID" });
    }

    if (typeof paidAmount !== "number" || isNaN(paidAmount) || paidAmount < 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid paid amount" });
    }

    const oldPayment = await Payment.findById(id).session(session);
    if (!oldPayment) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Payment not found" });
    }

    const newPaidAmount = oldPayment.paidAmount + paidAmount;
    const remainingAmount = Math.max(0, oldPayment.dueAmount - newPaidAmount);
    const status = remainingAmount <= 0 ? "settled" : "partially_settled";

    const updatedPayment = await Payment.findByIdAndUpdate(
      id,
      {
        paidAmount: newPaidAmount,
        remainingAmount: remainingAmount,
        status: status,
        dueDate: dueDate || oldPayment.dueDate,
      },
      { new: true, runValidators: true, session: session }
    );

    if (!updatedPayment) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Payment not found" });
    }

    const tempPayment = {
      ...updatedPayment.toObject(),
      paidAmount: paidAmount,
    };

    await updateStatistics(tempPayment);

    await session.commitTransaction();
    res.json(updatedPayment);
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in updatePayment:", error);
    res.status(400).json({
      message: "An error occurred while updating the payment",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.deletePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findById(req.params.id).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Payment not found" });
    }

    const customer = await Customer.findById(payment.customerId).session(
      session
    );
    const business = await Business.findById(payment.businessId).session(
      session
    );

    if (!customer || !business) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Customer or Business not found" });
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === payment.businessId.toString()
    );

    if (businessIndex > -1) {
      customer.businesses[businessIndex].totalPaymentAmount = Math.max(
        0,
        customer.businesses[businessIndex].totalPaymentAmount -
          payment.paidAmount
      );
      // Instead of adding to totalDueAmount, we recalculate it
      customer.businesses[businessIndex].totalDueAmount = Math.max(
        0,
        customer.businesses[businessIndex].totalDueAmount +
          payment.dueAmount -
          payment.paidAmount
      );
      customer.businesses[businessIndex].paymentHistory = customer.businesses[
        businessIndex
      ].paymentHistory.filter(
        (p) => p._id.toString() !== payment._id.toString()
      );
    }

    customer.mainTotalPayment = Math.max(
      0,
      customer.mainTotalPayment - payment.paidAmount
    );

    business.totalIncome = Math.max(
      0,
      business.totalIncome - payment.paidAmount
    );

    business.totalDue = Math.max(
      0,
      business.totalDue + payment.dueAmount - payment.paidAmount
    );

    await customer.save({ session });
    await business.save({ session });
    await Payment.findByIdAndDelete(req.params.id, { session });

    await session.commitTransaction();
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in deletePayment:", error);
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

exports.deleteMultiplePayments = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentIds } = req.body;

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Invalid or empty payment IDs array" });
    }

    const validPaymentIds = paymentIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validPaymentIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "No valid payment IDs provided" });
    }

    const payments = await Payment.find({
      _id: { $in: validPaymentIds },
    }).session(session);

    if (payments.length === 0) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "No payments found with the provided IDs" });
    }

    for (const payment of payments) {
      const customer = await Customer.findById(payment.customerId).session(
        session
      );
      const business = await Business.findById(payment.businessId).session(
        session
      );

      if (!customer || !business) {
        await session.abortTransaction();
        return res.status(404).json({
          message: `Customer or Business not found for payment: ${payment._id}`,
        });
      }

      const businessIndex = customer.businesses.findIndex(
        (b) => b.businessId.toString() === payment.businessId.toString()
      );

      if (businessIndex > -1) {
        customer.businesses[businessIndex].totalPaymentAmount = Math.max(
          0,
          customer.businesses[businessIndex].totalPaymentAmount -
            payment.paidAmount
        );
        customer.businesses[businessIndex].totalDueAmount += payment.paidAmount;
        customer.businesses[businessIndex].paymentHistory = customer.businesses[
          businessIndex
        ].paymentHistory.filter(
          (p) => p._id.toString() !== payment._id.toString()
        );
      }

      customer.mainTotalPayment = Math.max(
        0,
        customer.mainTotalPayment - payment.paidAmount
      );

      business.totalIncome = Math.max(
        0,
        business.totalIncome - payment.paidAmount
      );

      business.totalDue += payment.dueAmount - payment.paidAmount;

      await customer.save({ session });
      await business.save({ session });
    }

    const deleteResult = await Payment.deleteMany(
      { _id: { $in: validPaymentIds } },
      { session }
    );

    await session.commitTransaction();
    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} payments`,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in deleteMultiplePayments:", error);
    res.status(500).json({
      message: "An error occurred while deleting payments",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

async function updateStatistics(payment, isDelete = false) {
  try {
    const customer = await Customer.findById(payment.customerId);
    const business = await Business.findById(payment.businessId);

    if (!customer || !business) {
      throw new Error("Customer or Business not found");
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === payment.businessId.toString()
    );

    if (businessIndex > -1) {
      if (isDelete) {
        customer.businesses[businessIndex].totalPaymentAmount =
          Number(customer.businesses[businessIndex].totalPaymentAmount) -
          Number(payment.paidAmount);
        customer.businesses[businessIndex].totalDueAmount =
          Number(customer.businesses[businessIndex].totalDueAmount) +
          Number(payment.paidAmount);
        customer.businesses[businessIndex].paymentHistory = customer.businesses[
          businessIndex
        ].paymentHistory.filter(
          (p) => p._id.toString() !== payment._id.toString()
        );
      } else {
        customer.businesses[businessIndex].totalPaymentAmount =
          Number(customer.businesses[businessIndex].totalPaymentAmount) +
          Number(payment.paidAmount);
        customer.businesses[businessIndex].totalDueAmount = Number(
          payment.remainingAmount
        );
        customer.businesses[businessIndex].paymentHistory.push({
          amount: payment.paidAmount,
          date: payment.dueDate,
          month: payment.dueDate.getMonth() + 1,
          year: payment.dueDate.getFullYear(),
        });
      }
    }

    customer.mainTotalPayment = isDelete
      ? Number(customer.mainTotalPayment) - Number(payment.paidAmount)
      : Number(customer.mainTotalPayment) + Number(payment.paidAmount);
    await customer.save();

    business.totalIncome = isDelete
      ? Number(business.totalIncome) - Number(payment.paidAmount)
      : Number(business.totalIncome) + Number(payment.paidAmount);
    business.totalDue = isDelete
      ? Number(business.totalDue) + Number(payment.paidAmount)
      : Number(payment.remainingAmount);
    await business.save();
  } catch (error) {
    console.error("Error updating statistics:", error);
    throw error;
  }
}

exports.getUnpaidCustomers = async (req, res) => {
  try {
    const { businessId, month, year } = req.query;

    if (!businessId || !month || !year) {
      return res
        .status(400)
        .json({ message: "BusinessId, month, and year are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid businessId format" });
    }

    const parsedMonth = parseInt(month, 10);
    const parsedYear = parseInt(year, 10);
    if (
      isNaN(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      isNaN(parsedYear)
    ) {
      return res.status(400).json({ message: "Invalid month or year" });
    }

    const startDate = new Date(parsedYear, parsedMonth - 1, 1);
    const endDate = new Date(parsedYear, parsedMonth, 0);

    const customers = await Customer.find({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
    });

    const payments = await Payment.find({
      businessId: new mongoose.Types.ObjectId(businessId),
      dueDate: { $gte: startDate, $lte: endDate },
    });

    const paidCustomerIds = new Set(
      payments.map((payment) => payment.customerId.toString())
    );

    const unpaidCustomers = customers.filter((customer) => {
      const businessIndex = customer.businesses.findIndex(
        (b) => b.businessId.toString() === businessId
      );
      if (businessIndex === -1) return false;

      const hasPaid = paidCustomerIds.has(customer._id.toString());
      const hasMonthlyFee = customer.businesses[businessIndex].monthlyFee > 0;

      return !hasPaid && hasMonthlyFee;
    });

    const formattedUnpaidCustomers = unpaidCustomers.map((customer) => {
      const businessIndex = customer.businesses.findIndex(
        (b) => b.businessId.toString() === businessId
      );
      return {
        customerId: customer._id,
        name: customer.name,
        phone: customer.phone,
        uuid: customer.uuid,
        monthlyFee: customer.businesses[businessIndex].monthlyFee,
        totalDueAmount: customer.businesses[businessIndex].totalDueAmount,
      };
    });

    res.json(formattedUnpaidCustomers);
  } catch (error) {
    console.error("Error in getUnpaidCustomers:", error);
    res.status(500).json({
      message: "An error occurred while fetching unpaid customers",
      error: error.message,
    });
  }
};

exports.getPaymentPDF = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(id)
      .populate("customerId", "name phone")
      .populate("businessId", "name");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const doc = new PDFDocument();
    const filename = `payment-${payment._id}.pdf`;

    res.setHeader(
      "Content-disposition",
      'attachment; filename="' + filename + '"'
    );
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(20).text("Payment Details", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Payment ID: ${payment._id}`);
    doc.text(
      `Customer: ${payment.customerId ? payment.customerId.name : "N/A"}`
    );
    doc.text(
      `Customer Phone: ${payment.customerId ? payment.customerId.phone : "N/A"}`
    );
    doc.text(
      `Business: ${payment.businessId ? payment.businessId.name : "N/A"}`
    );
    doc.text(`Amount: $${payment.amount.toFixed(2)}`);
    doc.text(`Paid Amount: $${payment.paidAmount.toFixed(2)}`);
    doc.text(`Remaining Amount: $${payment.remainingAmount.toFixed(2)}`);
    doc.text(`Due Date: ${payment.dueDate.toDateString()}`);
    doc.text(`Status: ${payment.status}`);
    doc.text(`Created At: ${payment.createdAt.toDateString()}`);
    doc.text(`Updated At: ${payment.updatedAt.toDateString()}`);

    doc.end();
  } catch (error) {
    console.error("Error in getPaymentPDF:", error);
    res.status(500).json({
      message: "An error occurred while generating the PDF",
      error: error.message,
    });
  }
};
