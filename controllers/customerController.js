const Customer = require("../models/Customer");
const Business = require("../models/Business");
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
      // Create a new customer if not found
      customer = new Customer({
        name,
        phone,
        uuid,
        businesses: [],
      });
      isNewCustomer = true;
    }

    // Check if the customer is already associated with this business
    const existingBusinessIndex = customer.businesses.findIndex(
      (b) => b.businessId.toString() === businessId
    );

    if (existingBusinessIndex === -1) {
      // Add the new business to the customer's businesses array
      customer.businesses.push({
        businessId,
        monthlyFee,
        payableAmount: monthlyFee,
        totalPaymentAmount: 0,
        totalDueAmount: 0,
        paymentHistory: [],
      });

      // Update business statistics only if it's a new association
      business.totalCustomer += 1;
      await business.save({ session });
    } else {
      // If the customer is already associated with this business, update the monthly fee
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

    // Update payment history
    business.paymentHistory.push({
      amount,
      date: new Date(),
      month,
      year,
    });

    // Update total payment amount
    business.totalPaymentAmount += amount;
    customer.mainTotalPayment += amount;

    // Calculate remaining due
    const remainingDue = totalDue - amount;

    if (remainingDue <= 0) {
      // Payment covers all dues
      business.totalDueAmount = 0;
      business.payableAmount = business.monthlyFee;
    } else {
      // Partial payment
      business.totalDueAmount = remainingDue;
      business.payableAmount = remainingDue + business.monthlyFee;
    }

    await customer.save();

    // Update business statistics
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

exports.getAllCustomers = async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return res
        .status(400)
        .json({ message: "BusinessId is required as a query parameter" });
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const customers = await Customer.find({
      "businesses.businessId": new mongoose.Types.ObjectId(businessId),
    });

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

    res.json(formattedCustomers);
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

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    // Update business statistics
    for (const business of customer.businesses) {
      const businessDoc = await Business.findById(business.businessId);
      if (businessDoc) {
        businessDoc.totalCustomer -= 1;
        businessDoc.totalDue -= business.totalDueAmount;
        await businessDoc.save();
      }
    }

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCustomerDetails = async (req, res) => {
  try {
    const customerId = req.userData.customerId; // Assuming we store customerId in the token
    const customer = await Customer.findById(customerId).populate(
      "businesses.businessId",
      "name"
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customerDetails = {
      name: customer.name,
      phone: customer.phone,
      uuid: customer.uuid,
      mainTotalPayment: customer.mainTotalPayment,
      businesses: customer.businesses.map((business) => ({
        businessName: business.businessId.name,
        totalPaymentAmount: business.totalPaymentAmount,
        totalDueAmount: business.totalDueAmount,
        payableAmount: business.payableAmount,
        monthlyFee: business.monthlyFee,
        paymentHistory: business.paymentHistory,
      })),
    };

    res.json(customerDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
