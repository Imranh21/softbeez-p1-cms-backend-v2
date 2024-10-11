const Customer = require("../models/Customer");
const Business = require("../models/Business");
const Payment = require("../models/Payment");
const mongoose = require("mongoose");

exports.createOrUpdateCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, phone, businessId, monthlyFee, uuid } = req.body;

    const business = await Business.findById(businessId).session(session);
    if (!business) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Business not found" });
    }

    let customer = await Customer.findOne({ uuid }).session(session);
    let isNewCustomer = false;

    if (!customer) {
      customer = new Customer({
        name,
        phone,
        uuid,
        businesses: [],
      });
      isNewCustomer = true;
    }

    const existingBusinessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );

    if (existingBusinessIndex === -1) {
      customer.businesses.push({
        businessId,
        monthlyFee,
        payableAmount: monthlyFee,
        totalPaymentAmount: 0,
        totalDueAmount: 0,
        paymentHistory: [],
      });

      business.totalCustomer += 1;
      await business.save({ session });
    } else {
      customer.businesses[existingBusinessIndex].monthlyFee = monthlyFee;
      customer.businesses[existingBusinessIndex].payableAmount = monthlyFee;
    }

    await customer.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      message: isNewCustomer
        ? "New customer created and associated with business"
        : "Existing customer associated with new business",
      customer,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in createOrUpdateCustomer:", error);
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

exports.addPayment = async (req, res) => {
  try {
    const { customerId, businessId, amount, month, year } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );
    if (businessIndex === -1) {
      return res
        .status(400)
        .json({ message: "Customer is not associated with this business" });
    }

    const business = customer.businesses[businessIndex];
    const totalDue = business.payableAmount;

    business.paymentHistory.push({
      amount,
      date: new Date(),
      month,
      year,
    });

    business.totalPaymentAmount += amount;
    customer.mainTotalPayment += amount;

    const remainingDue = totalDue - amount;

    if (remainingDue <= 0) {
      business.totalDueAmount = 0;
      business.payableAmount = business.monthlyFee;
    } else {
      business.totalDueAmount = remainingDue;
      business.payableAmount = remainingDue + business.monthlyFee;
    }

    await customer.save();

    const businessDoc = await Business.findById(businessId);
    businessDoc.totalIncome += amount;
    businessDoc.totalDue = business.totalDueAmount;
    await businessDoc.save();

    res.json({ message: "Payment added successfully", customer });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getDuePayments = async (req, res) => {
  try {
    const { businessId, month, year } = req.query;

    const customers = await Customer.find({
      "businesses.businessId": businessId,
      "businesses.totalDueAmount": { $gt: 0 },
    });

    const duePayments = customers
      .map((customer) => {
        const business = customer.businesses.find(
          (b) => b.businessId.toString() === businessId
        );
        return {
          customerId: customer._id,
          customerName: customer.name,
          customerPhone: customer.phone,
          dueAmount: business.totalDueAmount,
          monthlyFee: business.monthlyFee,
          lastPayment:
            business.paymentHistory.length > 0
              ? business.paymentHistory[business.paymentHistory.length - 1]
              : null,
        };
      })
      .filter((payment) => {
        if (!payment.lastPayment) return true;
        return (
          payment.lastPayment.month !== parseInt(month) ||
          payment.lastPayment.year !== parseInt(year)
        );
      });

    res.json(duePayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// exports.getAllCustomers = async (req, res) => {
//   try {
//     const { businessId } = req.query;

//     if (!businessId) {
//       return res
//         .status(400)
//         .json({ message: "BusinessId is required as a query parameter" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(businessId)) {
//       return res.status(400).json({ message: "Invalid business ID" });
//     }

//     const customers = await Customer.find({
//       "businesses.businessId": new mongoose.Types.ObjectId(businessId),
//     });

//     const formattedCustomers = customers.map((customer) => {
//       const businessInfo = customer.businesses.find(
//         (b) => b.businessId.toString() === businessId
//       );
//       return {
//         _id: customer._id,
//         name: customer.name,
//         phone: customer.phone,
//         uuid: customer.uuid,
//         businessInfo: {
//           businessId: businessInfo.businessId,
//           monthlyFee: businessInfo.monthlyFee,
//           payableAmount: businessInfo.payableAmount,
//           totalPaymentAmount: businessInfo.totalPaymentAmount,
//           totalDueAmount: businessInfo.totalDueAmount,
//           paymentHistory: businessInfo.paymentHistory,
//         },
//       };
//     });

//     res.json(formattedCustomers);
//   } catch (error) {
//     console.error("Error in getAllCustomers:", error);
//     res.status(500).json({
//       message: "An error occurred while fetching customers",
//       error: error.message,
//     });
//   }
// };

// previous code
exports.getAllCustomers = async (req, res) => {
  try {
    const {
      businessId,
      page = 1,
      limit = 10,
      sortField = "name",
      sortOrder = "asc",
    } = req.query;

    if (!businessId) {
      return res
        .status(400)
        .json({ message: "BusinessId is required as a query parameter" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    if (
      isNaN(pageNumber) ||
      isNaN(pageSize) ||
      pageNumber < 1 ||
      pageSize < 1
    ) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    const skip = (pageNumber - 1) * pageSize;

    const sortOptions = {};
    sortOptions[sortField] = sortOrder === "desc" ? -1 : 1;

    const totalCount = await Customer.countDocuments({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
    });

    const customers = await Customer.find({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
    })
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    const formattedCustomers = customers.map((customer) => {
      const businessInfo = customer.businesses.find(
        (b) => b.businessId.toString() === businessId
      );
      return {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        uuid: customer.uuid,
        businessInfo: {
          businessId: businessInfo.businessId,
          monthlyFee: businessInfo.monthlyFee,
          payableAmount: businessInfo.payableAmount,
          totalPaymentAmount: businessInfo.totalPaymentAmount,
          totalDueAmount: businessInfo.totalDueAmount,
          paymentHistory: businessInfo.paymentHistory,
        },
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    res.json({
      customers: formattedCustomers,
      currentPage: pageNumber,
      totalPages: totalPages,
      totalCount: totalCount,
    });
  } catch (error) {
    console.error("Error in getAllCustomers:", error);
    res.status(500).json({
      message: "An error occurred while fetching customers",
      error: error.message,
    });
  }
};

// new code
exports.getAllCustomers = async (req, res) => {
  try {
    const {
      businessId,
      page = 1,
      limit = 10,
      sortField = "name",
      sortOrder = "asc",
    } = req.query;

    if (!businessId) {
      return res
        .status(400)
        .json({ message: "BusinessId is required as a query parameter" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    if (
      isNaN(pageNumber) ||
      isNaN(pageSize) ||
      pageNumber < 1 ||
      pageSize < 1
    ) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    const skip = (pageNumber - 1) * pageSize;

    const sortOptions = {};
    sortOptions[sortField] = sortOrder === "desc" ? -1 : 1;

    const totalCount = await Customer.countDocuments({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
    });

    const customers = await Customer.find({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
    })
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    const formattedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const businessInfo = customer.businesses.find(
          (b) => b.businessId.toString() === businessId
        );

        // Calculate the correct totalDueAmount
        const latestPayment = await Payment.findOne({
          customerId: customer._id,
          businessId: new mongoose.Types.ObjectId(businessId),
        }).sort({ dueDate: -1 });

        const totalDueAmount = latestPayment
          ? latestPayment.remainingAmount
          : businessInfo.totalDueAmount;

        return {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
          uuid: customer.uuid,
          businessInfo: {
            businessId: businessInfo.businessId,
            monthlyFee: businessInfo.monthlyFee,
            payableAmount: businessInfo.payableAmount,
            totalPaymentAmount: businessInfo.totalPaymentAmount,
            totalDueAmount: totalDueAmount,
            paymentHistory: businessInfo.paymentHistory,
          },
        };
      })
    );

    const totalPages = Math.ceil(totalCount / pageSize);

    res.json({
      customers: formattedCustomers,
      currentPage: pageNumber,
      totalPages: totalPages,
      totalCount: totalCount,
    });
  } catch (error) {
    console.error("Error in getAllCustomers:", error);
    res.status(500).json({
      message: "An error occurred while fetching customers",
      error: error.message,
    });
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// exports.deleteCustomer = async (req, res) => {
//   try {
//     const customer = await Customer.findByIdAndDelete(req.params.id);
//     if (!customer)
//       return res.status(404).json({ message: "Customer not found" });

//     // Update business statistics
//     for (const business of customer.businesses) {
//       const businessDoc = await Business.findById(business.businessId);
//       if (businessDoc) {
//         businessDoc.totalCustomer -= 1;
//         businessDoc.totalDue -= business.totalDueAmount;
//         await businessDoc.save();
//       }
//     }

//     res.json({ message: "Customer deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// exports.getCustomerDetails = async (req, res) => {
//   try {
//     const customerId = req.userData.customerId; // Assuming we store customerId in the token
//     const customer = await Customer.findById(customerId).populate(
//       "businesses.businessId",
//       "name"
//     );

//     if (!customer) {
//       return res.status(404).json({ message: "Customer not found" });
//     }

//     const customerDetails = {
//       name: customer.name,
//       phone: customer.phone,
//       uuid: customer.uuid,
//       mainTotalPayment: customer.mainTotalPayment,
//       businesses: customer.businesses.map((business) => ({
//         businessName: business.businessId.name,
//         totalPaymentAmount: business.totalPaymentAmount,
//         totalDueAmount: business.totalDueAmount,
//         payableAmount: business.payableAmount,
//         monthlyFee: business.monthlyFee,
//         paymentHistory: business.paymentHistory,
//       })),
//     };

//     res.json(customerDetails);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.deleteCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, businessId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(businessId)
    ) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Invalid customer ID or business ID" });
    }

    const customer = await Customer.findById(id).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Customer not found" });
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );

    if (businessIndex === -1) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Customer is not associated with this business" });
    }

    const removedBusiness = customer.businesses.splice(businessIndex, 1)[0];

    await Payment.deleteMany({
      customerId: customer._id,
      businessId: removedBusiness.businessId,
    }).session(session);

    await Business.findByIdAndUpdate(businessId, {
      $inc: {
        totalCustomer: -1,
        totalDue: -removedBusiness.totalDueAmount,
      },
    }).session(session);

    if (customer.businesses.length === 0) {
      await Customer.findByIdAndDelete(id).session(session);
    } else {
      await customer.save({ session });
    }

    await session.commitTransaction();

    res.json({
      message:
        "Customer removed from business and associated payments deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in deleteCustomer:", error);
    res.status(500).json({
      message: "An error occurred while deleting the customer",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await Customer.findById(customerId).populate(
      "businesses.businessId",
      "name"
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    let totalDue = 0;
    let totalPaid = 0;

    const customerDetails = {
      name: customer.name,
      phone: customer.phone,
      uuid: customer.uuid,
      mainTotalPayment: customer.mainTotalPayment,
      businesses: await Promise.all(
        customer.businesses.map(async (business) => {
          const payments = await Payment.find({
            customerId: customerId,
            businessId: business.businessId._id,
          }).sort({ dueDate: -1 });

          let businessTotalDue = 0;
          let businessTotalPaid = 0;

          const paymentHistory = payments.map((payment) => {
            businessTotalDue += payment.remainingAmount;
            businessTotalPaid += payment.paidAmount;

            return {
              _id: payment._id,
              amount: payment.amount,
              paidAmount: payment.paidAmount,
              payableAmount: payment.payableAmount || business.payableAmount,
              dueAmount: payment.dueAmount,
              remainingAmount: payment.remainingAmount,
              date: payment.dueDate,
              month: payment.dueDate.getMonth() + 1,
              year: payment.dueDate.getFullYear(),
              status: payment.status,
            };
          });

          totalDue += businessTotalDue;
          totalPaid += businessTotalPaid;

          return {
            businessId: business.businessId._id,
            businessName: business.businessId.name,
            totalPaymentAmount: businessTotalPaid,
            totalDueAmount: businessTotalDue,
            payableAmount: business.payableAmount,
            monthlyFee: business.monthlyFee,
            paymentHistory,
          };
        })
      ),
    };

    customerDetails.totalDue = totalDue;
    customerDetails.totalPaid = totalPaid;

    res.json(customerDetails);
  } catch (error) {
    console.error("Error in getCustomerDetails:", error);
    res.status(500).json({
      message: "An error occurred while fetching customer details",
      error: error.message,
    });
  }
};

exports.searchCustomers = async (req, res) => {
  try {
    const { businessId, searchTerm } = req.query;

    if (!businessId || !searchTerm) {
      return res
        .status(400)
        .json({ message: "Business ID and search term are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const searchRegex = new RegExp(searchTerm, "i");

    const customers = await Customer.find({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
      $or: [
        { uuid: searchRegex },
        { name: searchRegex },
        { phone: searchRegex },
      ],
    }).limit(10);

    const formattedCustomers = customers.map((customer) => {
      const businessInfo = customer.businesses.find(
        (b) => b.businessId.toString() === businessId
      );

      return {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        uuid: customer.uuid,
        businessInfo: {
          businessId: businessInfo.businessId,
          monthlyFee: businessInfo.monthlyFee,
          payableAmount: businessInfo.payableAmount,
          totalPaymentAmount: businessInfo.totalPaymentAmount,
          totalDueAmount: businessInfo.totalDueAmount,
          paymentHistory: businessInfo.paymentHistory.map((payment) => ({
            amount: payment.amount,
            date: payment.date,
            month: payment.month,
            year: payment.year,
            _id: payment._id,
          })),
        },
      };
    });

    res.json(formattedCustomers);
  } catch (error) {
    console.error("Error in searchCustomers:", error);
    res.status(500).json({
      message: "An error occurred while searching for customers",
      error: error.message,
    });
  }
};

exports.searchCustomerBeforeAdding = async (req, res) => {
  try {
    const { searchTerm } = req.query;

    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }

    const searchRegex = new RegExp(searchTerm, "i");

    const customer = await Customer.findOne({
      $or: [
        { uuid: searchRegex },
        { name: searchRegex },
        { phone: searchRegex },
      ],
    })
      .select("name uuid phone businesses")
      .limit(10);

    const formattedCustomer = {
      _id: customer._id,
      name: customer.name,
      uuid: customer.uuid,
      phone: customer.phone,
      businesses: customer.businesses.map((business) => ({
        businessId: business.businessId,
        monthlyFee: business.monthlyFee,
        totalPaymentAmount: business.totalPaymentAmount,
        totalDueAmount: business.totalDueAmount,
      })),
    };

    res.json(formattedCustomer);
  } catch (error) {
    console.error("Error in searchCustomers:", error);
    res.status(200).json({
      message: "An error occurred while searching for customers",
      //   error: error.message,
    });
  }
};

exports.getCustomerPaymentInfo = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { uuid } = req.query;

    if (!businessId || !uuid) {
      return res
        .status(400)
        .json({ message: "Business ID and customer UUID are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const customer = await Customer.findOne({ uuid });

    if (!customer) {
      return res.status(200).json({ message: "Customer not found" });
    }

    const businessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );

    if (businessIndex === -1) {
      return res
        .status(200)
        .json({ message: "Customer is not associated with this business" });
    }

    const businessInfo = customer.businesses[businessIndex];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const currentMonthPayment = await Payment.findOne({
      customerId: customer._id,
      businessId,
      dueDate: {
        $gte: new Date(currentYear, currentMonth - 1, 1),
        $lt: new Date(currentYear, currentMonth, 1),
      },
    });

    let currentMonthDue = businessInfo.monthlyFee;
    if (currentMonthPayment) {
      currentMonthDue = currentMonthPayment.remainingAmount;
    }

    const paymentInfo = {
      customerName: customer.name,
      customerPhone: customer.phone,
      customerUuid: customer.uuid,
      currentMonthDue,
      previousDue: businessInfo.totalDueAmount - currentMonthDue,
      totalDue: businessInfo.totalDueAmount,
      monthlyFee: businessInfo.monthlyFee,
    };

    res.json(paymentInfo);
  } catch (error) {
    console.error("Error in getCustomerPaymentInfo:", error);
    res.status(500).json({
      message: "An error occurred while fetching customer payment information",
      error: error.message,
    });
  }
};

// exports.deleteMultipleCustomers = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { customerIds } = req.body;

//     if (
//       !customerIds ||
//       !Array.isArray(customerIds) ||
//       customerIds.length === 0
//     ) {
//       await session.abortTransaction();
//       return res
//         .status(400)
//         .json({ message: "Invalid or empty customer IDs array" });
//     }

//     const validCustomerIds = customerIds.filter((id) =>
//       mongoose.Types.ObjectId.isValid(id)
//     );

//     if (validCustomerIds.length === 0) {
//       await session.abortTransaction();
//       return res
//         .status(400)
//         .json({ message: "No valid customer IDs provided" });
//     }

//     const customers = await Customer.find({
//       _id: { $in: validCustomerIds },
//     }).session(session);

//     if (customers.length === 0) {
//       await session.abortTransaction();
//       return res
//         .status(404)
//         .json({ message: "No customers found with the provided IDs" });
//     }

//     for (const customer of customers) {
//       for (const businessInfo of customer.businesses) {
//         await Business.findByIdAndUpdate(
//           businessInfo.businessId,
//           {
//             $pull: { customers: customer._id },
//             $inc: {
//               totalCustomers: -1,
//               totalDue: -businessInfo.totalDueAmount,
//             },
//           },
//           { session }
//         );
//       }

//       await Payment.deleteMany({ customerId: customer._id }, { session });
//     }

//     const deleteResult = await Customer.deleteMany(
//       { _id: { $in: validCustomerIds } },
//       { session }
//     );

//     await session.commitTransaction();

//     res.json({
//       message: `Successfully deleted ${deleteResult.deletedCount} customers`,
//       deletedCount: deleteResult.deletedCount,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     console.error("Error in deleteMultipleCustomers:", error);
//     res.status(500).json({
//       message: "An error occurred while deleting customers",
//       error: error.message,
//     });
//   } finally {
//     session.endSession();
//   }
// };

exports.deleteMultipleCustomers = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerIds, businessId } = req.body;

    if (
      !customerIds ||
      !Array.isArray(customerIds) ||
      customerIds.length === 0 ||
      !businessId
    ) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Invalid customer IDs array or missing business ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const validCustomerIds = customerIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validCustomerIds.length === 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "No valid customer IDs provided" });
    }

    const customers = await Customer.find({
      _id: { $in: validCustomerIds },
      "businesses.businessId": businessId,
    }).session(session);

    if (customers.length === 0) {
      await session.abortTransaction();
      return res.status(404).json({
        message:
          "No customers found with the provided IDs for the given business",
      });
    }

    let totalCustomersRemoved = 0;
    let totalDueReduced = 0;

    for (const customer of customers) {
      const businessIndex = customer.businesses.findIndex(
        (b) => b.businessId.toString() === businessId
      );

      if (businessIndex !== -1) {
        const removedBusiness = customer.businesses.splice(businessIndex, 1)[0];
        totalDueReduced += removedBusiness.totalDueAmount;
        totalCustomersRemoved++;

        await Payment.deleteMany({
          customerId: customer._id,
          businessId: removedBusiness.businessId,
        }).session(session);

        if (customer.businesses.length === 0) {
          await Customer.findByIdAndDelete(customer._id).session(session);
        } else {
          await customer.save({ session });
        }
      }
    }

    await Business.findByIdAndUpdate(businessId, {
      $inc: {
        totalCustomer: -totalCustomersRemoved,
        totalDue: -totalDueReduced,
      },
    }).session(session);

    await session.commitTransaction();

    res.json({
      message: `Successfully removed ${totalCustomersRemoved} customers from the business and deleted associated payments`,
      removedCount: totalCustomersRemoved,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in deleteMultipleCustomers:", error);
    res.status(500).json({
      message: "An error occurred while deleting customers",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
