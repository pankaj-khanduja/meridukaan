const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const config = require("config");
const { FeeAndLimit, validateChargesStore, validateChargesPickUpDrop } = require("../models/feeAndLimit.js");
const { AuditLog, createAuditLog } = require("../models/auditLog");
const { identityManager } = require("../middleware/auth");
const { calculateTime } = require("../services/commonFunctions");
const { ADMIN_CONSTANTS } = require("../config/constant.js");
const { City, validateCityPost } = require("../models/city");

//add or update platform fee and charges
router.post("/chargesPickUpAndDrop", identityManager(["admin"], { fares: "W" }), async (req, res) => {
  const { error } = validateChargesPickUpDrop(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let feeAndLimit = await FeeAndLimit.findOne({ type: "pickUpDrop", cityId: req.body.cityId });
  let logType = "update";
  if (req.body.endDeliveryTime && req.body.startDeliveryTime) {
    let timeObj = {
      closingTime: req.body.endDeliveryTime,
      openingTime: req.body.startDeliveryTime,
    };
    let data = calculateTime(timeObj);
    req.body.startDeliveryTime = data.openingTime;
    req.body.endDeliveryTime = data.closingTime;
    req.body.startDeliveryTimeInSec = data.openingTimeInSec;
    req.body.endDeliveryTimeInSec = data.closingTimeInSec;
  }
  // let data = calculateTime(timeObj);
  // req.body.startDeliveryTime = data.openingTime;
  // req.body.endDeliveryTime = data.closingTime;
  // req.body.startDeliveryTimeInSec = data.openingTimeInSec;
  // req.body.endDeliveryTimeInSec = data.closingTimeInSec;
  // console.log("data :", data);
  if (!feeAndLimit) {
    feeAndLimit = new FeeAndLimit(req.body);
    await City.updateOne({ _id: req.body.cityId }, { $set: { pickUpAndDropStatus: "active" } });
    logType = "create";
  } else {
    // feeAndLimit.maxOrderAmtForCod = req.body.maxOrderAmtForCod || feeAndLimit.maxOrderAmtForCod;
    feeAndLimit.driverPlatformFeePercent = req.body.driverPlatformFeePercent;
    // feeAndLimit.vendorPlatformFeePercent = req.body.vendorPlatformFeePercent || feeAndLimit.vendorPlatformFeePercent;
    feeAndLimit.baseFare = req.body.baseFare;

    feeAndLimit.exceededDeliveryChargesPerKm = req.body.exceededDeliveryChargesPerKm;
    feeAndLimit.waitingTimeFarePerMin = req.body.waitingTimeFarePerMin;
    feeAndLimit.waitingTimeMinBuffer = req.body.waitingTimeMinBuffer;

    feeAndLimit.rideTimeFarePerMin = req.body.rideTimeFarePerMin;
    feeAndLimit.defaultRideTimeFreeMin = req.body.defaultRideTimeFreeMin;
    feeAndLimit.deliveryRadius = req.body.deliveryRadius;
    feeAndLimit.serviceTax = req.body.serviceTax;
    feeAndLimit.vatCharge = req.body.vatCharge;
    // feeAndLimit.cityId = req.body.cityId || feeAndLimit.cityId;
    feeAndLimit.defaultDistance = req.body.defaultDistance;
    feeAndLimit.platformFees = req.body.platformFees;
    //
    feeAndLimit.startDeliveryTime = req.body.startDeliveryTime;
    feeAndLimit.endDeliveryTime = req.body.endDeliveryTime;
    feeAndLimit.startDeliveryTimeInSec = req.body.startDeliveryTimeInSec;
    feeAndLimit.endDeliveryTimeInSec = req.body.endDeliveryTimeInSec;
  }
  feeAndLimit.type = "pickUpDrop";
  await feeAndLimit.save();
  await createAuditLog("feesAndLimit", feeAndLimit._id, req.jwtData.userId, req.jwtData.role, logType, feeAndLimit, req.userData.email);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADMIN_CONSTANTS.DATA_UPDATED, feeAndLimit },
  });
});

router.post("/chargesStore", identityManager(["admin"], { fares: "W" }), async (req, res) => {
  const { error } = validateChargesStore(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let feeAndLimit = await FeeAndLimit.findOne({ cityId: req.body.cityId, type: "store" });
  let logType = "update";
  if (req.body.endDeliveryTime && req.body.startDeliveryTime) {
    let timeObj = {
      closingTime: req.body.endDeliveryTime,
      openingTime: req.body.startDeliveryTime,
    };
    let data = calculateTime(timeObj);
    req.body.startDeliveryTime = data.openingTime;
    req.body.endDeliveryTime = data.closingTime;
    req.body.startDeliveryTimeInSec = data.openingTimeInSec;
    req.body.endDeliveryTimeInSec = data.closingTimeInSec;
  }
  // let data = calculateTime(timeObj);
  // req.body.startDeliveryTime = data.openingTime;
  // req.body.endDeliveryTime = data.closingTime;
  // req.body.startDeliveryTimeInSec = data.openingTimeInSec;
  // req.body.endDeliveryTimeInSec = data.closingTimeInSec;
  // console.log("data :", data);
  if (!feeAndLimit) {
    feeAndLimit = new FeeAndLimit(req.body);
    await City.updateOne({ _id: req.body.cityId }, { $set: { storeStatus: "active" } });

    logType = "create";
  } else {
    feeAndLimit.maxOrderAmtForCod = req.body.maxOrderAmtForCod;
    feeAndLimit.driverPlatformFeePercent = req.body.driverPlatformFeePercent;
    feeAndLimit.vendorPlatformFeePercent = req.body.vendorPlatformFeePercent;
    feeAndLimit.baseFare = req.body.baseFare;
    feeAndLimit.serviceCharge = req.body.serviceCharge;
    feeAndLimit.exceededDeliveryChargesPerKm = req.body.exceededDeliveryChargesPerKm;
    feeAndLimit.platformFees = req.body.platformFees;
    // feeAndLimit.cityId = req.body.cityId || feeAndLimit.cityId;

    feeAndLimit.deliveryRadius = req.body.deliveryRadius;
    feeAndLimit.serviceTax = req.body.serviceTax;
    feeAndLimit.vatCharge = req.body.vatCharge;
    feeAndLimit.defaultDistance = req.body.defaultDistance;

    feeAndLimit.startDeliveryTime = req.body.startDeliveryTime;
    feeAndLimit.endDeliveryTime = req.body.endDeliveryTime;
    feeAndLimit.startDeliveryTimeInSec = req.body.startDeliveryTimeInSec;
    feeAndLimit.endDeliveryTimeInSec = req.body.endDeliveryTimeInSec;
  }
  feeAndLimit.type = "store";
  await feeAndLimit.save();
  await createAuditLog("feesAndLimit", feeAndLimit._id, req.jwtData.userId, req.jwtData.role, logType, feeAndLimit, req.userData.email);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADMIN_CONSTANTS.DATA_UPDATED, feeAndLimit },
  });
});

router.get("/chargesPickUpAndDrop", identityManager(["admin"]), async (req, res) => {
  //   let feeAndLimit = await FeeAndLimit.findOne({ type: "pickUpDrop" });

  let criteria = {};
  let criteria1 = {};

  criteria.type = "pickUpDrop";
  if (req.query.chargeId) criteria._id = mongoose.Types.ObjectId(req.query.chargeId);
  if (req.query.cityId) criteria.cityId = req.query.cityId;
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria1.cityName = regexName;
  }
  let feeAndLimit = await FeeAndLimit.aggregate([
    {
      $match: criteria,
    },
    { $sort: { insertDate: -1 } },
    {
      $addFields: { cityId: { $toObjectId: "$cityId" } },
    },
    {
      $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" },
    },
    {
      $addFields: { cityName: { $arrayElemAt: ["$cityData.cityName", 0] } },
    },
    { $match: criteria1 },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        serviceTax: 1,
        vatCharge: 1,
        cityName: 1,
        exceededDistanceFarePerKm: "$exceededDeliveryChargesPerKm",
        exceededTimeFarePerMin: "$rideTimeFarePerMin",
        waitingTimeFarePerMin: 1,
        waitingTimeMinBuffer: 1,
        platformFees: 1,
        defaultRideTimeFreeMin: 1,
        deliveryRadius: 1,
        cityId: 1,
        baseFare: 1,
        defaultDistance: 1,
        startDeliveryTime: 1,
        maxOrderAmtForCod: 1,
        endDeliveryTime: 1,
        startDeliveryTimeInSec: 1,
        endDeliveryTimeInSec: 1,
        type: 1,
        driverPlatformFeePercent: 1,
        insertDate: 1,
        creationDate: 1,
        fareId: "$_id",
        _id: 0,
      },
    },
  ]);
  let totalCount = await FeeAndLimit.countDocuments(criteria);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { feeAndLimit, totalCount },
  });
});

router.get("/chargesStore", identityManager(["admin"]), async (req, res) => {
  let criteria = {};
  let criteria1 = {};

  criteria.type = "store";
  if (req.query.chargeId) criteria._id = mongoose.Types.ObjectId(req.query.chargeId);
  if (req.query.cityId) criteria.cityId = req.query.cityId;
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria1.cityName = regexName;
  }
  let feeAndLimit = await FeeAndLimit.aggregate([
    {
      $match: criteria,
    },
    { $sort: { insertDate: -1 } },
    {
      $addFields: { cityId: { $toObjectId: "$cityId" } },
    },
    {
      $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" },
    },
    {
      $addFields: { cityName: { $arrayElemAt: ["$cityData.cityName", 0] } },
    },
    { $match: criteria1 },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        serviceTax: 1,
        serviceCharge: 1,
        vatCharge: 1,
        cityName: 1,
        exceededDistanceFarePerKm: "$exceededDeliveryChargesPerKm",
        deliveryRadius: 1,
        cityId: 1,
        baseFare: 1,
        defaultDistance: 1,
        startDeliveryTime: 1,
        maxOrderAmtForCod: 1,
        platformFees: 1,
        endDeliveryTime: 1,
        startDeliveryTimeInSec: 1,
        endDeliveryTimeInSec: 1,
        type: 1,
        driverPlatformFeePercent: 1,
        vendorPlatformFeePercent: 1,
        insertDate: 1,
        creationDate: 1,
        fareId: "$_id",
        _id: 0,
      },
    },
  ]);
  let totalCount = await FeeAndLimit.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, feeAndLimit },
  });
});

module.exports = router;
