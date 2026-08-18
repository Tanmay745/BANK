const accountModel = require("../models/account.model");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const userModel = require("../models/user.model");

async function createAccountController(req, res) {
  const user = req.user;

  const account = await accountModel.create({
    user: user._id,
  });

  res.status(201).json({
    account,
  });
}

async function getUserAccountsController(req, res) {
  const accounts = await accountModel.find({ user: req.user._id });

  res.status(200).json({
    accounts,
  });
}

async function getAccountBalanceController(req, res) {
  const { accountId } = req.params;

  const account = await accountModel.findOne({
    _id: accountId,
    user: req.user._id,
  });

  if (!account) {
    return res.status(404).json({
      message: "Account not found",
    });
  }

  const balance = await account.getBalance();
  return res.status(200).json({
    accountId: accountId,
    balance: balance,
  });
}

async function freezeAccount(req, res) {
  const { accountId } = req.params;
  const { pin } = req.body;

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return res.status(400).json({
      message: "Invalid account ID",
    });
  }

  if (!pin) {
    return res.status(400).json({
      message: "Transaction PIN is required",
    });
  }

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({
      message: "Transaction PIN must be exactly 6 digits",
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

  const user = await userModel.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (!user.transactionPin) {
    return res.status(400).json({
      message: "Please set your transaction PIN first",
    });
  }

  const isPinValid = await bcrypt.compare(pin, user.transactionPin);

  if (!isPinValid) {
    return res.status(401).json({
      message: "Incorrect transaction PIN",
    });
  }

  if (account.status === "FROZEN") {
    return res.status(400).json({
      message: "Account is already frozen",
    });
  }

  account.status = "FROZEN";

  await account.save();

  return res.status(200).json({
    message: "Account frozen successfully",
    account: {
      id: account._id,
      status: account.status,
    },
  });
}

async function unfreezeAccount(req, res) {
  const { accountId } = req.params;
  const { pin } = req.body;

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return res.status(400).json({
      message: "Invalid account ID",
    });
  }

  if (!pin) {
    return res.status(400).json({
      message: "Transaction PIN is required",
    });
  }

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({
      message: "Transaction PIN must be exactly 6 digits",
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

  const user = await userModel.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (!user.transactionPin) {
    return res.status(400).json({
      message: "Please set your transaction PIN first",
    });
  }

  const isPinValid = await bcrypt.compare(pin, user.transactionPin);

  if (!isPinValid) {
    return res.status(401).json({
      message: "Incorrect transaction PIN",
    });
  }

  if (account.status === "ACTIVE") {
    return res.status(400).json({
      message: "Account is already active",
    });
  }

  account.status = "ACTIVE";

  await account.save();

  return res.status(200).json({
    message: "Account unfrozen successfully",
    account: {
      id: account._id,
      status: account.status,
    },
  });
}

module.exports = {
  createAccountController,
  getUserAccountsController,
  getAccountBalanceController,
  freezeAccount,
  unfreezeAccount,
};
