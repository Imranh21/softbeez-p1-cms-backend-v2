const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware(["admin"]), businessController.createBusiness);
router.get("/", authMiddleware(["admin"]), businessController.getAllBusinesses);
router.get("/:id", authMiddleware(["admin"]), businessController.getBusiness);
router.put(
  "/:id",
  authMiddleware(["admin"]),
  businessController.updateBusiness
);
router.delete(
  "/:id",
  authMiddleware(["admin"]),
  businessController.deleteBusiness
);

module.exports = router;
