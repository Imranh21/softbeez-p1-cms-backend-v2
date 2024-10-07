const User = require("../models/User");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = new User({ username, password, role });
    await user.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginCustomer = async (req, res) => {
  try {
    const { uuid, phone } = req.body;
    const customer = await Customer.findOne({ uuid, phone });
    if (!customer) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { customerId: customer._id, role: "customer" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password, role: "admin" });
    await user.save();
    res.status(201).json({ message: "Admin created successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
