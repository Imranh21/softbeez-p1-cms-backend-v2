const jwt = require("jsonwebtoken");

module.exports = (roles = []) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization.split(" ")[1];
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      req.userData = {
        userId: decodedToken.userId,
        role: decodedToken.role,
        customerId: decodedToken.customerId,
      };

      if (roles.length && !roles.includes(decodedToken.role)) {
        return res.status(403).json({ message: "Access forbidden" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: "Authentication failed" });
    }
  };
};
