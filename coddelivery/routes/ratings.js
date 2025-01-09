const express = require("express");
const _ = require("lodash");
const config = require("config");
const router = express.Router();
const mongoose = require("mongoose");
const { Rating, validateRatingPost } = require("../models/rating");
const { sendFCM } = require("../services/fcmModule");
const { RATING_CONSTANTS, ORDER_CONSTANTS, DRIVER_CONSTANTS, USER_CONSTANTS } = require("../config/constant");
const { Vendor } = require("../models/vendor");
const { Driver } = require("../models/driver");
const { identityManager } = require("../middleware/auth");
const { Order } = require("../models/order");

router.post("/", identityManager(["user"]), async (req, res) => {
  const { error } = validateRatingPost(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let order = await Order.findOne({ _id: req.body.orderId, userId: req.jwtData.userId });
  if (!order) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND },
    });
  }
  let checkUser;
  if (req.body.ratingType == "vendorRating") {
    checkUser = await Vendor.findOne({ _id: req.body.ratedUserId, isDeleted: false, status: "active" });
  } else {
    checkUser = await Driver.findOne({ _id: req.body.ratedUserId });
  }

  if (!checkUser) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.INVALID_USER } });

  let ratingExisted = await Rating.findOne({
    ratedUserId: req.body.ratedUserId,
    orderId: req.body.orderId,
    ratingType: req.body.ratingType,
  });
  if (ratingExisted)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: RATING_CONSTANTS.ALREADY_RATED },
    });

  let rating = new Rating(_.pick(req.body, ["ratedUserId", "ratingType", "orderId", "tag", "review"]));
  rating.userId = req.jwtData.userId;
  rating.rating = parseFloat(req.body.rating.toFixed(1));

  await rating.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: RATING_CONSTANTS.RATING_ADDED_SUCCESSFULLY, rating },
  });

  // let driver = await Driver.findOne({ _id: req.body.ratedUserId });

  checkUser.avgRating = parseFloat(((checkUser.avgRating * checkUser.totalRatings + req.body.rating) / (checkUser.totalRatings + 1)).toFixed(1));

  checkUser.totalRatings += 1;
  await checkUser.save();
  if (req.body.ratingType == "vendorRating") {
    order.orderRating = parseFloat(req.body.rating.toFixed(1));
    order.isVendorRated = true;
  }
  if (req.body.ratingType == "driverRating") {
    order.driverRatedByUser = parseFloat(req.body.rating.toFixed(1));
    order.isDriverRated = true;
  }
  order.isRatingReminderSent = true;
  await order.save();
  // let data = {
  //   orderId: order._id.toString(),
  //   orderStatus: order.orderStatus.toString(),
  //   ratedUserId: driver._id.toString(),
  //   driverName: driver.name.toString()
  // };
  // await sendFCM(driver.deviceToken, data, "orderAccepted")

  //  if (req.body.rating && req.body.review !== "") product.reviewCount = product.reviewCount + 1
  //  product.averageRating = parseFloat(
  //    (product.averageRating * product.ratingCount + req.body.rating) / (product.ratingCount + 1).toFixed(1)
  //  )
  //  product.ratingCount = product.ratingCount + 1
  //  await product.save()
});

router.get("/ratingPending", identityManager(["user"]), async (req, res) => {
  let order = await Order.find({ userId: req.jwtData.userId, orderStatus: "DELIVERED" }).sort({ insertDate: -1 }).limit(1);
  console.log("order", order);

  if (order[0]) {
    if (order[0].driverRatedByUser === 0 && order[0].orderRating === 0 && order[0].sendRatingReminder === true) {
      order[0].sendRatingReminder = false;
      await order[0].save();
      order = order[0];
      order.orderId = order._id.toString();
      let response = _.pick(order, [
        "orderId",
        "orderNo",
        "location",
        "vendorLocation",
        "orderStatus",
        "paymentUrl",
        "mobile",
        "email",
        "vendorCategory",
        "driverAmount",
        "countryCode",
        "vendorName",
        "deliveryCharges",
        "driverId",
        "deliveryTip",
        "isRefundPending",
        "deliveryPic",
        "deliveryInstructions",
        "vendorId",
        "name",
        "deliveryTime",
        "deliveryAddress",
        "details",
        "paymentType",
        "taxes",
        "cartId",
        "taxesPercent",
        "creationDate",
        "insertDate",
        "vendorImage",
        "vendorName",
        "vendorAddress",
        "totalAmount",
        "userId",
        "cardDetails",
      ]);

      return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
    }
  }
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: {} });
});

router.get("/", identityManager(["vendor", "admin"], {}), async (req, res) => {
  let criteria = {};
  var offset, limit;

  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.jwtData.role == "vendor") {
    criteria.ratedUserId = req.jwtData.userId;
    criteria.ratingType = "vendorRating";
  } else if (req.jwtData.role == "admin") {
    // criteria.ratingType = "driverRating";
    // if (req.query.driverId) {
    //   criteria.ratedUserId = req.query.driverId;
    // }
    if (req.query.ratedUserId) {
      criteria.ratedUserId = req.query.ratedUserId;
    }
  }
  let ratingList = await Rating.aggregate([
    {
      $match: criteria,
    },
    { $sort: { insertDate: -1 } },
    { $skip: offset },
    { $limit: limit },
    {
      $addFields: {
        userObjectId: { $toObjectId: "$ratedUserId" },
        orderId: {
          $cond: [{ $ne: ["$orderId", ""] }, { $toObjectId: "$orderId" }, "$orderId"],
        },
      },
    },
    { $addFields: { userId: { $toObjectId: "$userId" } } },
    // { $addFields: { orderId: { $toObjectId: "$orderId" } } },

    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "userData" } },

    { $lookup: { from: "drivers", localField: "userObjectId", foreignField: "_id", as: "driverData" } },

    { $lookup: { from: "vendors", localField: "userObjectId", foreignField: "_id", as: "vendorData" } },
    { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "orderData" } },
    {
      $project: {
        _id: 0,
        ratingId: "$_id",
        ratedUserId: 1,
        orderData: 1,
        userId: 1,
        rating: 1,
        tag: 1,
        orderId: 1,
        review: 1,
        ratingType: 1,
        insertDate: 1,
        orderNo: { $arrayElemAt: ["$orderData.orderNo", 0] },
        userFirstName: { $arrayElemAt: ["$driverData.firstName", 0] },
        userLastName: { $arrayElemAt: ["$userData.lastName", 0] },
        userId: { $arrayElemAt: ["$userData._id", 0] },

        ratedUserAvgRating: {
          $cond: [{ $ne: ["$ratingType", "vendorRating"] }, { $arrayElemAt: ["$driverData.avgRating", 0] }, { $arrayElemAt: ["$vendorData.avgRating", 0] }],
        },
        ratedUserTotalRating: {
          $cond: [{ $ne: ["$ratingType", "vendorRating"] }, { $arrayElemAt: ["$driverData.totalRatings", 0] }, { $arrayElemAt: ["$vendorData.totalRatings", 0] }],
        },

        ratedUserFirstName: {
          $cond: [{ $ne: ["$ratingType", "vendorRating"] }, { $arrayElemAt: ["$driverData.firstName", 0] }, { $arrayElemAt: ["$vendorData.name", 0] }],
        },
        ratedUserLastName: {
          $cond: [{ $ne: ["$ratingType", "vendorRating"] }, { $arrayElemAt: ["$driverData.lastName", 0] }, ""],
        },
        ratedUserId: {
          $cond: [{ $ne: ["$ratingType", "vendorRating"] }, { $arrayElemAt: ["$driverData._id", 0] }, { $arrayElemAt: ["$vendorData._id", 0] }],
        },
      },
    },
  ]);
  let totalCount = await Rating.countDocuments(criteria);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, ratingList } });
});

module.exports = router;
