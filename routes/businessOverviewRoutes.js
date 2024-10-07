const express = require("express");
const router = express.Router();
const businessOverviewController = require("../controllers/businessOverviewController");
const authMiddleware = require("../middleware/authMiddleware");

router.get(
  "/:businessId",
  authMiddleware(["admin"]),
  businessOverviewController.getBusinessOverview
);

module.exports = router;
