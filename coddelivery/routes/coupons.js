const { COUPON_CONSTANTS, CART_CONSTANTS, INFLUENCER_CONSTANTS } = require("../config/constant.js");
const config = require("config");
const Joi = require("joi");
const mongoose = require("mongoose");
const _ = require("lodash");
const { identityManager } = require("../middleware/auth");
const { calculateTax, deliveryCharges, calculateDiscount } = require("../services/cartCharges");
const { isPickUpPossible } = require("../models/serviceArea");
const { Coupon, validateCouponPost, validateCouponPut, validateGet, validateAddPromocodeInPickUp } = require("../models/coupon");
const { Vendor, vendorFareAggregate } = require("../models/vendor");
const { AuditLog, createAuditLog } = require("../models/auditLog");

const { Redemption } = require("../models/redemption");
const { Order } = require("../models/order");
const { Cart } = require("../models/cart");
const express = require("express");
const { FeeAndLimit } = require("../models/feeAndLimit.js");
const { Influencer } = require("../models/influencer");
const { Referral } = require("../models/referral");
const { influencerPayout } = require("../jobs/payout.js");
const router = express.Router();

router.get("/", identityManager(["admin", "vendor", "user", "public"]), async (req, res) => {
  // req.headers["host"];
  const { error } = validateGet(req.query);
  if (error) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let criteria = {};

  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);
  if (req.query.isNewPromocode == "true") {
    criteria.type = "promocode";
    skipVal = 0;
    limitVal = 1;
  }
  if (req.jwtData.role === "vendor") {
    criteria.userId = req.jwtData.userId;
  } else {
    if (req.query.vendorId) {
      // criteria.userId = req.query.vendorId
      criteria = { $or: [{ userId: req.query.vendorId }, { type: "promocode" }] };
    }
  }
  if (req.query.couponId) criteria._id = mongoose.Types.ObjectId(req.query.couponId);

  if (req.query.code) {
    var regexName = new RegExp(req.query.code, "i");
    criteria.code = regexName;
  }
  if (req.query.status) {
    criteria.status = req.query.status;
    criteria.isDisabled = false;
  }

  if (req.query.isDisabled) {
    criteria.isDisabled = true;
  }

  if (req.query.type) criteria.type = req.query.type;

  if (req.query.startDate) criteria.couponStartTime = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.couponStartTime = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.couponStartTime = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  // Update status of existing coupons
  // let currTime = Math.round(new Date() / 1000);
  // let criteriaActive = {};
  // criteriaActive.couponStartTime = { $lte: currTime };
  // criteriaActive.couponEndTime = { $gte: currTime };

  // let criteriaExpired = {};
  // criteriaExpired.couponEndTime = { $lt: currTime };

  //await Coupon.updateMany({}, {$set: })
  console.log("role", req.jwtData.role);
  if (req.query.vendorType) {
    criteria.vendorType = { $in: [req.query.vendorType] };
  } else {
    if (req.jwtData.role == "user" || req.jwtData.role == "public") {
      //this was done due to miscommunication between management and app end
      if (req.query.vendorId) {
        let vendor = await Vendor.findOne({ _id: req.query.vendorId });
        if (vendor) {
          criteria.vendorType = { $in: [vendor.merchantCategory] };
        }
      } else {
        criteria.vendorType = { $in: ["delivery"] };
      }
    }
  }
  let orders = await Order.find({ userId: req.jwtData.userId });
  if (orders.length > 0) {
    criteria.isFirstOrder = false;
  }
  console.log("criteria", criteria);
  let totalCount = await Coupon.countDocuments(criteria);
  let userId = req.jwtData.userId;
  let couponList = await Coupon.aggregate([
    { $match: criteria },
    { $sort: { insertDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    { $addFields: { userId: { $toObjectId: "$userId" } } },
    { $lookup: { from: "vendors", localField: "userId", foreignField: "_id", as: "vendorData" } },
    { $lookup: { from: "influencers", localField: "userId", foreignField: "_id", as: "influencerData" } },
    {
      $project: {
        _id: 0,
        couponId: "$_id",
        code: 1,
        vendorType: 1,
        description: 1,
        couponStartTime: 1,
        couponEndTime: 1,
        perUserLimit: 1,
        type: 1,
        couponType: 1,
        value: 1,
        userId: 1,
        maxRedemption: 1,
        status: 1,
        redemptionCount: 1,
        minOrderPrice: 1,
        createdBy: 1,
        updatedBy: 1,
        isFirstOrder: 1,
        isDisabled: 1,
        insertDate: 1,
        maxDiscountPrice: 1,
        creationDate: 1,
        name: {
          $cond: {
            if: { $anyElementTrue: ["$vendorData"] },
            then: { $arrayElemAt: ["$vendorData.name", 0] },
            else: { $arrayElemAt: ["$influencerData.name", 0] },
          },
        },
      },
    },
  ]);

  return res.send({ statusCode: 200, message: "Success", data: { totalCount, couponList } });
});

router.post("/", identityManager(["admin", "vendor"], { coupon: "W" }), async (req, res) => {
  const { error } = validateCouponPost(req.body);
  if (error) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  // query to check if any active coupon with same name exists
  let couponStatus;
  if (req.body.type == "promocode") {
    couponStatus = await Coupon.findOne({
      code: req.body.code.toLowerCase(),
      // userId: req.jwtData.userId
    });
  } else if (req.body.type == "coupon") {
    couponStatus = await Coupon.findOne({
      $or: [
        { code: req.body.code.toLowerCase(), userId: req.jwtData.userId },
        { code: req.body.code.toLowerCase(), type: { $ne: "coupon" } },
      ],
    });

    // Coupon.findOne({
    //   $or: [
    //     { code: req.body.code.toLowerCase(), userId: req.jwtData.userId },
    //     { code: req.body.code.toLowerCase(), type: { $ne: "coupon" } },
    //   ],
    // });
  } else if (req.body.type == "influencerCode") {
    couponStatus = await Coupon.findOne({
      code: req.body.code.toLowerCase(),
    });
  }
  if (couponStatus) {
    // type: Joi.valid(["coupon", "promocode"]).required(),
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.ALREADY_EXITED } });
  }

  let coupon = new Coupon(
    _.pick(req.body, [
      "description",
      "couponStartTime",
      "couponEndTime",
      "perUserLimit",
      "maxDiscountPrice",
      "couponType",
      "value",
      "maxRedemption",
      "minOrderPrice",
      "isFirstOrder",
      "vendorType",
    ])
  );
  coupon.code = req.body.code.toLowerCase();
  coupon.status = "active";
  coupon.createdBy = req.jwtData.email;
  coupon.type = req.body.type;
  if (req.body.type == "influencerCode") {
    let influencer = await Influencer.findOne({ _id: req.body.userId });
    if (!influencer) {
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: INFLUENCER_CONSTANTS.INFLUENCER_NOT_FOUND } });
    }
    influencer.isCouponAssigned = true;
    influencer.code = req.body.code.toLowerCase();
    await influencer.save();
    coupon.userId = req.body.userId;
  } else {
    coupon.userId = req.jwtData.userId;
  }
  if (req.jwtData.role === "vendor") {
    coupon.vendorType = [req.userData.merchantCategory];
  }
  await coupon.save();
  await createAuditLog("coupon", coupon._id, req.jwtData.userId, req.jwtData.role, "create", coupon, req.userData.email);

  res.send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_SUBMIT_SUCCESS } });
});

router.put("/", identityManager(["admin", "vendor"], { coupon: "W" }), async (req, res) => {
  const { error } = validateCouponPut(req.body);
  if (error) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  let coupon = await Coupon.findById(req.body.couponId);
  if (!coupon) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
  }
  if (req.body.type == "influencerCode") {
    if (req.body.code && req.body.code.toLowerCase() != coupon.code) {
      let couponExist = await Coupon.findOne({ code: req.body.code.toLowerCase() });
      if (couponExist) {
        return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.ALREADY_EXITED } });
      }
      coupon.code = req.body.code.toLowerCase() || coupon.code;
    }
  }
  coupon.description = req.body.description || coupon.description;
  coupon.couponStartTime = req.body.couponStartTime || coupon.couponStartTime;
  coupon.couponEndTime = req.body.couponEndTime || coupon.couponEndTime;
  coupon.perUserLimit = req.body.perUserLimit || coupon.perUserLimit;
  coupon.maxRedemption = req.body.maxRedemption || coupon.maxRedemption;
  coupon.status = req.body.status || coupon.status;
  if (req.body.minOrderPrice == 0) {
    coupon.minOrderPrice = req.body.minOrderPrice;
  } else {
    coupon.minOrderPrice = req.body.minOrderPrice || coupon.minOrderPrice;
  }
  coupon.vendorType = req.body.vendorType || coupon.vendorType;
  // if (req.body.isFirstOrder == true) {
  //   coupon.isFirstOrder = req.body.isFirstOrder;
  // } else {
  //   coupon.isFirstOrder = req.body.isFirstOrder || coupon.isFirstOrder;
  // }
  // if (req.body.isDisabled == true) {
  //   coupon.isDisabled = req.body.isDisabled;
  // } else {
  //   coupon.isDisabled = req.body.isDisabled;
  // }
  if (req.body.hasOwnProperty("isFirstOrder")) {
    coupon.isFirstOrder = req.body.isFirstOrder;
  }
  if (req.body.hasOwnProperty("isDisabled")) {
    coupon.isDisabled = req.body.isDisabled;
  }
  if (req.body.maxDiscountPrice == 0) {
    coupon.maxDiscountPrice = req.body.maxDiscountPrice;
  } else {
    coupon.maxDiscountPrice = req.body.maxDiscountPrice || coupon.maxDiscountPrice;
  }

  await coupon.save();
  await createAuditLog("coupon", coupon._id, req.jwtData.userId, req.jwtData.role, "update", coupon, req.userData.email);
  res.send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_UPDATE_SUCCESS } });
});

router.delete("/:couponId", identityManager(["admin", "vendor"], { coupon: "W" }), async (req, res) => {
  let coupon;
  if (req.jwtData.role == "admin") {
    coupon = await Coupon.findOne({ _id: req.params.couponId });
  } else {
    coupon = await Coupon.findOne({ _id: req.params.couponId, userId: req.jwtData.userId });
  }
  if (!coupon) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
  }
  // var result = await Coupon.updateOne({ _id: req.params.couponId }, { $set: { status: "deleted" } });

  if (coupon.type == "influencerCode") {
    let influencer = await Influencer.findOne({ _id: coupon.userId });

    if (!influencer) {
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: INFLUENCER_CONSTANTS.INFLUENCER_NOT_FOUND } });
    }
    influencer.isCouponAssigned = false;
    influencer.code = "";
    await influencer.save();
  }
  coupon.status = "deleted";
  await coupon.save();
  await createAuditLog("coupon", coupon._id, req.jwtData.userId, req.jwtData.role, "delete", coupon, req.userData.email);

  // if (result.n == 1)
  return res.send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_DELETE_SUCCESS } });
  // else return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
});

router.get("/validate/:code/:amount/:type", identityManager(["user"]), async (req, res) => {
  let coupon = await Coupon.findOne({
    code: req.params.code.toLowerCase(),
    type: req.params.type,
    status: "active",
    isDisabled: false,
  });
  if (!coupon) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
  }
  let cart = await Cart.findOne({ userId: req.jwtData.userId });
  if (!cart) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: CART_CONSTANTS.CART_NOT_FOUND } });
  }
  if (coupon.minOrderPrice > cart.subTotal) {
    let message = COUPON_CONSTANTS.LESSER_SUBTOTAL_AMOUNT + coupon.minOrderPrice;
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: message } });
  }
  if (coupon.perUserLimit != 0) {
    let UserRedemption = await Redemption.find({ userId: req.jwtData.userId, couponId: coupon._id }).count();
    if (UserRedemption >= coupon.perUserLimit) {
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_USER_LIMIT_REACHED } });
    }
  }

  if (coupon.maxRedemption != 0) {
    let TotalRedemption = await Redemption.find({ couponId: coupon._id }).count();
    if (TotalRedemption >= coupon.maxRedemption) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_REDEMPTION_REACHED } });
  }

  let amount = parseFloat(req.params.amount);
  let discountValue = calculateDiscount(amount, coupon.couponType, coupon.value, coupon.maxDiscountPrice);
  console.log("discountValue", discountValue);
  //console.log("Amount: ", amount, "discount: ", discountValue, "VALUE: ", coupon.value);

  // if (discountValue == amount) {
  //   const dateArray = ["2020-03-18", "2020-03-19"];
  //   if (!dateArray.includes(req.query.travelDate)) {
  //     return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_FREE_COUPON } });
  //   }
  // }

  discountValue = parseFloat(parseFloat(discountValue).toFixed(2));
  cart.cartDiscount = discountValue;
  cart.couponCode = coupon.code;
  cart.couponId = coupon._id;
  // let vendor = await Vendor.findOne({ _id: cart.vendorId });
  let vendor = await vendorFareAggregate(cart.vendorId);

  console.log("vendor", vendor);
  let chargeDetails = {
    serviceTax: vendor.serviceTax,
    serviceCharge: vendor.serviceCharge,
    vatCharge: vendor.vatCharge,
  };
  let deliveryCharge = config.get("defaultDeliveryCharges");
  let cartCharges = {};

  amount = cart.subTotal - discountValue - cart.referralDiscount;
  if (amount > 0) {
    // let cartCharges
    console.log("amount,", cart.subTotal, chargeDetails);
    cartCharges = calculateTax(cart.subTotal, chargeDetails);
    console.log("caccacaccacacaccaca", cartCharges);
    cartCharges.deliveryCharge = deliveryCharge;
    cartCharges.platformFees = (vendor.platformFees * cart.subTotal) / 100;
    let location = {};
    location.lat1 = parseFloat(req.query.lat);
    location.lon1 = parseFloat(req.query.lng);
    // cartList[0].totalAmount +=
    // deliveryCharge = await deliveryCharges(location, data.venderDetails.vendorId)
    //
    cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount + cartCharges.platformFees;
    cart.totalAmount += cart.deliveryCharges;
  } else {
    // let cartCharges = {}

    cartCharges.serviceCharge = 0;
    cartCharges.serviceTax = 0;
    cartCharges.vatCharge = 0;
    cart.totalAmount = 0 + cart.deliveryCharges;
    cartCharges.platformFees = 0;
  }
  let response = {};

  if (vendor.packagingCharges) {
    cart.totalAmount += vendor.packagingCharges;
    response.packagingCharges = vendor.packagingCharges;
  }
  await cart.save();
  // let response = {};
  response.subTotal = cart.subTotal;
  response.couponCode = cart.couponCode;
  response.referralDiscount = cart.referralDiscount;

  response.totalAmount = cart.totalAmount;
  response.vendorId = cart.vendorId;
  response.cartId = cart._id;
  response.cartDiscount = cart.cartDiscount;
  response.cartCharges = cartCharges;
  response.couponDescription = coupon.description;
  response.deliveryCharge = deliveryCharge;
  response.couponId = coupon._id;
  response.couponType = coupon.type;
  response.couponValue = coupon.value;
  return res.send({ statusCode: 200, message: "Success", data: { response } });
});

router.get("/verify/:code", identityManager(["admin", "vendor"], { coupon: "W" }), async (req, res) => {
  let coupon = await Coupon.findOne({ code: req.params.code.toLowerCase(), status: "active" });
  if (coupon) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.DUPLICATE_COUPON } });
  } else return res.send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_VALID } });
});
//verify code for user app
router.get("/verifyCode/:code", identityManager(["user"]), async (req, res) => {
  let criteria = {};
  if (req.query.vendorType) {
    criteria.vendorType = { $in: [req.query.vendorType] };
  } else {
    if (req.query.vendorId) {
      let vendor = await Vendor.findOne({ _id: req.query.vendorId });
      if (vendor) {
        criteria.vendorType = { $in: [vendor.merchantCategory] };
      }
    }
  }
  criteria.code = req.params.code.toLowerCase();
  criteria.status = "active";
  criteria.isDisabled = false;
  let orders = await Order.find({ userId: req.jwtData.userId });
  if (orders.length > 0) {
    criteria.isFirstOrder = false;
  }
  let coupon = await Coupon.findOne(criteria);

  if (!coupon) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
  }
  if (coupon.type == "coupon") {
    if (coupon.userId !== req.query.vendorId) {
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
    }
  }
  let cart = await Cart.findOne({ userId: req.jwtData.userId });
  if (!cart) {
    return res.send({ statusCode: 400, message: "Failure", data: { message: CART_CONSTANTS.CART_NOT_FOUND } });
  }
  if (coupon.minOrderPrice > cart.subTotal) {
    let message = COUPON_CONSTANTS.LESSER_SUBTOTAL_AMOUNT + coupon.minOrderPrice;
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: message } });
  }
  if (coupon.perUserLimit != 0) {
    let UserRedemption = await Redemption.find({ userId: req.jwtData.userId, couponId: coupon._id }).count();
    if (UserRedemption >= coupon.perUserLimit) {
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_USER_LIMIT_REACHED } });
    }
  }

  if (coupon.maxRedemption != 0) {
    let TotalRedemption = await Redemption.find({ couponId: coupon._id }).count();
    if (TotalRedemption >= coupon.maxRedemption) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_REDEMPTION_REACHED } });
  }
  let amount = parseFloat(cart.subTotal);
  // let discountValue = 0;
  // if (coupon.couponType == "fixed") {
  //   discountValue = coupon.value;
  // } else if (coupon.couponType == "percentage") {
  //   discountValue = (amount * coupon.value) / 100;
  // }
  let discountValue = calculateDiscount(amount, coupon.couponType, coupon.value, coupon.maxDiscountPrice);

  cart.cartDiscount = discountValue;
  cart.couponCode = coupon.code;
  cart.couponId = coupon._id;
  // let vendor = await Vendor.findOne({ _id: cart.vendorId });
  let vendor = await vendorFareAggregate(cart.vendorId);

  let cartCharges = {};

  let chargeDetails = {
    serviceTax: vendor.serviceTax,
    serviceCharge: vendor.serviceCharge,
    vatCharge: vendor.vatCharge,
  };
  amount = cart.subTotal - cart.cartDiscount - cart.referralDiscount;
  let deliveryCharge = config.get("defaultDeliveryCharges");
  if (amount > 0) {
    // let cartCharges

    cartCharges = calculateTax(amount, chargeDetails);
    console.log("caccacaccacacaccaca", cartCharges);
    cartCharges.deliveryCharge = deliveryCharge;
    let location = {};
    location.lat1 = parseFloat(req.query.lat);
    location.lon1 = parseFloat(req.query.lng);
    // cartList[0].totalAmount +=
    // deliveryCharge = await deliveryCharges(location, data.venderDetails.vendorId)
    //
    cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount;
    cart.totalAmount += cart.deliveryCharges;
  } else {
    // let cartCharges = {}

    cartCharges.serviceCharge = 0;
    cartCharges.serviceTax = 0;
    cartCharges.vatCharge = 0;
    cart.totalAmount = 0 + cart.deliveryCharges;
  }
  let response = {};

  if (vendor.packagingCharges) {
    cart.totalAmount += vendor.packagingCharges;
    response.packagingCharges = vendor.packagingCharges;
  }
  console.log("cartCharges", cartCharges);

  await cart.save();
  console.log("caaaarrrrrrttttttttttt", cart);
  // let response = {};
  response.subTotal = cart.subTotal;
  response.couponCode = cart.couponCode;
  response.referralDiscount = cart.referralDiscount;
  response.totalAmount = cart.totalAmount;
  response.vendorId = cart.vendorId;
  response.cartId = cart._id;
  response.cartDiscount = cart.cartDiscount;
  response.cartCharges = cartCharges;
  response.couponDescription = coupon.description;
  response.deliveryCharge = deliveryCharge;
  response.couponId = coupon._id;
  response.couponType = coupon.type;
  response.couponValue = coupon.value;

  return res.send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_VALID, response } });
});

router.get("/remove/:id", identityManager(["user"]), async (req, res) => {
  let coupon = await Coupon.findOne({ _id: req.params.id });
  if (!coupon) {
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.INVALID_COUPON } });
  }
  let cart = await Cart.findOne({ userId: req.jwtData.userId });
  if (!cart) {
    return res.send({ statusCode: 400, message: "Failure", data: { message: CART_CONSTANTS.CART_NOT_FOUND } });
  }
  cart.couponId = "";
  cart.couponCode = "";
  cart.code = "";

  cart.cartDiscount = 0;

  //console.log("Amount: ", amount, "discount: ", discountValue, "VALUE: ", coupon.value);
  // let vendor = await Vendor.findOne({ _id: cart.vendorId });
  let vendor = await vendorFareAggregate(cart.vendorId);

  let cartCharges = {};
  let chargeDetails = {
    serviceTax: vendor.serviceTax,
    serviceCharge: vendor.serviceCharge,
    vatCharge: vendor.vatCharge,
  };
  let amount = cart.subTotal - cart.cartDiscount - cart.referralDiscount;
  let deliveryCharge = config.get("defaultDeliveryCharges");
  if (amount > 0) {
    // let cartCharges

    cartCharges = calculateTax(amount, chargeDetails);
    console.log("caccacaccacacaccaca", cartCharges);
    cartCharges.deliveryCharge = deliveryCharge;

    cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount;
    cart.totalAmount += cart.deliveryCharges;
  } else {
    // let cartCharges = {}

    cartCharges.serviceCharge = 0;
    cartCharges.serviceTax = 0;
    cartCharges.vatCharge = 0;
    cart.totalAmount = 0 + cart.deliveryCharges;
  }
  console.log("cartCharges", cartCharges);
  let response = {};

  if (vendor.packagingCharges) {
    cart.totalAmount += vendor.packagingCharges;
    response.packagingCharges = vendor.packagingCharges;
  }
  await cart.save();
  console.log("remove Cart caaaarrrrrrttttttttttt", cart);

  response.subTotal = cart.subTotal;
  response.totalAmount = cart.totalAmount;
  response.vendorId = cart.vendorId;
  response.cartId = cart._id;
  response.cartDiscount = cart.cartDiscount;
  response.referralDiscount = cart.referralDiscount;
  response.cartCharges = cartCharges;
  response.couponDescription = coupon.description;
  response.deliveryCharge = deliveryCharge;
  response.couponId = coupon._id;
  response.couponType = coupon.type;
  response.couponValue = coupon.value;
  return res.send({ statusCode: 200, message: "Success", data: { message: coupon.description, response } });
});
router.post("/promoInfluencerReferralInPickUp", identityManager(["user"]), async (req, res) => {
  var { error } = validateAddPromocodeInPickUp(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let criteria = {};
  let referralAmount = 0;
  let discountValue = 0;
  let response = {};

  if (req.body.couponCode) {
    criteria.code = req.body.couponCode.toLowerCase();
    criteria.$or = [{ type: "promocode" }, { type: "influencerCode" }];
    criteria.isDisabled = false;
    criteria.vendorType = { $in: ["delivery"] };

    let coupon = await Coupon.findOne(criteria);
    if (!coupon) {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: COUPON_CONSTANTS.INVALID_COUPON },
      });
    }
    console.log("loggg", coupon);

    if (coupon.minOrderPrice > req.body.deliveryCharges) {
      let message = COUPON_CONSTANTS.LESSER_SUBTOTAL_AMOUNT + coupon.minOrderPrice;
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: message } });
    }
    if (coupon.perUserLimit != 0) {
      let UserRedemption = await Redemption.find({ userId: req.jwtData.userId, couponId: coupon._id }).count();
      if (UserRedemption >= coupon.perUserLimit) {
        return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_USER_LIMIT_REACHED } });
      }
    }
    // let criteria = {};
    // criteria.serviceType = "pickUpAndDrop";
    if (coupon.maxRedemption != 0) {
      let TotalRedemption = await Redemption.find({ couponId: coupon._id }).count();
      if (TotalRedemption >= coupon.maxRedemption) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_REDEMPTION_REACHED } });
    }

    discountValue = calculateDiscount(req.body.deliveryCharges, coupon.couponType, coupon.value, coupon.maxDiscountPrice);
    response.couponId = coupon._id;
    response.couponValue = coupon.value;
    response.couponType = coupon.couponType;
    response.couponCode = coupon.code;
    response.maxDiscountPrice = coupon.maxDiscountPrice;
  }
  let criteria1 = {};
  criteria1.serviceType = "pickUpAndDrop";
  let location = {
    lat1: req.body.lat1,
    lon1: req.body.lon1,
  };

  let data = await isPickUpPossible(location.lon1, location.lat1, criteria1);
  console.log("dataaaaa", data);
  let chargeDetails = await FeeAndLimit.findOne({ cityId: data.cityId, type: "pickUpDrop" }, { serviceTax: 1, vatCharge: 1 }).lean();
  if (req.body.isReferralApplied) {
    let referralCount = await Referral.countDocuments({ userId: req.jwtData.userId, status: "active" });
    if (referralCount > 0) referralAmount = config.get("referralCodeAmount");
  }

  let amount = req.body.deliveryCharges - discountValue - referralAmount;
  let taxes = calculateTax(amount, chargeDetails, "pickUp");

  response.referralDiscount = referralAmount;
  response.discount = discountValue;
  // response.chargeDetails = chargeDetails;
  response.taxes = taxes;
  response.totalAmount = req.body.deliveryCharges - discountValue - referralAmount + taxes.serviceTax + taxes.vatCharge;

  return res.status(200).send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_SUBMIT_SUCCESS, response } });
});

// router.post("/promocodeInPickUp", identityManager(["user"]), async (req, res) => {
//   var { error } = validateAddPromocodeInPickUp(req.body);
//   if (error)
//     return res.status(400).send({
//       apiId: req.apiId,
//       statusCode: 400,
//       message: "Failure",
//       data: { message: error.details[0].message },
//     });
//   let coupon = await Coupon.findOne({ code: req.body.couponCode.toLowerCase(), type: "promocode" });
//   if (!coupon) {
//     return res.status(400).send({
//       apiId: req.apiId,
//       statusCode: 400,
//       message: "Failure",
//       data: { message: COUPON_CONSTANTS.INVALID_COUPON },
//     });
//   }
//   if (coupon.minOrderPrice > req.body.deliveryCharges) {
//     let message = COUPON_CONSTANTS.LESSER_SUBTOTAL_AMOUNT + coupon.minOrderPrice;
//     return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: message } });
//   }
//   if (coupon.perUserLimit != 0) {
//     let UserRedemption = await Redemption.find({ userId: req.jwtData.userId, couponId: coupon._id }).count();
//     if (UserRedemption >= coupon.perUserLimit) {
//       return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_USER_LIMIT_REACHED } });
//     }
//   }
//   // let criteria = {};
//   // criteria.serviceType = "pickUpAndDrop";
//   if (coupon.maxRedemption != 0) {
//     let TotalRedemption = await Redemption.find({ couponId: coupon._id }).count();
//     if (TotalRedemption >= coupon.maxRedemption) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: COUPON_CONSTANTS.MAX_REDEMPTION_REACHED } });
//   }

//   let discountValue = calculateDiscount(req.body.deliveryCharges, coupon.couponType, coupon.value, coupon.maxDiscountPrice);
//   let response = {};
//   let criteria1 = {};
//   criteria1.serviceType = "pickUpAndDrop";
//   let location = {
//     lat1: req.body.lat1,
//     lon1: req.body.lon1,
//   };

//   let data = await isPickUpPossible(location.lon1, location.lat1, criteria1);
//   console.log("dataaaaa", data);
//   let chargeDetails = await FeeAndLimit.findOne({ cityId: data.cityId, type: "pickUpDrop" }, { serviceTax: 1, vatCharge: 1 }).lean();
//   let amount = req.body.deliveryCharges - discountValue;
//   let taxes = calculateTax(amount, chargeDetails, "pickUp");
//   response.discount = discountValue;
//   response.couponId = coupon._id;
//   response.couponValue = coupon.value;
//   response.couponType = coupon.couponType;
//   response.couponCode = coupon.code;
//   response.maxDiscountPrice = coupon.maxDiscountPrice;
//   // response.chargeDetails = chargeDetails;
//   response.taxes = taxes;
//   response.totalAmount = req.body.deliveryCharges - discountValue + taxes.serviceTax + taxes.vatCharge;

//   return res.status(200).send({ statusCode: 200, message: "Success", data: { message: COUPON_CONSTANTS.COUPON_SUBMIT_SUCCESS, response } });
// });

module.exports = router;
