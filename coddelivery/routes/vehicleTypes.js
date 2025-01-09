const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const config = require("config");
const { VehicleType, validateVehicleType } = require("../models/vehicleType");
const { OTHER_CONSTANTS } = require("../config/constant.js");
const { identityManager } = require("../middleware/auth");

router.post("/", identityManager(["admin"], { pickDropSettings: "W" }), async (req, res) => {
  const { error } = validateVehicleType(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let vehicleType = await VehicleType.findOne({ vehicle: req.body.vehicle.toLowerCase() });
  if (vehicleType) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.VEHICLE_ALREADY_EXISTS },
    });
  }
  vehicleType = new VehicleType({});
  vehicleType.vehicle = req.body.vehicle.toLowerCase();

  await vehicleType.save();

  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: OTHER_CONSTANTS.VEHICLE_CREATED },
  });
});
router.get("/", identityManager(["admin", "user", "public"], { pickDropSettings: "W" }), async (req, res) => {
  let criteria = {};
  if (req.query.vehicleTypeId) {
    criteria._id = mongoose.Types.ObjectId(req.query.vehicleTypeId);
  }
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.vehicle = regexName;
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);
  let vehicleType = await VehicleType.aggregate([
    {
      $match: criteria,
    },
    {
      $sort: { vehicle: 1 },
    },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        vehicleTypeId: "$_id",
        vehicle: 1,
        _id: 0,
      },
    },
  ]);
  let totalCount = await VehicleType.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, vehicleType },
  });
});
router.delete("/:id", identityManager(["admin"], { pickDropSettings: "W" }), async (req, res) => {
  let vehicleType = await VehicleType.findOne({ _id: req.params.id });
  if (!vehicleType)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.VEHICLE_NOT_FOUND },
    });
  await VehicleType.deleteOne({ _id: req.params.id });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: OTHER_CONSTANTS.VEHICLE_DELETED },
  });
});

module.exports = router;
