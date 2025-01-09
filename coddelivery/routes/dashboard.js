const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { User } = require("../models/user");
const { Vendor } = require("../models/vendor");
const { Driver } = require("../models/driver");
const { Order } = require("../models/order");
const { Coupon } = require("../models/coupon");
const { Product } = require("../models/product");
const { identityManager } = require("../middleware/auth");
const { PayoutEntry } = require("../models/payoutEntry");

router.get("/", identityManager(["admin", "vendor"], { dashboard: "W" }), async (req, res) => {
  var resObj = {};
  let totalUser = await User.find({}).count();
  let totalVendor = await Vendor.find({ isDeleted: false }).count();
  let totalOrder = await Order.find({ orderStatus: { $ne: "PENDING" } }).count(); // check View the total number of orders placed.
  let totalDeliveredOrder = await Order.find({ orderStatus: "DELIVERED" }).count();
  let totalDriver = await Driver.find({}).count();
  // let totalDriver = await Driver.find({}).count(); Revenue Generated.
  let totalCoupon = await Coupon.find({ type: "coupon" }).count();
  let totalPromocode = await Coupon.find({ type: "promocode" }).count();

  // let totalInvoices = await Coupon.find({ type: "promocode" }).count(); // Invoices
  let pickupDeliveryOrder = await Order.find({ vendorCategory: "pickUpAndDrop" }).count();
  let freezedDriver = await Driver.countDocuments({ isFreezed: true, status: "active" });
  let criteria = {};
  criteria.orderStatus = "DELIVERED";

  let totalRevenue = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: { _id: null, totalRevenue: { $sum: "$adminAmount" } },
    },
    {
      $project: {
        totalRevenue: 1,
        _id: 0,
      },
    },
  ]);
  let payoutEntry = await PayoutEntry.findOne({ status: "halted" });
  let insufficientBalance = false;
  if (payoutEntry) {
    insufficientBalance = true;
  }

  resObj.insufficientBalance = insufficientBalance;
  console.log("totalRevenue", totalDeliveredOrder);
  resObj.totalUser = totalUser || 0;
  resObj.totalVendor = totalVendor || 0;
  resObj.totalOrder = totalOrder || 0;
  resObj.totalDeliveredOrder = totalDeliveredOrder;
  resObj.totalDriver = totalDriver || 0;
  resObj.totalCoupon = totalCoupon || 0;
  resObj.totalPromocode = totalPromocode || 0;
  // resObj.totalRevenue = totalRevenue[0].totalRevenue || 0;
  resObj.totalRevenue = totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0;
  resObj.pickUpAndDeliveryOrder = pickupDeliveryOrder || 0;
  resObj.freezedDriver = freezedDriver || 0;

  console.log("resObj", resObj);

  return res.status(200).send({ apiId: req.apiId, statusCode: 200, mesage: "Success", data: resObj });
});

router.get("/vendor", identityManager(["vendor"]), async (req, res) => {
  var resObj = {};
  let totalOrder = await Order.find({ vendorId: req.jwtData.userId, orderStatus: { $ne: "PENDING" } }).count();
  let totalDeliveredOrder = await Order.find({ orderStatus: "DELIVERED", vendorId: req.jwtData.userId }).count();
  let totalCoupon = await Coupon.find({ userId: req.jwtData.userId }).count();
  let totalProduct = await Product.find({ vendorId: req.jwtData.userId }).count();
  let criteria = {};
  criteria.orderStatus = "DELIVERED";
  criteria.vendorId = req.jwtData.userId;
  let totalRevenue = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: { _id: null, totalRevenue: { $sum: "$vendorAmount" } },
    },
    {
      $project: {
        totalRevenue: 1,
        _id: 0,
      },
    },
  ]);
  console.log("totalRevenue", totalRevenue);
  resObj.totalOrder = totalOrder || 0;
  resObj.totalCoupon = totalCoupon || 0;
  resObj.totalProduct = totalProduct || 0;
  resObj.totalDeliveredOrder = totalDeliveredOrder || 0;
  resObj.totalRevenue = totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0;
  console.log("resObj", resObj);
  return res.status(200).send({ apiId: req.apiId, statusCode: 200, mesage: "Success", data: resObj });
});

router.get("/influencer", identityManager(["influencer"]), async (req, res) => {
  var resObj = {};
  let coupon = await Coupon.findOne({ userId: req.jwtData.userId });
  let criteria = {};
  criteria.orderStatus = "DELIVERED";
  criteria.influencerId = req.jwtData.userId;
  let totalRevenue = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: { _id: null, totalRevenue: { $sum: "$influencerAmount" } },
    },
    {
      $project: {
        totalRevenue: 1,
        _id: 0,
      },
    },
  ]);
  resObj.totalRedemptionCount = coupon ? coupon.redemptionCount : 0;
  resObj.totalRevenue = totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0;
  console.log("resObj", resObj);
  return res.status(200).send({ apiId: req.apiId, statusCode: 200, mesage: "Success", data: resObj });
});
router.post("/balance", identityManager(["admin"]), async (req, res) => {
  await PayoutEntry.updateMany({ status: "halted" }, { $set: { status: "pending" } });
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Balance added successfully" },
  });
});
module.exports = router;
