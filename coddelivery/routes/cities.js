const express = require("express");
const config = require("config");
const mongoose = require("mongoose");
const router = express.Router();
const { City, validateCityPost, validateCityGet } = require("../models/city");
const { CITY_CONSTANTS } = require("../config/constant.js");
const { identityManager } = require("../middleware/auth");
const { FeeAndLimit } = require("../models/feeAndLimit");
const { ServiceArea } = require("../models/serviceArea");

const { chargeWithToken } = require("../services/flutterWave");

router.get("/", identityManager(["admin", "user", "public"]), async (req, res) => {
  var { error } = validateCityGet(req.query);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let criteria = {};
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.cityName = regexName;
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  let lon = 0;
  let lat = 0;
  let maxDistance = 0;
  console.log("req.jwtData.role", req.jwtData.role);
  if (req.jwtData.role == "user" || req.jwtData.role == "public") {
    maxDistance = config.get("userMaxDistance");
  } else {
    maxDistance = config.get("adminMaxDistance");
  }
  if (req.query.lon) {
    lon = parseFloat(req.query.lon);
  }
  if (req.query.lat) {
    lat = parseFloat(req.query.lat);
  }
  if (req.query.type == "store") {
    criteria.storeStatus = "active";
  } else if (req.query.type == "pickUpAndDrop") {
    criteria.pickUpAndDropStatus = "active";
  }
  if (req.jwtData.role !== "user") {
    sortCriteria = { cityName: 1 };
  } else {
    sortCriteria = { "dist.calculated": 1, _id: -1 };
  }
  let city = await City.aggregate([
//    {
//      $geoNear: {
//        near: { type: "Point", coordinates: [lon, lat] },
//        distanceField: "dist.calculated",
//        maxDistance: maxDistance,
//        query: criteria,
//        includeLocs: "dist.location",
//        spherical: true,
        // distanceMultiplier: 6378.1,
 //     },
 //   },
    { $sort: sortCriteria },
    {
      $project: {
        cityId: "$_id",
        cityName: 1,
        country: 1,
        location: 1,
        _id: 0,
      },
    },

    { $skip: skipVal },
    { $limit: limitVal },
  ]);
  let totalCount = await City.countDocuments(criteria);
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { city, totalCount },
  });
});
router.get("/byServiceArea", identityManager(["admin", "user", "public"]), async (req, res) => {
  let criteria = {};
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.cityName = regexName;
  }
  criteria.serviceType = "pickUpAndDrop";
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);

  let city = await ServiceArea.aggregate([
    { $match: criteria },

    { $addFields: { cityId: { $toObjectId: "$cityId" } } },
    { $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" } },
    { $addFields: { cityName: { $arrayElemAt: ["$cityData.cityName", 0] }, location: { $arrayElemAt: ["$cityData.location", 0] } } },
    {
      $group: {
        _id: "$cityId",
        cityName: { $first: "$cityName" },
        location: { $first: "$location" },
        cityId: { $first: "$cityId" },
      },
    },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        _id: 0,
      },
    },
  ]);
  // let totalCount = await City.countDocuments(criteria);
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { city },
  });
});

router.post("/", identityManager(["admin"], { city: "W" }), async (req, res) => {
  var { error } = validateCityPost(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let cityName = await req.body.cityName
    .toLowerCase()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ");
  let city = await City.findOne({ cityName: cityName, country: req.body.country.toLowerCase() });
  if (city) {
    return res.status(400).send({
      statusCode: 400,
      message: "Failure",
      data: { message: CITY_CONSTANTS.CITY_ALREADY_EXISTS },
    });
  }
  city = new City({
    cityName: cityName,
    country: req.body.country.toLowerCase(),
  });
  city.location.coordinates[0] = req.body.location[0];
  city.location.coordinates[1] = req.body.location[1];
  await city.save();
  // let charges = new FeeAndLimit({});
  // charges.serviceTax = 0;
  // charges.serviceCharge = 0;
  // charges.vatCharge = 0;
  // charges.maxOrderAmtForCod = 0;
  // charges.cityId = city._id.toString();
  // charges.type = "cityWise";
  // await charges.save();
  // await FeeAndLimit.insertMany([
  //   {
  //     serviceTax: 0,
  //     serviceCharge: 0,
  //     vatCharge: 0,
  //     waitingTimeFarePerMin: 0,
  //     waitingTimeMinBuffer: 0,
  //     exceededDeliveryChargesPerKm: 0,
  //     rideTimeFarePerMin: 0,
  //     defaultRideTimeFreeMin: 0,
  //     deliveryRadius: 0,
  //     cityId: city._id.toString(),
  //     baseFare: 0,
  //     defaultDistance: 0,
  //     startDeliveryTime: "12:00 AM",
  //     endDeliveryTime: "12:00 PM",
  //     startDeliveryTimeInSec: 0,
  //     endDeliveryTimeInSec: 86399,
  //     type: "pickUpDrop",
  //     driverPlatformFeePercent: 0,
  //   },
  //   {
  //     serviceTax: 0,
  //     serviceCharge: 0,
  //     vatCharge: 0,
  //     exceededDeliveryChargesPerKm: 0,
  //     cityId: city._id.toString(),
  //     baseFare: 0,
  //     deliveryRadius: 0,
  //     defaultDistance: 0,
  //     startDeliveryTime: "12:00 AM",
  //     endDeliveryTime: "12:00 PM",
  //     startDeliveryTimeInSec: 0,
  //     endDeliveryTimeInSec: 86399,
  //     type: "store",
  //     driverPlatformFeePercent: 0,
  //     vendorPlatformFeePercent: 0,
  //     maxOrderAmtForCod: 0,
  //   },
  // ]);
  let response = {};
  response.cityId = city._id.toString();
  res.send({
    statusCode: 200,
    message: "Success",
    data: { message: CITY_CONSTANTS.CITY_ADDED, response },
  });
});
router.delete("/:id", identityManager(["admin"], { city: "W" }), async (req, res) => {
  // let subCategory = await SubCategory.findOne({ _id: req.params.id });
  let criteria = {};
  criteria._id = req.params.id;
  let city = await City.findOne({ _id: criteria });
  if (!city)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CITY_CONSTANTS.CITY_NOT_FOUND },
    });

  await City.deleteOne({ _id: criteria });
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: CITY_CONSTANTS.CITY_DELETED },
  });
});

module.exports = router;
