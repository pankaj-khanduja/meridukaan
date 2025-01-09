const { SERVICE_AREA_CONSTANTS, CITY_CONSTANTS, OTHER_CONSTANTS } = require("../config/constant.js");
const { ServiceArea, validateServiceAreaPost, validateServiceAreaPut, isPickUpPossible } = require("../models/serviceArea");
const { City } = require("../models/city");
const express = require("express");
const { identityManager } = require("../middleware/auth");
const router = express.Router();

router.get("/isPickUpPossible", identityManager(["admin", "public", "user"], {}), async (req, res) => {
  let criteria = {};
  let lon = 0;
  let lat = 0;
  if (req.query.lon) {
    lon = parseFloat(req.query.lon);
  }
  if (req.query.lat) {
    lat = parseFloat(req.query.lat);
  }

  criteria.serviceType = "pickUpAndDrop";
  let data = await isPickUpPossible(lon, lat, criteria);
  //   await ServiceArea.aggregate([
  //     {
  //       $geoNear: {
  //         near: { type: "Point", coordinates: [lon, lat] },
  //         distanceField: "dist.calculated",
  //         // maxDistance: config.get("deliveryRadius"),

  //         query: criteria,
  //         includeLocs: "dist.location",
  //         spherical: true,
  //       },
  //     },
  //     {
  //       $addFields: {
  //         isDeliveryPossible: {
  //           $cond: [
  //             {
  //               $lte: ["$dist.calculated", { $multiply: ["$radius", 1000] }],
  //             },
  //             true,
  //             false,
  //           ],
  //         },
  //       },
  //     },
  //     { $match: { isDeliveryPossible: true } },
  //     { $sort: { "dist.calculated": 1 } },
  //     { $limit: 1 },
  //     {
  //       $project: {
  //         cityId: 1,
  //         _id: 0,
  //       },
  //     },
  //   ]);
  //   console.log("data", data);
  if (!data) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.NOT_SERVING },
    });
  }
  let response = {};
  response.cityId = data.cityId;
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

router.get("/", identityManager(["admin"], { serviceArea: "W" }), async (req, res) => {
  let criteria = {};
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  if (req.query.type) criteria.serviceType = req.query.type;
  let totalCount = await ServiceArea.countDocuments(criteria);
  let areaList = await ServiceArea.aggregate([
    { $match: criteria },
    { $sort: { creationDate: -1 } },
    { $addFields: { cityId: { $toObjectId: "$cityId" } } },
    { $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" } },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        _id: 0,
        serviceId: "$_id",
        cityId: 1,
        cityName: { $arrayElemAt: ["$cityData.cityName", 0] },
        location: 1,
        radius: 1,
        areaName: 1,
        serviceType: 1,
        insertDate: 1,
      },
    },
  ]);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, areaList } });
});

router.post("/", identityManager(["admin"], { serviceArea: "W" }), async (req, res) => {
  const { error } = validateServiceAreaPost(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }

  let serviceArea = new ServiceArea({});
  serviceArea.cityId = req.body.cityId;
  serviceArea.radius = req.body.radius;
  serviceArea.location.coordinates = req.body.location;
  serviceArea.areaName = req.body.areaName;
  serviceArea.serviceType = "pickUpAndDrop";
  await serviceArea.save();
  return res.send({
    apiId: req.apiId,
    statusCode: "200",
    message: "Success",
    data: { message: SERVICE_AREA_CONSTANTS.SERVICE_AREA_ADDED },
  });
});

router.delete("/:serviceId", identityManager(["admin"], { serviceArea: "W" }), async (req, res) => {
  let service = await ServiceArea.deleteOne({ _id: req.params.serviceId });
  if (service.n == 1) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "success",
      data: { message: SERVICE_AREA_CONSTANTS.SERVICE_AREA_DELETED },
    });
  } else {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SERVICE_AREA_CONSTANTS.SERVICE_AREA_NOT_FOUND },
    });
  }
});

module.exports = router;
