const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post(
  "/create-admin",
  authMiddleware(["admin"]),
  authController.createAdmin
);
router.post("/login-customer", authController.loginCustomer);

module.exports = router;
