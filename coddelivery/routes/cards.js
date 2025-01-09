const { CARD_CONSTANTS, PAYMENT_CONSTANTS } = require("../config/constant.js");
const config = require("config");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { identityManager } = require("../middleware/auth");
const _ = require("lodash");
const { Card, validateCardPost, validateCardPut } = require("../models/card");
const { User } = require("../models/user");
const { createTransaction, chargeWithToken, refundTransaction } = require("../services/flutterWave");
const { PaymentLog } = require("../models/paymentLogs")

router.get("/", identityManager(["user", "driver"], {}), async (req, res) => {
  let criteria = {};
  criteria.userId = req.jwtData.userId;
  if (req.query.cardId) {
    criteria._id = mongoose.Types.ObjectId(req.query.cardId);
  }
  criteria.status = "active";
  var cardList = await Card.aggregate([{ $match: criteria }, { $addFields: { cardId: "$_id" } }, { $project: { __v: 0, _id: 0 } }, { $sort: { insertDate: -1 } }]);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { cardList } });
});
router.post("/createCard", identityManager(["user", "driver"], {}), async (req, res) => {
  const { error } = validateCardPost(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let epoch = Math.round(new Date() / 1000);
  let uString = req.userData.firstName + "_" + epoch;

  let appType = "";
  if (req.body.appType && req.body.appType == "web") {
    appType = "web";
  } else {
    if (req.body.appType && req.body.appType == "test") {
      appType = "test";
    } else {
      appType = "app";
    }
  }

  let chargeObject = {
    tx_ref: uString,
    amount: config.get("createCardAmount"),
    currency: config.get("currency"),
    redirect_url: config.get("redirectBaseUrl") + `/api/webhook/createCard/${appType}`,
    payment_options: config.get("paymentOptions"),
    meta: {
      consumer_id: req.userData._id.toString(),
      consumer_mac: "92a3-912ba-1192a",
      redirectUrl: req.body.redirectUrl,
    },
    customer: {
      email: req.body.email || req.userData.email || config.get("dummyEmail"),
      phonenumber: req.userData.mobile,
      name: req.userData.firstName + req.userData.lastName,
    },

    // customizations: {

    //   title: order.vendorName,
    //   description: order.vendorName,
    //   logo: order.vendorImage,
    // },
  };
  let response = await createTransaction(chargeObject);
  let paymentUrl;
  console.log("responseeeee", response);
  let paymentLog = new PaymentLog();
  paymentLog.userId = req.jwtData.userId;
  paymentLog.type = "createTransaction";
  paymentLog.paymentType = "createCard";

  if (response.statusCode !== 200) {
    paymentLog.data = response.data.response.data;
    await paymentLog.save();

    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
    });
  } else {
    if (response.message != "Success")
      return res.status(401).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
      });
    else {
      paymentUrl = response.data.data.link;
      paymentLog.data = response;
      await paymentLog.save();
    }
  }

  // var cardList = await Card.aggregate([{ $match: criteria }, { $addFields: { cardId: "$_id" } }, { $project: { __v: 0, _id: 0 } }, { $sort: { insertDate: -1 } }]);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { paymentUrl } });
});

router.post("/default", identityManager(["user", "driver"], {}), async (req, res) => {
  let card;
  if (req.body.cardId) {
    card = await Card.findOne({ _id: req.body.cardId });
    if (!card) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: CARD_CONSTANTS.INVALID_CARD } });
  } else {
    return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: CARD_CONSTANTS.CARD_REQUIRED } });
  }
  await Card.updateMany({ userId: req.jwtData.userId }, { $set: { isDefault: false } });

  card.isDefault = true;
  let result = await setAsDefaultPaymentMethod(card.stripeCustomerId, card.stripeCardId);
  if (result.statusCode != 200) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: result.data } });
  await card.save();

  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { message: CARD_CONSTANTS.SET_DEFAULT } });
});

router.delete("/:cardId", identityManager(["user", "driver"], {}), async (req, res) => {
  let card = await Card.findOne({ _id: req.params.cardId, status: "active" });
  if (!card) {
    res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: CARD_CONSTANTS.INVALID_CARD } });
  }
  // var result = await Card.updateOne({ _id: req.params.cardId }, { $set: { status: "deleted" } });
  var result = await Card.deleteOne({ _id: req.params.cardId });
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { message: CARD_CONSTANTS.CARD_DELETE_SUCCESS } });
});

module.exports = router;
