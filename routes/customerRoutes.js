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
  "/:businessId/:id",
  authMiddleware(["admin"]),
  customerController.deleteCustomer
);
router.get(
  "/customer/:customerId",
  authMiddleware(["customer", "admin"]),
  customerController.getCustomerDetails
);
router.get(
  "/search",
  authMiddleware(["admin"]),
  customerController.searchCustomers
);
router.get("/me/:businessId", customerController.getCustomerPaymentInfo);
router.post(
  "/delete-multiple",
  authMiddleware(["admin"]),
  customerController.deleteMultipleCustomers
);
router.get(
  "/search/customer",
  authMiddleware(["admin"]),
  customerController.searchCustomerBeforeAdding
);

router.get(
  "/search/customers",
  authMiddleware(["admin"]),
  customerController.searchCustomers
);

module.exports = router;
