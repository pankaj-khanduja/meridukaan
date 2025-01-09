const { Activity } = require("../models/activity.js");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const config = require("config");
const { identityManager } = require("../middleware/auth");
const { formatter } = require("../services/commonFunctions");

//view bank details
router.get("/", identityManager(["driver"]), async (req, res) => {
  let criteria = {};
  let criteria1 = {};

  criteria.userId = req.jwtData.userId;
  criteria1.userId = req.jwtData.userId;
  criteria1.isRead = false;
  console.log("1");
  var offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  let activities = await Activity.aggregate([
    {
      $match: criteria,
    },
    { $sort: { insertDate: -1 } },

    { $addFields: { userId: { $toObjectId: "$userId" } } },

    { $skip: offset },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        userId: 1,
        type: 1,
        isRead: 1,
        data: 1,
        insertDate: 1,
        // name: { $arrayElemAt: ["$driverData.firstName", 0] },
      },
    },
  ]);
  let activityArray = [];
  activities.forEach((element) => {
    activityObject = {};
    activityObject.insertDate = element.insertDate;
    activityObject.type = element.type;
    activityObject.isRead = element.isRead;

    data = {};
    if (element.type === "paidToAdmin") {
      console.log("element.data", element.data);
      data = { amount: element.data.amount.toFixed() };
      activityObject.message = formatter(config.get("activities.payCodSuccess"), data);
    } else if (element.type === "documentApproved") {
      activityObject.message = config.get("activities.documentApproved");
    } else if (element.type === "documentRejected") {
      activityObject.message = config.get("activities.documentRejected");
    } else if (element.type === "tipPaidByUser") {
      console.log("element.data", element.data);
      data = { amount: element.data.amount.toFixed(), orderNo: element.data.orderNo };
      activityObject.message = formatter(config.get("activities.deliveryTip"), data);
    }
    if (activityObject) activityArray.push(activityObject);
  });
  let totalCount = await Activity.countDocuments(criteria);
  let unreadCount = await Activity.countDocuments(criteria1);
  await Activity.updateMany(criteria, { $set: { isRead: true } });
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, unreadCount, activityArray } });
});

module.exports = router;
