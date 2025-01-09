const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const config = require("config");
const { identityManager } = require("../middleware/auth");
const { AuditLog } = require("../models/auditLog");

router.get("/", identityManager(["vendor", "admin"]), async (req, res) => {
  var criteria = {};
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.id) criteria._id = mongoose.Types.ObjectId(req.query.id);
  if (req.query.typeOfAction) criteria.typeOfAction = req.query.typeOfAction;
  if (req.query.userId) criteria.userId = req.query.userId;
  if (req.query.type) criteria.actionOn = req.query.type;
  if (req.query.recordId) criteria.recordId = req.query.recordId;
  console.log("criteria", criteria);
  let totalCount = await AuditLog.countDocuments(criteria);
  let auditLogs = await AuditLog.aggregate([
    {
      $match: criteria,
    },
    {
      $addFields: {
        cityId: {
          $cond: [{ $ne: ["$updatedData.cityId", null] }, { $toObjectId: "$updatedData.cityId" }, "$updatedData.cityId"],
        },
      },
    },

    { $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" } },
    { $addFields: { cityName: { $arrayElemAt: ["$cityData.cityName", 0] } } },

    {
      $sort: { insertDate: -1 },
    },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        cityData: 0,
      },
    },
  ]);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, auditLogs } });
});

module.exports = router;
