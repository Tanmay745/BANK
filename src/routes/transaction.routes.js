const {Router} = require("express")
const transactionRoutes = Router()
const authMiddleware = require("../middleware/auth.middleware")
const transactionController = require("../controllers/transaction.controller")

transactionRoutes.post("/",authMiddleware.authMiddleware,transactionController.createTransaction)

transactionRoutes.post("/system/initial-funds",authMiddleware.authSystemUserMiddleware,transactionController.createInitialFundsTransaction)

transactionRoutes.get("/account/:accountId",authMiddleware.authMiddleware,transactionController.getAccountTransactions)

transactionRoutes.post("/:transactionId/reverse",authMiddleware.authMiddleware,transactionController.reverseTransaction)

module.exports = transactionRoutes