const { Admin, validateAdminLogin, validateDriverApplication, validateRefund, validateUnFreezeDriver, validateManualPayout } = require("../models/admin");
const config = require("config");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { manualPayout } = require("../services/flutterWave");
const FLUTTER_SECRET_KEY = config.get("secretKey");
const { Subaccount } = require("../models/subaccount.js");
const { identityManager } = require("../middleware/auth");

router.post("/manualVendorPayout", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  const { error } = validateManualPayout(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let currentTime = Math.round(new Date() / 1000);
  let criteria = {};
  criteria.vendorId = req.body.userId;
  criteria.isOrderAmtPaidToVendor = false;
  criteria.orderStatus = "DELIVERED";
  criteria.deliveredAt = { $lt: currentTime };

  let orders = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: {
        _id: "$vendorId",
        total: {
          $sum: "$vendorAmount",
        },
      },
    },
  ]);
  console.log("orders", orders);
  let subaccount = await Subaccount.findOne({ userId: req.body.userId, isDefault: true });
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
    });
  }
  console.log("subaccount", subaccount.bankName);
  let dataObj = {};

  dataObj.account_bank = subaccount.bankName;
  dataObj.account_number = subaccount.accountNumber;
  dataObj.narration = config.get("simpleTransfer");
  dataObj.currency = config.get("currency");
  dataObj.seckey = FLUTTER_SECRET_KEY;
  dataObj.amount = orders[0].total;
  dataObj.reference = "mk-902837-jk";
  let response = await manualPayout(dataObj);
  console.log("response", response);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

router.post("/manualDriverPayout", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  const { error } = validateManualPayout(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let currentTime = Math.round(new Date() / 1000);
  let criteria = {};
  criteria.driverId = req.body.userId;
  criteria.isOrderAmtPaidToDriver = false;
  criteria.orderStatus = "DELIVERED";
  criteria.deliveredAt = { $lt: currentTime };

  let orders = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: {
        _id: "$driverId",
        total: {
          $sum: "$vendorAmount",
        },
      },
    },
  ]);
  console.log("orders", orders);
  let subaccount = await Subaccount.findOne({ userId: req.body.userId, isDefault: true });
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
    });
  }
  console.log("subaccount", subaccount);
  let dataObj = {};

  dataObj.account_bank = subaccount.bankName;
  dataObj.account_number = subaccount.accountNumber;
  dataObj.narration = config.get("simpleTransfer");
  dataObj.currency = config.get("currency");
  dataObj.seckey = FLUTTER_SECRET_KEY;
  dataObj.amount = orders[0].total;
  let response = await manualPayout(dataObj);
  console.log("response", response);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

module.exports = router;
