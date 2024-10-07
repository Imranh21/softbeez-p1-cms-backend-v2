const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/",
  authMiddleware(["admin"]),
  customerController.createOrUpdateCustomer
);
router.post(
  "/payment",
  authMiddleware(["admin"]),
  customerController.addPayment
);
router.get(
  "/due",
  authMiddleware(["admin"]),
  customerController.getDuePayments
);
router.get("/", authMiddleware(["admin"]), customerController.getAllCustomers);
router.get("/:id", authMiddleware(["admin"]), customerController.getCustomer);
router.put(
  "/:id",
  authMiddleware(["admin"]),
  customerController.updateCustomer
);
router.delete(
  "/:id",
  authMiddleware(["admin"]),
  customerController.deleteCustomer
);
router.get(
  "/my-details",
  authMiddleware(["customer"]),
  customerController.getCustomerDetails
);

module.exports = router;
