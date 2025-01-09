const { CAT_CONSTANTS, BANNER_CONSTANTS, SUB_CAT_CONSTANTS } = require("../config/constant.js");
const mongoose = require("mongoose");
const { CategoryBanner, validateBanner, validatePutBanner } = require("../models/merchantCategory");
const { identityManager } = require("../middleware/auth");
const express = require("express");
const router = express.Router();

// get banner list
router.get("/", async (req, res) => {
  let criteria = {};
  if (req.query.type) criteria.type = req.query.type;
  if (req.query.banner) criteria.banner = req.query.banner;
  if (req.query.vendorId) criteria.vendorId = req.query.vendorId;

  var offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);

  let list = await CategoryBanner.aggregate([
    { $match: criteria },
    { $project: { _id: 0, bannerId: "$_id", banner: 1, type: 1 } },
    {
      $facet: {
        allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],
        paginatedDocs: [{ $skip: offset }, { $limit: limit }]
      }
    }
  ]);

  let totalCount = list[0].allDocs.length > 0 ? list[0].allDocs[0].totalCount : 0;
  let banner = list[0].paginatedDocs;
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { banner, totalCount },
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
  // let banner = await CategoryBanner.findOne({ type: req.body.type });
  // if (banner) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: BANNER_CONSTANTS.BANNER_ALREADY_EXISTS },
  //   });
  // }

  banner = new CategoryBanner({
    banner: req.body.banner,
    type: req.body.type,
  });
  if (req.jwtData.role === "vendor") {
    banner.vendorId = req.jwtData.userId;
  }

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
  let banner = await CategoryBanner.findOne({ _id: req.body.bannerId });
  if (!banner)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: BANNER_CONSTANTS.BANNER_NOT_FOUND },
    });

  banner.banner = req.body.banner || banner.banner;
  banner.type = req.body.type || banner.type;


  await banner.save();

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: BANNER_CONSTANTS.BANNER_UPDATE },
  });
});


//remove  
router.delete("/:bannerId", identityManager(["admin", "vendor"], { banner: "W" }), async (req, res) => {

  if (!req.params.bannerId) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: "Please add bannerId" }, });
  if (req.params.bannerId && (!mongoose.Types.ObjectId.isValid(req.params.bannerId))) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: "Please add valid bannerId" }, });


  let banner = await CategoryBanner.findOne({ _id: req.params.bannerId });
  if (!banner)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: BANNER_CONSTANTS.BANNER_NOT_FOUND },
    });
  await CategoryBanner.deleteOne({ _id: req.params.bannerId })

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: BANNER_CONSTANTS.BANNER_UPDATE },
  });
});

module.exports = router;
