const express = require("express")
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controllers/account.controller")

const router = express.Router()

router.post("/",authMiddleware.authMiddleware,accountController.createAccountController)

router.get("/",authMiddleware.authMiddleware,accountController.getUserAccountsController)

router.get("/balance/:accountId",authMiddleware.authMiddleware,accountController.getAccountBalanceController)

router.patch("/:accountId/freeze",authMiddleware.authMiddleware,accountController.freezeAccount)

router.patch("/:accountId/unfreeze",authMiddleware.authMiddleware,accountController.unfreezeAccount)

module.exports = router