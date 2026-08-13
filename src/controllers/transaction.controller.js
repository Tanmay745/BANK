const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const accountModel = require("../models/account.model")
const emailService = require("../services/email.service")
const mongoose = require("mongoose")

async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body

    if (!fromAccount || !toAccount || amount === undefined || !idempotencyKey) {
        return res.status(400).json({
            message: "fromAccount, toAccount, amount and idempotencyKey are required"
        })
    }

    if (!mongoose.Types.ObjectId.isValid(fromAccount) ||
        !mongoose.Types.ObjectId.isValid(toAccount)) {
        return res.status(400).json({
            message: "Invalid account ID"
        })
    }

    if (fromAccount === toAccount) {
        return res.status(400).json({
            message: "fromAccount and toAccount cannot be the same"
        })
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            message: "Amount must be a valid number greater than 0"
        })
    }

    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
        return res.status(400).json({
            message: "Invalid idempotency key"
        })
    }

    const existingTransaction = await transactionModel.findOne({
        idempotencyKey: idempotencyKey.trim()
    })

    if (existingTransaction) {
        if (existingTransaction.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already processed",
                transaction: existingTransaction
            })
        }

        if (existingTransaction.status === "PENDING") {
            return res.status(200).json({
                message: "Transaction is still processing",
                transaction: existingTransaction
            })
        }

        if (existingTransaction.status === "FAILED") {
            return res.status(500).json({
                message: "Transaction processing failed, please retry with a new idempotency key"
            })
        }

        if (existingTransaction.status === "REVERSED") {
            return res.status(500).json({
                message: "Transaction was reversed, please retry with a new idempotency key"
            })
        }
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount,
        user: req.user._id
    })

    if (!fromUserAccount) {
        return res.status(403).json({
            message: "You do not have permission to use this account"
        })
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    if (!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        })
    }

    if (fromUserAccount.status !== "ACTIVE" ||
        toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
        })
    }

    const balance = await fromUserAccount.getBalance()

    if (balance < amount) {
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`
        })
    }

    let session

    try {
        session = await mongoose.startSession()
        session.startTransaction()

        const transaction = (
            await transactionModel.create([{
                fromAccount,
                toAccount,
                amount,
                idempotencyKey: idempotencyKey.trim(),
                status: "PENDING"
            }], { session })
        )[0]

        await ledgerModel.create([{
            account: fromAccount,
            amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        transaction.status = "COMPLETED"

        await transaction.save({ session })

        await session.commitTransaction()

        return res.status(200).json({
            message: "Transaction completed successfully",
            transaction
        })
    } catch (error) {
        if (session) {
            await session.abortTransaction()
        }

        console.error("Transaction error:", error)

        return res.status(500).json({
            message: "Transaction could not be completed"
        })
    } finally {
        if (session) {
            await session.endSession()
        }
    }
}

async function createInitialFundsTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body

    if (!toAccount || amount === undefined || !idempotencyKey) {
        return res.status(400).json({
            message: "toAccount, amount and idempotencyKey are required"
        })
    }

    if (!mongoose.Types.ObjectId.isValid(toAccount)) {
        return res.status(400).json({
            message: "Invalid account ID"
        })
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            message: "Amount must be a valid number greater than 0"
        })
    }

    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
        return res.status(400).json({
            message: "Invalid idempotency key"
        })
    }

    const existingTransaction = await transactionModel.findOne({
        idempotencyKey: idempotencyKey.trim()
    })

    if (existingTransaction) {
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: existingTransaction
        })
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    if (!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        })
    }

    if (toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Target account must be ACTIVE"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    })

    if (!fromUserAccount) {
        return res.status(400).json({
            message: "System user account not found"
        })
    }

    let session

    try {
        session = await mongoose.startSession()
        session.startTransaction()

        const transaction = new transactionModel({
            fromAccount: fromUserAccount._id,
            toAccount,
            amount,
            idempotencyKey: idempotencyKey.trim(),
            status: "PENDING"
        })

        await ledgerModel.create([{
            account: fromUserAccount._id,
            amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        transaction.status = "COMPLETED"

        await transaction.save({ session })

        await session.commitTransaction()

        return res.status(201).json({
            message: "Initial funds transaction completed successfully",
            transaction
        })
    } catch (error) {
        if (session) {
            await session.abortTransaction()
        }

        console.error("Initial funds transaction error:", error)

        return res.status(500).json({
            message: "Initial funds transaction could not be completed"
        })
    } finally {
        if (session) {
            await session.endSession()
        }
    }
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}