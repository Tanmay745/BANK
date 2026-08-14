const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");

async function createTransaction(req, res) {
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  if (!fromAccount || !toAccount || amount === undefined || !idempotencyKey) {
    return res.status(400).json({
      message: "fromAccount, toAccount, amount and idempotencyKey are required",
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(fromAccount) ||
    !mongoose.Types.ObjectId.isValid(toAccount)
  ) {
    return res.status(400).json({
      message: "Invalid account ID",
    });
  }

  if (fromAccount === toAccount) {
    return res.status(400).json({
      message: "fromAccount and toAccount cannot be the same",
    });
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      message: "Amount must be a valid number greater than 0",
    });
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0
  ) {
    return res.status(400).json({
      message: "Invalid idempotency key",
    });
  }

  const existingTransaction = await transactionModel.findOne({
    idempotencyKey: idempotencyKey.trim(),
  });

  if (existingTransaction) {
    if (existingTransaction.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: existingTransaction,
      });
    }

    if (existingTransaction.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still processing",
        transaction: existingTransaction,
      });
    }

    if (existingTransaction.status === "FAILED") {
      return res.status(500).json({
        message:
          "Transaction processing failed, please retry with a new idempotency key",
      });
    }

    if (existingTransaction.status === "REVERSED") {
      return res.status(500).json({
        message:
          "Transaction was reversed, please retry with a new idempotency key",
      });
    }
  }

  const fromUserAccount = await accountModel.findOne({
    _id: fromAccount,
    user: req.user._id,
  });

  if (!fromUserAccount) {
    return res.status(403).json({
      message: "You do not have permission to use this account",
    });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!toUserAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
    });
  }

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message:
        "Both fromAccount and toAccount must be ACTIVE to process transaction",
    });
  }

  const balance = await fromUserAccount.getBalance();

  if (balance < amount) {
    return res.status(400).json({
      message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`,
    });
  }

  let session;
  let transaction;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    transaction = (
      await transactionModel.create(
        [
          {
            fromAccount,
            toAccount,
            amount,
            idempotencyKey: idempotencyKey.trim(),
            status: "PENDING",
          },
        ],
        { session },
      )
    )[0];

    await ledgerModel.create(
      [
        {
          account: fromAccount,
          amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
      ],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: toAccount,
          amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session },
    );

    transaction.status = "COMPLETED";

    await transaction.save({ session });

    await session.commitTransaction();

    try {
      await emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        toAccount,
      );
    } catch (emailError) {
      console.error("Transaction email failed:", emailError);
    }

    return res.status(200).json({
      message: "Transaction completed successfully",
      transaction,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Transaction error:", error);

    return res.status(500).json({
      message: "Transaction could not be completed",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;

  if (!toAccount || amount === undefined || !idempotencyKey) {
    return res.status(400).json({
      message: "toAccount, amount and idempotencyKey are required",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(toAccount)) {
    return res.status(400).json({
      message: "Invalid account ID",
    });
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      message: "Amount must be a valid number greater than 0",
    });
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0
  ) {
    return res.status(400).json({
      message: "Invalid idempotency key",
    });
  }

  const existingTransaction = await transactionModel.findOne({
    idempotencyKey: idempotencyKey.trim(),
  });

  if (existingTransaction) {
    return res.status(200).json({
      message: "Transaction already processed",
      transaction: existingTransaction,
    });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!toUserAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
    });
  }

  if (toUserAccount.status !== "ACTIVE") {
    return res.status(400).json({
      message: "Target account must be ACTIVE",
    });
  }

  const fromUserAccount = await accountModel.findOne({
    user: req.user._id,
  });

  if (!fromUserAccount) {
    return res.status(400).json({
      message: "System user account not found",
    });
  }

  let session;
  let transaction;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    transaction = new transactionModel({
      fromAccount: fromUserAccount._id,
      toAccount,
      amount,
      idempotencyKey: idempotencyKey.trim(),
      status: "PENDING",
    });

    await ledgerModel.create(
      [
        {
          account: fromUserAccount._id,
          amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
      ],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: toAccount,
          amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session },
    );

    transaction.status = "COMPLETED";

    await transaction.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      message: "Initial funds transaction completed successfully",
      transaction,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Initial funds transaction error:", error);

    return res.status(500).json({
      message: "Initial funds transaction could not be completed",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

async function getAccountTransactions(req, res) {
  const { accountId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return res.status(400).json({
      message: "Invalid account ID",
    });
  }

  const account = await accountModel.findOne({
    _id: accountId,
    user: req.user._id,
  });

  if (!account) {
    return res.status(404).json({
      message: "Account not found",
    });
  }

  const transactions = await transactionModel
    .find({
      $or: [{ fromAccount: accountId }, { toAccount: accountId }],
    })
    .sort({ createdAt: -1 });

  return res.status(200).json({
    accountId,
    count: transactions.length,
    transactions,
  });
}

async function reverseTransaction(req, res) {
  const { transactionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    return res.status(400).json({
      message: "Invalid transaction ID",
    });
  }

  const originalTransaction = await transactionModel.findById(transactionId);

  if (!originalTransaction) {
    return res.status(404).json({
      message: "Transaction not found",
    });
  }

  if (originalTransaction.status !== "COMPLETED") {
    return res.status(400).json({
      message: "Only completed transactions can be reversed",
    });
  }

  const existingReversal = await transactionModel.findOne({
    reversalOf: originalTransaction._id,
  });

  if (existingReversal) {
    return res.status(400).json({
      message: "Transaction has already been reversed",
      reversalTransaction: existingReversal,
    });
  }

  const fromAccount = await accountModel.findOne({
    _id: originalTransaction.fromAccount,
    user: req.user._id,
  });

  if (!fromAccount) {
    return res.status(403).json({
      message: "You do not have permission to reverse this transaction",
    });
  }

  const toAccount = await accountModel.findById(originalTransaction.toAccount);

  if (!toAccount) {
    return res.status(404).json({
      message: "Receiver account not found",
    });
  }

  if (fromAccount.status !== "ACTIVE" || toAccount.status !== "ACTIVE") {
    return res.status(400).json({
      message: "Both accounts must be ACTIVE to reverse the transaction",
    });
  }

  const receiverBalance = await toAccount.getBalance();

  if (receiverBalance < originalTransaction.amount) {
    return res.status(400).json({
      message:
        "Receiver does not have sufficient balance to reverse this transaction",
    });
  }

  let session;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const reversalTransaction = (
      await transactionModel.create(
        [
          {
            fromAccount: originalTransaction.toAccount,
            toAccount: originalTransaction.fromAccount,
            amount: originalTransaction.amount,
            idempotencyKey: `reversal-${originalTransaction._id}`,
            status: "COMPLETED",
            reversalOf: originalTransaction._id,
          },
        ],
        { session },
      )
    )[0];

    await ledgerModel.create(
      [
        {
          account: originalTransaction.toAccount,
          amount: originalTransaction.amount,
          transaction: reversalTransaction._id,
          type: "DEBIT",
        },
      ],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: originalTransaction.fromAccount,
          amount: originalTransaction.amount,
          transaction: reversalTransaction._id,
          type: "CREDIT",
        },
      ],
      { session },
    );

    originalTransaction.status = "REVERSED";

    await originalTransaction.save({ session });

    await session.commitTransaction();

    try {
      await emailService.sendTransactionReverseEmail(
        req.user.email,
        req.user.name,
        originalTransaction.amount,
        originalTransaction._id,
      );
    } catch (emailError) {
      console.error("Reversal email failed:", emailError);
    }

    return res.status(200).json({
      message: "Transaction reversed successfully",
      originalTransaction,
      reversalTransaction,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Transaction reversal error:", error);

    return res.status(500).json({
      message: "Transaction reversal failed",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
  getAccountTransactions,
  reverseTransaction,
};
