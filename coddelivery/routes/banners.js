const { CAT_CONSTANTS, BANNER_CONSTANTS, SUB_CAT_CONSTANTS } = require("../config/constant.js");
const mongoose = require("mongoose");
const { Banner, validateBanner, getValidateBanner, validatePutBanner } = require("../models/banner");
const { identityManager } = require("../middleware/auth");
const express = require("express");
const { City } = require("../models/city.js");
const router = express.Router();

// get banner list
router.get("/", identityManager(["admin", "vendor", "public"], { banner: "W" }), async (req, res) => {
  const { error } = getValidateBanner(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  let offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);

  let criteria = {};
  let banner = [];
  // if (req.query.bannerType == "homeAll") {
  //   criteria.bannerType = { $in: ["homeAdmin", "home"] };
  // }
  // if (req.query.bannerType == "restaurant" || req.query.bannerType == "grocery" || req.query.bannerType == "liquor") {
  //   criteria.bannerType = req.query.bannerType;
  // }
  if (req.query.bannerId) criteria._id = mongoose.Types.ObjectId(req.query.bannerId);
  if (req.query.type) criteria.type = req.query.type;
  if (req.query.cityId) criteria.cityId = req.query.cityId;
  if (req.query.status && req.jwtData && req.jwtData.role == "admin") {
    criteria.status = req.query.status;
  } else {
    criteria.status = "active";
  }
  if (req.query.startDate) criteria.startTime = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.startTime = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.startTime = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  // let banner = await Banner.aggregate([
  //   { $match: criteria },
  //   { $sort: { sortOrder: 1 } },
  //   { $project: { _id: 0, bannerId: "$_id", banner: 1, status: 1, type: 1, bannerType: 1, startTime: 1, expireTime: 1, link: 1, sortOrder: 1 } }
  // ]);

  let bannerList = await Banner.aggregate([
    { $match: criteria },
    {
      $facet: {
        allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],
        paginatedDocs: [
          { $skip: offset },
          { $limit: limit },
          { $sort: { sortOrder: 1, startTime: 1 } },
          {
            $addFields: {
              vendorId: {
                $cond: [{ $ne: ["$vendorId", ""] }, { $toObjectId: "$vendorId" }, "$vendorId"],
              },
            },
          },
          // { $addFields: { vendorId: { $toObjectId: "$vendorId" } } },
          { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },
          {
            $project: {
              _id: 0,
              bannerId: "$_id",
              vendorId: 1,
              vendorName: { $arrayElemAt: ["$vendorData.name", 0] },
              banner: 1,
              status: 1,
              type: 1,
              bannerType: 1,
              startTime: 1,
              expireTime: 1,
              link: 1,
              sortOrder: 1,
              cityId: 1,
            },
          },
        ],
      },
    },
  ]);

  let totalCount = bannerList[0].allDocs.length > 0 ? bannerList[0].allDocs[0].totalCount : 0;
  banner = bannerList[0].paginatedDocs;

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, banner },
  });
});

// get banner list
router.get("/bannerList", identityManager(["admin", "vendor", "user", "public"], { banner: "W" }), async (req, res) => {
  
  // const { error } = getValidateBanner(req.body);
  // if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  // let offset, limit;
  // if (isNaN(parseInt(req.query.offset))) offset = 0;
  // else offset = parseInt(req.query.offset);
  // if (isNaN(parseInt(req.query.limit))) limit = 500;
  // else limit = parseInt(req.query.limit);

  // let criteria = {};
  // let criteria1 = {};

  // let banner = [];
  // // if (req.query.bannerType == "homeAll") {
  // //   criteria.bannerType = { $in: ["homeAdmin", "home"] };
  // // }
  // // if (req.query.bannerType == "restaurant" || req.query.bannerType == "grocery" || req.query.bannerType == "liquor") {
  // //   criteria.bannerType = req.query.bannerType;
  // // }
  // if (req.query.bannerId) criteria._id = mongoose.Types.ObjectId(req.query.bannerId);
  // if (req.query.type) criteria.type = req.query.type;

  // if (req.query.status && req.jwtData && req.jwtData.role == "admin") {
  //   criteria.status = req.query.status;
  // } else {
  //   criteria.status = "active";
  // }
  // let lon = 0;
  // let lat = 0;
  // if (req.query.cityId) {
  //   criteria1._id = mongoose.Types.ObjectId(req.query.cityId);
  // } else {
  //   if (req.query.lon) {
  //     lon = parseFloat(req.query.lon);
  //   }
  //   if (req.query.lat) {
  //     lat = parseFloat(req.query.lat);
  //   }
  // }
  // // if (req.query.startDate) criteria.startTime = { $gte: parseInt(req.query.startDate) };
  // // if (req.query.endDate) criteria.startTime = { $lte: parseInt(req.query.endDate) };
  // // if (req.query.startDate != null && req.query.endDate != null) criteria.startTime = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  // // let banner = await Banner.aggregate([
  // //   { $match: criteria },
  // //   { $sort: { sortOrder: 1 } },
  // //   { $project: { _id: 0, bannerId: "$_id", banner: 1, status: 1, type: 1, bannerType: 1, startTime: 1, expireTime: 1, link: 1, sortOrder: 1 } }
  // // ]);

  // let bannerList = await City.aggregate([
  //   // {
  //   //   $geoNear: {
  //   //     near: { type: "Point", coordinates: [lon, lat] },
  //   //     distanceField: "dist.calculated",
  //   //     // maxDistance: maxDistance,
  //   //     query: criteria1,
  //   //     includeLocs: "dist.location",
  //   //     spherical: true,
  //   //     // distanceMultiplier: 6378.1,
  //   //   },
  //   // },
  //   {
  //     $limit: 1,
  //   },
  //   {
  //     $project: {
  //       cityId: { $toString: "$_id" },
  //     },
  //   },
  //   // {
  //   //   $lookup: { from: "banners", localField: "cityId", foreignField: "cityId", as: "bannerData" },
  //   // },
  //   {
  //     $lookup: {
  //       from: "banners",
  //       let: { cityId: "$cityId" },
  //       pipeline: [
  //         {
  //           $match: {
  //             $expr: {
  //               $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$status", "active"] }],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 0,
  //             bannerId: "$_id",
  //             vendorId: 1,
  //             banner: 1,
  //             status: 1,
  //             type: 1,
  //             bannerType: 1,
  //             startTime: 1,
  //             expireTime: 1,
  //             link: 1,
  //             sortOrder: 1,
  //             cityId: 1,
  //           },
  //         },
  //         { $match: criteria },
  //       ],
  //       as: "bannerData",
  //     },
  //   },
  //   {
  //     $project: {
  //       cityId: 0,
  //       _id: 0,
  //     },
  //   },
  //   // { $match: criteria },
  // ]);
  // if (bannerList.length > 0) {
  //   bannerList = bannerList[0].bannerData;
  // } else {
  //   bannerList = [];
  // }

  let criteria = {};

  let limit, offset;
  if (req.query.limit) {
    limit = parseInt(req.query.limit);
  } else limit = 500;
  if (req.query.offset) {
    offset = parseInt(req.query.offset);
  } else offset = 0;

  if (req.query.bannerId) criteria._id = mongoose.Types.ObjectId(req.query.bannerId);

  let list = await Banner.aggregate([
    { $match: criteria },
    {
      $project: {
        _id: 0,
        bannerId: "$_id",
        vendorId: 1,
        banner: 1,
        status: 1,
        type: 1,
        bannerType: 1,
        startTime: 1,
        expireTime: 1,
        link: 1,
        sortOrder: 1,
        cityId: 1,
      },
    },
    {
      $facet: {
        allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],
        paginatedDocs: [{ $skip: offset }, { $limit: limit }]
      }
    }
  ]);

  let totalCount = list[0].allDocs.length > 0 ? list[0].allDocs[0].totalCount : 0;
  let bannerList = list[0].paginatedDocs;

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { bannerList, totalCount },
  });
});

// add banner
router.post("/", identityManager(["admin", "vendor"], { banner: "W" }), async (req, res) => {
  const { error } = validateBanner(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let vendorId;
  if (req.jwtData.role === "vendor") {
    vendorId = req.jwtData.userId;
  } else {
    vendorId = req.body.vendorId;
  }

  banner = new Banner({
    bannerId: req.body.bannerId,
    banner: req.body.banner,
    vendorId: vendorId,
    type: req.body.type,
    bannerType: req.body.bannerType,
    cityId: req.body.cityId,
    link: req.body.link,
    startTime: req.body.startTime,
    expireTime: req.body.expireTime,
    sortOrder: req.body.sortOrder,
    status: "active",
  });

  await banner.save();

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: BANNER_CONSTANTS.BANNER_ADD },
  });
});

// add header banner
router.put("/", identityManager(["admin", "vendor"], { banner: "W" }), async (req, res) => {
  const { error } = validatePutBanner(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let banner = await Banner.findOne({ _id: req.body.bannerId });
  if (!banner)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: BANNER_CONSTANTS.BANNER_NOT_FOUND },
    });

  banner.vendorId = req.body.vendorId || banner.vendorId;
  banner.banner = req.body.banner || banner.banner;
  banner.type = req.body.type || banner.type;
  banner.bannerType = req.body.bannerType || banner.bannerType;
  banner.link = req.body.link || banner.link;
  banner.startTime = req.body.startTime || banner.startTime;
  banner.expireTime = req.body.expireTime || banner.expireTime;
  banner.sortOrder = req.body.sortOrder || banner.sortOrder;
  banner.status = req.body.status || banner.status;
  banner.cityId = req.body.cityId || banner.cityId;

  await banner.save();

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: BANNER_CONSTANTS.BANNER_UPDATE },
  });
});

router.delete("/:bannerId", identityManager(["admin", "vendor"], { banner: "W" }), async (req, res) => {
  let criteria = {};
  criteria._id = req.params.bannerId;
  let banner = await Banner.findOne(criteria);
  if (!banner) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: {
        message: { message: BANNER_CONSTANTS.BANNER_NOT_FOUND },
      },
    });
  }
  await Banner.deleteOne(criteria);

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: BANNER_CONSTANTS.BANNER_DELETED },
  });
});

router.post("/headerBanner/delete", identityManager(["admin"], { banner: "W" }), async (req, res) => {
  const { error } = validateBanner(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let banner = await CategoryBanner.findOne({ type: req.body.type });
  if (!banner)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: BANNER_CONSTANTS.BANNER_NOT_FOUND },
    });

  await CategoryBanner.updateOne({ type: req.body.type }, { $pull: { headerBanner: req.body.banner } });

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: BANNER_CONSTANTS.BANNER_DELETED },
  });
});

module.exports = router;
