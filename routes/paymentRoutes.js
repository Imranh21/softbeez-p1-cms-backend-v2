const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware(["admin"]), paymentController.createPayment);
router.get("/", authMiddleware(["admin"]), paymentController.getAllPayments);
router.get(
  "/:businessId",
  authMiddleware(["admin"]),
  paymentController.getPaymentsByBusiness
);
router.get("/due", authMiddleware(["admin"]), paymentController.getDuePayments);
router.get(
  "/payment/:id",
  authMiddleware(["admin"]),
  paymentController.getPayment
);
router.put("/:id", authMiddleware(["admin"]), paymentController.updatePayment);
router.delete(
  "/:id",
  authMiddleware(["admin"]),
  paymentController.deletePayment
);
router.post(
  "/delete-multiple",
  authMiddleware(["admin"]),
  paymentController.deleteMultiplePayments
);
router.get(
  "/unpaid-customers",
  authMiddleware(["admin"]),
  paymentController.getUnpaidCustomers
);
router.get(
  "/:id/pdf",
  authMiddleware(["admin"]),
  paymentController.getPaymentPDF
);

module.exports = router;
