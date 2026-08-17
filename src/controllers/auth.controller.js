const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.service");
const tokenBlacklistModel = require("../models/blacklist.model");
const bcrypt = require("bcrypt");

async function userRegisterController(req, res) {
  const { email, password, name } = req.body;

  const isExists = await userModel.findOne({
    email: email,
  });
  if (isExists) {
    return res.status(422).json({
      message: "User already exists with this email.",
      status: "failed",
    });
  }

  const user = await userModel.create({
    email,
    password,
    name,
  });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  res.cookie("token", token);

  res.status(201).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
    token,
  });

  await emailService.sendRegistrationEmail(user.email, user.name);
}

async function userLoginController(req, res) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email }).select("+password");
  if (!user) {
    return res.status(401).json({
      message: "Email or password is INVALID",
    });
  }

  const isValidPassword = await user.comparePassword(password);

  if (!isValidPassword) {
    return res.status(401).json({
      message: "Email or password is INVALID",
    });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  res.cookie("token", token);

  res.status(200).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
    token,
  });
}

async function userLogoutController(req, res) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(400).json({
      message: "User logged out successfully",
    });
  }

  await tokenBlacklistModel.create({
    token: token,
  });

  res.clearCookie("token", "");

  return res.status(200).json({
    message: "User logged out successfully",
  });
}

async function setTransactionPin(req, res) {
  const { pin } = req.body;

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

  const user = await userModel.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (user.transactionPin) {
    return res.status(400).json({
      message: "Transaction PIN already exists. Use change PIN instead.",
    });
  }

  const hashedPin = await bcrypt.hash(pin, 10);

  user.transactionPin = hashedPin;

  await user.save();

  return res.status(200).json({
    message: "Transaction PIN set successfully",
  });
}

async function changeTransactionPin(req, res) {
  const { oldPin, newPin } = req.body;

  if (!oldPin || !newPin) {
    return res.status(400).json({
      message: "Old PIN and new PIN are required",
    });
  }

  if (!/^\d{6}$/.test(oldPin) || !/^\d{6}$/.test(newPin)) {
    return res.status(400).json({
      message: "PIN must be exactly 6 digits",
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
      message: "Transaction PIN is not set yet",
    });
  }

  const isValid = await bcrypt.compare(oldPin, user.transactionPin);

  if (!isValid) {
    return res.status(401).json({
      message: "Incorrect old transaction PIN",
    });
  }

  if (oldPin === newPin) {
    return res.status(400).json({
      message: "New PIN must be different from old PIN",
    });
  }

  const hashedPin = await bcrypt.hash(newPin, 10);

  user.transactionPin = hashedPin;

  await user.save();

  return res.status(200).json({
    message: "Transaction PIN changed successfully",
  });
}

module.exports = {
  userRegisterController,
  userLoginController,
  userLogoutController,
  setTransactionPin,
  changeTransactionPin
};
