const { ADDRESS_CONSTANTS, OTHER_CONSTANTS } = require("../config/constant.js");
const { Address } = require("../models/address");
const { Vendor } = require("../models/vendor");
const config = require("config");
const mongoose = require("mongoose");
const express = require("express");
const { identityManager } = require("../middleware/auth");
const { deliveryCharges, calculateTax } = require("../services/cartCharges");
const { validateDeliveryLocation, validateAddress, validateAddressPut, validateDefaultAddress } = require("../models/address");
const { User } = require("../models/user.js");

const router = express.Router();

router.post("/", identityManager(["user"]), async (req, res) => {
  const { error } = validateAddress(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let address = await Address.findOne({
    "address.currentAddress": req.body.address.currentAddress,
    "address.tag": req.body.address.tag,
    "address.completeAddress": req.body.address.completeAddress,
    "address.name": req.body.address.name,
    // "address.cityName": req.body.cityName,
    // "address.cityId": req.body.cityId,

    "location.coordinates": req.body.location,
  });
  if (!address) {
    address = new Address(req.body);
    address.userId = req.jwtData.userId;
    address.location.coordinates[0] = req.body.location[0];
    address.location.coordinates[1] = req.body.location[1];
    await address.save();
  }
  // let response = _.pick(address, ["userId", "address.name", "address.currentAddress", "address.complete", "insertDate", "facebookId", "googleId", "appleId", "accessToken", "address", "location"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { address },
  });
});

router.get("/", identityManager(["user"]), async (req, res) => {
  let address = await Address.find({ userId: req.jwtData.userId }).sort({ _id: -1 });
  // if (!address)
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 200,
  //     message: "Success",
  //     data: { address },
  //   });
  address.addressId = address._id;

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { address },
  });
});

router.post("/default", identityManager(["user"], {}), async (req, res) => {
  const { error } = validateDefaultAddress(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let address;
  if (req.body.addressId) {
    address = await Address.findOne({ _id: req.body.addressId });

    if (!address)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: ADDRESS_CONSTANTS.INVALID_ADDRESS },
      });
  } else {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADDRESS_CONSTANTS.ADDRESS_REQUIRED },
    });
  }

  await Address.updateMany({ userId: req.jwtData.userId }, { $set: { isDefaultAddress: false } });

  address.isDefaultAddress = true;


  if (address.isDefaultAddress === true) {
    await Address.updateOne({ _id: address._id }, { $set: { isDefaultAddress: true } });
  }

  await address.save();

  let user = await User.findOne({ _id: req.jwtData.userId });
  user.cityId = address.address.cityId;
  await user.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { address, message: ADDRESS_CONSTANTS.SET_DEFAULT },
  });
});

router.put("/", identityManager(["user", "admin"], { users: "W" }), async (req, res) => {
  const { error } = validateAddressPut(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let address = await Address.findOne({ _id: req.body.addressId });

  if (!address)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADDRESS_CONSTANTS.ADDRESS_NOT_FOUND },
    });

  address.address.currentAddress = req.body.address.currentAddress || address.address.currentAddress;
  address.address.completeAddress = req.body.address.completeAddress || address.address.completeAddress;
  address.address.name = req.body.address.name || address.address.name;
  address.address.zipcode = req.body.address.zipcode || address.address.zipcode;
  address.address.tag = req.body.address.tag || address.address.tag;
  address.address.cityName = req.body.address.cityName || address.address.cityName;
  address.address.cityId = req.body.address.cityId || address.address.cityId;
  // console.log(req.body?.location[0])
  address.location = {
    type: "Point",
    coordinates: [
      req.body?.location?.[0] || address.location.coordinates[0],
      req.body?.location?.[1] || address.location.coordinates[1]
    ]
  }
  await address.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADDRESS_CONSTANTS.ADDRESS_UPDATE, data: address },
  });
});

router.delete("/:id", identityManager(["user", "admin"]), async (req, res) => {
  let criteria = {};
  criteria._id = req.params.id;
  let address = await Address.findOne({ _id: criteria });
  if (!address) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADDRESS_CONSTANTS.INVALID_ADDRESS },
    });
  }
  // if(address.isDefaultAddress){
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: "You cannnot delete your default address."},
  //   });
  // }
  await Address.deleteOne({ _id: criteria });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADDRESS_CONSTANTS.ADDRESS_DELETED, data: address },
  });
});

router.get("/validateAddress", async (req, res) => {
  var { error } = validateDeliveryLocation(req.query);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  var criteria = {};
  let userId;
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.vendorId) {
    criteria._id = mongoose.Types.ObjectId(req.query.vendorId);
  }
  // if (req.jwtData.role === "user") {
  //   userId = req.jwtData.userId
  // } else {
  //   userId = req.query.userId
  // }

  // var address = await Address.findOne({ userId: req.jwtData.userId, isDefaultAddress: true });
  // console.log(address)
  let lng, lat;
  if (req.query.lon1) {
    lng = parseFloat(req.query.lon1);
  } else {
    lng = 0;
  }
  if (req.query.lat1) {
    lat = parseFloat(req.query.lat1);
  } else {
    lat = 0;
  }
  // let radius = config.get("deliveryRadius");
  let vendor = await Vendor.findById(req.query.vendorId);
  if (vendor) {
    radius = vendor.deliveryRadius * 1000;
  }
  
  console.log("radiussssssss", radius, lat, lng);

  let vendors = await Vendor.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "dist.calculated",
        // maxDistance: config.get("deliveryRadius"),
        maxDistance: radius,
        query: { $expr: { $eq: ["$_id", criteria._id] } },
        includeLocs: "dist.location",
        spherical: true,
      },
    },
  ]);
  let response = {};

  // response = vendors[0];

  if (vendors.length == 0) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: OTHER_CONSTANTS.DELIVERY_NOT_POSSIBLE },
    });
  }

  let location = {};
  location.lat1 = parseFloat(req.query.lat1);
  location.lon1 = parseFloat(req.query.lon1);
  let dCharge = await deliveryCharges(location, "normal", req.query.vendorId);
  response.deliveryCharges = dCharge.deliveryCharges;

  if (dCharge.distance > vendor.deliveryRadius) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: OTHER_CONSTANTS.DELIVERY_NOT_POSSIBLE },
    });
  }

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: OTHER_CONSTANTS.DELIVERY_POSSIBLE, response },
  });
});

module.exports = router;
