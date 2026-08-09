const {Router} = require("express")
const transactionRoutes = Router()
const authMiddleware = require("../middleware/auth.middleware")
const transactionController = require("../controllers/transaction.controller")

transactionRoutes.post("/",authMiddleware.authMiddleware,transactionController.createTransaction)

transactionRoutes.post("/system/initial-funds",authMiddleware.authSystemUserMiddleware,transactionController.createInitialFundsTransaction)

module.exports = transactionRoutes