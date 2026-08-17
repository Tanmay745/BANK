const express = require("express")
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middleware/auth.middleware")

const router = express.Router()

router.post("/register",authController.userRegisterController)

router.post("/login",authController.userLoginController)

router.post("/logout",authController.userLogoutController)

router.post("/set-transaction-pin",authMiddleware.authMiddleware,authController.setTransactionPin)

router.post("/change-transaction-pin",authMiddleware.authMiddleware,authController.changeTransactionPin)

module.exports = router