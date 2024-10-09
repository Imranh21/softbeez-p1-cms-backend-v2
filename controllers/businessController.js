const Business = require("../models/Business");

exports.createBusiness = async (req, res) => {
  try {
    const business = new Business(req.body);
    await business.save();
    res.status(201).json(business);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find();

    res.json(businesses);
  } catch (error) {
    if (error.name === "MongoTimeoutError") {
      res.status(504).json({ message: "Database operation timed out" });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

exports.getBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ message: "Business not found" });
    res.json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    const business = await Business.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!business)
      return res.status(404).json({ message: "Business not found" });
    res.json(business);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findByIdAndDelete(req.params.id);
    if (!business)
      return res.status(404).json({ message: "Business not found" });
    res.json({ message: "Business deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
