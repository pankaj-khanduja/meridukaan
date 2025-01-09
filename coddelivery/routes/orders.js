const express = require("express");
const {
  DRIVER_CONSTANTS,
  ORDER_CONSTANTS,
  AUTH_CONSTANTS,
  OTP_CONSTANTS,
  PAYMENT_CONSTANTS,
  OTHER_CONSTANTS,
  CARD_CONSTANTS,
  REFERRAl_CONSTANTS,
  COUPON_CONSTANTS
} = require("../config/constant.js");
const _ = require("lodash");
const { DriverAdminLogs } = require("../models/transactionLog.js");
const { createTransaction, chargeWithToken, captureTransaction, voidTransaction } = require("../services/flutterWave");
const { Activity } = require("../models/activity");
const { deliveryCharges, calculateTax } = require("../services/cartCharges");
const config = require("config");
const router = express.Router();
const mongoose = require("mongoose");
const { getDistance } = require("geolib");
const geolib = require("geolib");
const { Influencer } = require("../models/influencer");
const { DriverCancelOrder } = require("../models/driverCancelOrder");
const { sendFCM } = require("../services/fcmModule");
const moment = require("moment-timezone");
const {
  Order,
  isDriverAvailable,
  validateAcceptReject,
  validatePayDeliveryTip,
  validateOrderStatusUpdate,
  validateOrderAcceptRejectVendor,
  validateDeliveryPic,
  validatePlacePickUpDrop,
  validateDeliveryLocation,
  validateCancelDriver,
  validateReturnOrder
} = require("../models/order");
const { Driver } = require("../models/driver");
const { User } = require("../models/user");
const { OrderNo } = require("../models/orderNo");
const { Vendor } = require("../models/vendor");
const { CartItem } = require("../models/cart");
const { identityManager } = require("../middleware/auth");
const { OrderNotificationSent } = require("../models/orderNotificationSent.js");
const { FeeAndLimit, feeLimitLookUp } = require("../models/feeAndLimit.js");
const { isPickUpPossible } = require("../models/serviceArea");
// const { isDeliveryPoss } = require("../models/order");
// const { UserInstance } = require("twilio/lib/rest/chat/v1/service/user");
const { Card } = require("../models/card");
const { Redemption } = require("../models/redemption.js");
const { Coupon } = require("../models/coupon");
const { Referral } = require("../models/referral.js");
const pdfService = require("../services/pdfGenerate");
const { TestOrder } = require("../models/testOrder")
const { PaymentLog } = require("../models/paymentLogs");
const { createPaymentLink } = require("../services/razorPayFunctions.js");

router.post("/calculateDeliveryCharges", identityManager(["user", "public"]), async (req, res) => {
  const { error } = validateDeliveryLocation(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let location = {};
  location.lat1 = parseFloat(req.body.lat1);
  location.lon1 = parseFloat(req.body.lon1);
  location.lat2 = parseFloat(req.body.lat2);
  location.lon2 = parseFloat(req.body.lon2);
  let deliveryCharge = await deliveryCharges(location, "pickUp");
  if (!deliveryCharge) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.NOT_SERVING }
    });
  }
  let taxesPercent = {};

  console.log("deliveryCharge.distance", deliveryCharge);
  if (deliveryCharge.distance > deliveryCharge.adminCharges.deliveryRadius) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.DELIVERY_NOT_POSSIBLE }
    });
  }
  taxesPercent.serviceTax = deliveryCharge.adminCharges.serviceTax;
  taxesPercent.vatCharge = deliveryCharge.adminCharges.vatCharge;

  let taxes = await calculateTax(deliveryCharge.deliveryCharges, taxesPercent, "pickUp");
  let referralCount = 0;
  if (req.jwtData.role == "user") {
    referralCount = await Referral.countDocuments({ userId: req.jwtData.userId, status: "active" });
  }
  let response = {};
  response.deliveryCharges = deliveryCharge.deliveryCharges;
  response.taxes = taxes;
  response.taxesPercent = taxesPercent;
  response.distance = deliveryCharge.distance;
  response.waitingTimeFarePerMin = deliveryCharge.adminCharges.waitingTimeFarePerMin;
  response.driverCommissionPercent = 100 - deliveryCharge.adminCharges.driverPlatformFeePercent;
  response.rideTimeFarePerMin = deliveryCharge.adminCharges.rideTimeFarePerMin;
  response.baseFare = deliveryCharge.adminCharges.baseFare;
  response.referralCount = referralCount;

  response.deliveryFare = response.baseFare + deliveryCharge.exceededDeliveryFare;
  response.exceededDeliveryCharges = deliveryCharge.exceededDeliveryFare;
  // response.baseFare = deliveryCharge.adminCharges.baseFare;
  response.totalAmount = deliveryCharge.deliveryCharges + taxes.serviceTax + taxes.vatCharge;
  response.exceededDeliveryChargesPerKm = deliveryCharge.adminCharges.exceededDeliveryChargesPerKm;

  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response }
  });
});
router.post("/pickUpDrop", identityManager(["user"]), async (req, res) => {
  const { error } = validatePlacePickUpDrop(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let coupon;
  let referral;
  if (req.body.details.referralDiscount > 0) {
    referral = await Referral.findOne({ userId: req.jwtData.userId, status: "active" });
    if (!referral) {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: REFERRAl_CONSTANTS.NO_REFERRAL_AVAILABLE }
      });
    }
  }
  if (req.body.details.couponId && req.body.details.couponId != "") {
    coupon = await Coupon.findOne({ _id: req.body.details.couponId });
    if (!coupon) {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: COUPON_CONSTANTS.INVALID_COUPON }
      });
    }

    if (coupon && coupon.status === "expired") {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: COUPON_CONSTANTS.EXPIRED_COUPON }
      });
    }
  }
  let userId = req.jwtData.userId;
  let criteria = {};
  criteria.serviceType = "pickUpAndDrop";
  let location = {
    lon1: req.body.details.pickUpLocation[0],
    lat1: req.body.details.pickUpLocation[1]
  };
  let data = await isPickUpPossible(location.lon1, location.lat1, criteria);
  if (!data) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.NOT_SERVING }
    });
  }
  let isDeliveryPoss = await isDriverAvailable(data.cityId, "pickUpDrop");
  if (!isDeliveryPoss) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.DELIVERY_NOT_POSSIBLE_ON_THIS_TIME }
    });
  }
  let fee = await FeeAndLimit.findOne({ type: "pickUpDrop", cityId: data.cityId });
  let order = new Order(
    _.pick(req.body, [
      "deliveryCharges",
      "deliveryFare",

      "deliveryInstructions",
      "cardDetails",
      // "driverAmount",
      "countryCode",
      "address",
      "deliveryTip",
      "deliveryTime",
      "details",
      "paymentType",
      "taxes",
      "taxesPercent",
      "cardDetails",
      "otherDeliveryDetails",
      "appType"
    ])
  );
  order.userId = userId;
  order.name = req.userData.firstName;
  order.mobile = req.userData.mobile;
  order.countryCode = req.userData.countryCode;
  order.cityId = data.cityId;
  order.vehicleType = req.body.vehicleType.toLowerCase();
  order.baseFare = req.body.details.baseFare;
  // order.name = req.userData.firstName + req.userData.lastName;
  order.driverAmount = req.body.deliveryCharges * ((100 - fee.driverPlatformFeePercent) / 100);
  order.initialWaiveShare = req.body.deliveryCharges - order.driverAmount;
  console.log(
    "uuuuu",
    req.body.deliveryCharges,
    order.driverAmount,
    req.body.details.discount,
    req.body.details.referralDiscount
  );
  order.adminDeliveryAmount =
    req.body.deliveryCharges -
    order.driverAmount -
    (req.body.details.discount || 0) -
    (req.body.details.referralDiscount || 0);

  order.adminAmount = order.adminDeliveryAmount;
  order.driverCommissionPercent = 100 - fee.driverPlatformFeePercent;
  order.totalAmount =
    req.body.deliveryCharges +
    req.body.taxes.serviceTax +
    req.body.taxes.vatCharge -
    (req.body.details.discount || 0) -
    (req.body.details.referralDiscount || 0);
  if (req.body.details.couponId && req.body.details.couponId != "") {
    order.couponType = coupon.type;
  }
  if (coupon && coupon.type == "influencerCode") {
    order.influencerId = coupon.userId;
    order.isInfluencerSharePaid = false;
    let influencer = await Influencer.findOne({ _id: coupon.userId });
    if (influencer.paymentType == "fixed") {
      order.influencerAmount = influencer.paymentValue;
    } else {
      order.influencerAmount = order.initialWaiveShare * (influencer.paymentValue / 100);
    }
    order.influencerDetails.paymentType = influencer.paymentType;
    order.influencerDetails.paymentValue = influencer.paymentValue;

    order.adminAmount = order.adminDeliveryAmount + order.adminSubtotalAmount - order.influencerAmount;
  }
  let currentTime = Math.round(new Date() / 1000);

  // if (req.body.deliveryTime <= currentTime) {
  //   order.orderStatus = "UNASSIGNED";
  // } else {
  //   order.orderStatus = "PENDING";
  // }

  if (req.body.paymentType === "POD") {
    if (req.body.details.deliveryTime <= currentTime) {
      order.orderStatus = "ACCEPTED";
    } else {
      order.orderStatus = "UPCOMING";
    }
    order.codAmountToPay = order.totalAmount;
  } else if (req.body.paymentType === "card") {
    let card = await Card.findOne({ cardToken: req.body.cardToken });
    if (!card)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: CARD_CONSTANTS.INVALID_CARD }
      });
    // console.log("Amounttttt", order.totalAmount);
    let chargeObject = {
      token: req.body.cardToken,
      narration: config.get("narration"),
      tx_ref: order._id.toString(),
      amount: order.totalAmount * 1.5,
      currency: config.get("currency"),
      country: config.get("country"),
      email: card.email || config.get("dummyEmail"),
      phonenumber: req.userData.mobile,
      first_name: req.userData.firstName,
      last_name: req.userData.lastName,
      preauthorize: true
      // usesecureauth: true,
    };
    let response = await chargeWithToken(chargeObject);
    console.log("responsssseeee", response);
    let paymentLog = new PaymentLog();
    paymentLog.userId = req.jwtData.userId;
    paymentLog.type = "chargeWithToken";
    paymentLog.paymentType = "pickUpDrop";

    if (response.statusCode !== 200) {
      paymentLog.data = response.data.response.data;
      await paymentLog.save();

      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      });
    }
    else {
      if (response.data.status != "success")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        });
      else {
        if (req.body.details.deliveryTime <= currentTime) {
          order.orderStatus = "ACCEPTED";
        } else {
          order.orderStatus = "UPCOMING";
        }
        order.isOrderAmtPaidToAdmin = true;
        order.flutterwaveRef = response.data.data.flw_ref;
        order.flutterwaveId = response.data.data.id;
        order.cardId = card._id;
        order.cardDetails = response.data.data.card;
        let data = {
          type: "orderPlaced"
        };
        // if (user && user.deviceToken != "") {
        //   await sendFCM(user.deviceToken, data, "orderPlaced");
        // }
        paymentLog.data = response;
        await paymentLog.save();
      }
    }
  }

  if (req.body.details.couponId && req.body.details.couponId != "") {
    let redemption = await Redemption.insertMany([{ userId: req.jwtData.userId, couponId: req.body.details.couponId }]);
  }
  let result = await OrderNo.findOneAndUpdate({}, { $inc: { orderNo: 1 } }, { new: true });
  console.log(result);
  order.orderNo = result.orderNo;
  order.vendorCategory = "pickUpAndDrop";
  if (req.body.details.referralDiscount || req.body.details.referralDiscount > 0) {
    // referral = await Referral.findOne({ userId: req.jwtData.userId, status: "active" });
    order.referralId = referral._id.toString();
    referral.status = "redeemed";
    await referral.save();
  }
  order.email = req.userData.email;
  await order.save();

  order.orderId = order._id;
  console.log("orderrrrr", order);
  let response = _.pick(order, [
    "orderId",
    "orderNo",
    "location",
    "vendorCategory",
    "vendorLocation",
    "orderStatus",
    "paymentUrl",
    "driverRatedByUser",
    "mobile",
    "email",
    "rideTimeMin",
    "rideTimeFare",
    "waitingTimeinMin",
    "waitingTimeFare",
    "baseFare",
    "deliveryFare",
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
    "vehicleType",
    "cardDetails",
    "baseFare",
    "exceededDistanceFare"
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Order created successfully", response }
  });
});
router.post("/returnOrder", identityManager(["admin"], { order: "W" }), async (req, res) => {
  const { error } = validateReturnOrder(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let order = await Order.findOne({ _id: req.body.orderId });
  console.log("orderu", order);
  if (!order) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }
  console.log("orderStatus", order.orderStatus);
  if (order.orderStatus == "RETURN_IN_PROGRESS" || order.orderStatus == "RETURNED") {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ALREADY_MARKED_FOR_RETURN }
    });
  }

  let userId = order.userId;
  // req.body.deliveryCharges = req.body.deliveryFare;

  let details = {
    senderName: order.details.recipientName,
    orderType: "normal",
    senderMobile: order.details.recipientMobile,
    senderEmail: order.details.recipientEmail,

    senderCountryCode: order.details.recipientCountryCode,
    recipientName: order.details.senderName,
    recipientMobile: order.details.senderMobile,
    recipientEmail: order.details.senderEmail,
    recipientCountryCode: order.details.senderCountryCode,
    itemPicture: order.details.itemPicture,
    pickUpLocation: order.details.dropLocation,
    pickUpAddress: order.details.dropAddress,
    dropLocation: order.details.pickUpLocation,
    dropAddress: order.details.pickUpAddress,

    otherDeliveryDetails: order.details.otherDeliveryDetails,
    weight: order.details.weight,
    isFragile: order.details.isFragile,
    productCategory: order.details.productCategory,
    distance: order.details.distance,
    exceededDeliveryCharges: order.details.exceededDeliveryCharges,
    baseFare: order.details.baseFare
  };
  // let fee = await FeeAndLimit.findOne({ type: "pickUpDrop", cityId: order.cityId });
  // let taxesPercent = {
  //   serviceTax: fee.serviceTax,
  //   vatCharge: fee.vatCharge,
  // };
  let taxes = await calculateTax(order.deliveryFare, order.taxesPercent, "pickUp");
  req.body.taxes = taxes;
  // let criteria = {};
  // criteria.serviceType = "pickUpAndDrop";
  // let location = {
  //   lon1: req.body.details.pickUpLocation[0],
  //   lat1: req.body.details.pickUpLocation[1],
  // };
  // let data = await isPickUpPossible(location.lon1, location.lat1, criteria);
  // if (!data) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: OTHER_CONSTANTS.NOT_SERVING },
  //   });
  // }
  // let isDeliveryPoss = await isDriverAvailable(data.cityId, "pickUpDrop");
  // if (!isDeliveryPoss) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: OTHER_CONSTANTS.DELIVERY_NOT_POSSIBLE_ON_THIS_TIME },
  //   });
  // }
  console.log("order", taxes);
  let returnOrder = new Order(
    {}
    // _.pick(req.body, [
    //   "deliveryCharges",
    //   "deliveryFare",

    //   "deliveryInstructions",
    //   "cardDetails",
    //   // "driverAmount",
    //   "countryCode",
    //   "address",

    //   // "deliveryTime",
    //   "details",
    //   "paymentType",
    //   "taxes",
    //   "taxesPercent",
    //   "cardDetails",
    // ])
  );
  returnOrder.details = details;
  returnOrder.deliveryCharges = order.deliveryFare;
  returnOrder.deliveryFare = order.deliveryFare;
  returnOrder.deliveryInstructions = order.deliveryInstructions;
  returnOrder.cardDetails = order.cardDetails;
  returnOrder.countryCode = order.countryCode;
  returnOrder.paymentType = order.paymentType;
  returnOrder.taxes = taxes;
  returnOrder.taxesPercent = order.taxesPercent;
  returnOrder.cardDetails = order.cardDetails;
  returnOrder.appType = order.appType;
  returnOrder.isReturnOrder = true;
  returnOrder.orderStatus = "PICKEDUP";
  returnOrder.arrivedPickUpAt = Math.round(new Date() / 1000);
  returnOrder.pickedUpTime = Math.round(new Date() / 1000);
  returnOrder.userId = userId;
  returnOrder.name = order.name;
  returnOrder.mobile = order.mobile;
  returnOrder.countryCode = order.countryCode;
  returnOrder.cityId = order.cityId;
  returnOrder.vehicleType = order.vehicleType;
  returnOrder.baseFare = order.details.baseFare;

  // console.log("req.body.deliveryCharges", req.body.deliveryCharges, order.driverCommissionPercent);
  returnOrder.driverAmount = returnOrder.deliveryCharges * (order.driverCommissionPercent / 100);
  returnOrder.initialWaiveShare = returnOrder.deliveryCharges - order.driverAmount;

  returnOrder.adminDeliveryAmount = returnOrder.deliveryCharges - order.driverAmount;

  returnOrder.driverCommissionPercent = order.driverCommissionPercent;

  returnOrder.totalAmount = returnOrder.deliveryCharges + returnOrder.taxes.serviceTax + returnOrder.taxes.vatCharge;
  // - (req.body.details.discount || 0) - (req.body.details.referralDiscount || 0);

  // if (coupon && coupon.type == "influencerCode") {
  //   order.influencerId = coupon.userId;
  //   order.isInfluencerSharePaid = false;
  //   let influencer = await Influencer.findOne({ _id: coupon.userId });
  //   if (influencer.paymentType == "fixed") {
  //     order.influencerAmount = influencer.paymentValue;
  //   } else {
  //     order.influencerAmount = order.initialWaiveShare * (influencer.paymentValue / 100);
  //   }
  //   order.influencerDetails.paymentType = influencer.paymentType;
  //   order.influencerDetails.paymentValue = influencer.paymentValue;
  //   order.adminAmount = order.adminDeliveryAmount + order.adminSubtotalAmount - order.influencerAmount;
  // }
  let currentTime = Math.round(new Date() / 1000);

  if (returnOrder.paymentType === "POD") {
    // if (req.body.details.deliveryTime <= currentTime) {
    //   returnOrder.orderStatus = "ACCEPTED";
    // } else {
    //   returnOrder.orderStatus = "UPCOMING";
    // }
  } else if (returnOrder.paymentType === "card") {
    let card = await Card.findOne({ _id: order.cardId });
    if (!card)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: CARD_CONSTANTS.INVALID_CARD }
      });

    let chargeObject = {
      token: card.cardToken,
      narration: config.get("narration"),
      tx_ref: returnOrder._id.toString(),
      amount: returnOrder.totalAmount * 1.5,
      currency: config.get("currency"),
      country: config.get("country"),
      email: card.email || config.get("dummyEmail"),
      phonenumber: returnOrder.mobile,
      first_name: returnOrder.name,
      last_name: returnOrder.name,
      preauthorize: true
      // usesecureauth: true,
    };
    let response = await chargeWithToken(chargeObject);
    console.log("responsssseeee", response);
    if (response.statusCode !== 200)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      });
    else {
      if (response.data.status != "success")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        });
      else {
        // if (req.body.details.deliveryTime <= currentTime) {
        //   returnOrder.orderStatus = "ACCEPTED";
        // } else {
        //   returnOrder.orderStatus = "UPCOMING";
        // }
        returnOrder.isOrderAmtPaidToAdmin = true;
        returnOrder.flutterwaveRef = response.data.data.flw_ref;
        returnOrder.flutterwaveId = response.data.data.id;

        returnOrder.cardDetails = response.data.data.card;
        let data = {
          type: "returnOrderPlaced"
        };
        // if (user && user.deviceToken != "") {
        //   await sendFCM(user.deviceToken, data, "orderPlaced");
        // }
      }
    }
  }

  // if (req.body.details.couponId && req.body.details.couponId != "") {
  //   let redemption = await Redemption.insertMany([{ userId: req.jwtData.userId, couponId: req.body.details.couponId }]);
  // }
  let result = await OrderNo.findOneAndUpdate({}, { $inc: { orderNo: 1 } }, { new: true });
  console.log(result);
  returnOrder.orderNo = order.orderNo + "R";
  returnOrder.vendorCategory = "pickUpAndDrop";
  // if (req.body.details.referralDiscount || req.body.details.referralDiscount > 0) {
  //   // referral = await Referral.findOne({ userId: req.jwtData.userId, status: "active" });
  //   order.referralId = referral._id.toString();
  //   referral.status = "redeemed";
  //   await referral.save();
  // }
  returnOrder.email = returnOrder.email;
  order.orderStatus = "RETURN_IN_PROGRESS";
  if (req.body.returnReason) {
    order.returnReason = req.body.returnReason;
  }
  order.childOrderId = returnOrder._id.toString();
  order.returnOrderFare = returnOrder.totalAmount;
  returnOrder.parentOrderId = order._id.toString();
  returnOrder.parentOrderAmount = order.totalAmount;
  returnOrder.driverId = order.driverId;

  console.log("returnOrder check :", returnOrder);
  await order.save();
  await returnOrder.save();
  returnOrder.orderId = order._id;

  // console.log("orderrrrr", order);
  let response = _.pick(returnOrder, [
    "orderId",
    "orderNo",
    "location",
    "vendorCategory",
    "vendorLocation",
    "orderStatus",
    "paymentUrl",
    "driverRatedByUser",
    "mobile",
    "email",
    "rideTimeMin",
    "rideTimeFare",
    "waitingTimeinMin",
    "waitingTimeFare",
    "baseFare",
    "deliveryFare",
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
    "vehicleType",
    "cardDetails",
    "baseFare",
    "exceededDistanceFare",
    "parentOrderAmount"
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Order created successfully", response }
  });
  let user = await User.findOne({ _id: order.userId });
  let data = {
    orderId: order._id.toString(),
    orderNo: order.orderNo.toString(),
    returnOrderId: returnOrder._id.toString(),

    type: "returnOrder"
  };
  if (user && user.deviceToken != "") {
    await sendFCM(user.deviceToken, data, "returnOrder");
  }
  let driver = await Driver.findOne({ _id: order.driverId });
  if (driver && driver.deviceToken != "") {
    await sendFCM(driver.deviceToken, data, "returnOrder");
  }
});
router.post("/deliveryTip", identityManager(["user"]), async (req, res) => {
  const { error } = validatePayDeliveryTip(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let order = await Order.findOne({ _id: req.body.orderId, userId: req.jwtData.userId });
  if (!order)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  let driver = await Driver.findOne({ _id: order.driverId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.INVALID_DRIVER }
    });
  console.log("driversssssssdasfsfasfasfasf", driver);
  console.log("userDatataaa", req.userData, req.jwtData);
  let result = await OrderNo.findOne();
  let log = new DriverAdminLogs({});
  log.userId = req.jwtData.userId;
  log.paidBy = "user";
  log.paidTo = "driver";
  log.paymentAmount = req.body.deliveryTip;
  log.paymentType = req.body.paymentType;
  log.type = "tipPayment";
  log.status = "pending";
  log.otherDetails = { userId: order.driverId };

  if (req.body.paymentType === "card") {
    let card = await Card.findOne({ cardToken: req.body.cardToken });

    // console.log("Amounttttt", order.totalAmount);
    let chargeObject = {
      token: req.body.cardToken,
      narration: config.get("narration"),
      tx_ref: order.orderNo + "." + log._id.toString(),
      amount: req.body.deliveryTip,
      currency: config.get("currency"),
      country: config.get("country"),
      email: card.email || req.userData || config.get("dummyEmail"),
      phonenumber: req.userData.mobile,
      first_name: req.userData.firstName,
      last_name: req.userData.lastName,
      subaccounts: [
        {
          id: driver.subaccountId,
          transaction_split_ratio: "10",

          transaction_charge: 0,
          transaction_charge_type: "flat"
        }
      ]
    };
    let response = await chargeWithToken(chargeObject);

    let paymentLog = new PaymentLog();
    paymentLog.userId = req.jwtData.userId;
    paymentLog.type = "chargeWithToken";
    paymentLog.paymentType = "deliveryTip";

    if (response.statusCode !== 200) {
      paymentLog.data = response.data.response.data;
      await paymentLog.save();

      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      });
    }
    else {
      if (response.data.data.status != "successful")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        });
      else {
        order.deliveryTip = req.body.deliveryTip;
        order.tipFlutterwaveRef = response.data.data.flw_ref;
        order.tipCardDetails = response.data.data.card;
        log.status = "success";
        let activity = new Activity({});
        activity.userId = log.userId;
        activity.data = { amount: log.paymentAmount, userId: log.otherDetails.userId };
        activity.type = "tipPaidByUser";
        await activity.save();
        let data = {
          type: "driverTip",
          userName: req.userData.firstName,
          amount: req.body.deliveryTip.toString()
        };
        await sendFCM(driver.deviceToken, data, "driverTip");

        paymentLog.data = response;
        await paymentLog.save();
      }
    }
  } else {
    let appType = "";
    if (req.body.appType && req.body.appType == "web") {
      appType = "web";
    } else {
      appType = "app";
    }
    // creating payload
    // let chargeObject = {
    //   productinfo: 'Delivery tip',
    //   amount: req.body.deliveryTip,
    //   name: req.userData.firstName + req.userData.lastName,
    //   phone: req.userData.mobile,
    //   userId: req.jwtData.userId,
    //   orderId: order._id.toString(),
    //   appType: appType,
    //   email: req.userData.email || config.get("dummyEmail"),
    //   paymentType: 'deliveryTip',
    //   driverId: driver._id.toString()
    // };
    // console.log("chargeOBjeectttt", chargeObject);
    // getting payment URL
    let chargeObject = {
      amount: Number(order.totalAmount.toFixed(2)),
      name: req.userData.firstName,
      email: req.userData.email,
      contact: req.userData.mobile,
      orderId: order._id.toString(),
      orderNo: result.orderNo,
      callback_url: `${config.get("apiBaseURl")}/api/webhook/deliveryTip/app?orderId=${encodeURIComponent(order._id.toString())}?orderNo=${encodeURIComponent(result.orderNo)}?driverAdminLogId=${encodeURIComponent(log._id.toString())}`
    }

    console.log("chargeOBjeectttt", chargeObject);
    let response = await createPaymentLink(chargeObject);

    let paymentLog = new PaymentLog();
    paymentLog.userId = req.jwtData.userId;
    paymentLog.type = "createTransaction";
    paymentLog.paymentType = "deliveryTip";


    console.log("responseeeee", response);
    if (response.statusCode !== 200) {
      paymentLog.data = response.data.response.data;
      await paymentLog.save();

      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      });
    } else {
      if (response.message != "Success")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        });
      else {
        paymentLog.data = response;
        await paymentLog.save();
        order.tipPaymentUrl = response.data.short_url;
      }
    }
  }
  await order.save();
  await log.save();
  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: PAYMENT_CONSTANTS.PAYMENT_SUCCESS, order }
  });
});

router.get("/returnOrder/otp", identityManager(["admin"], { order: "W" }), async (req, res) => {
  let order = await Order.findOne({ parentOrderId: req.query.orderId });
  let response = {};
  response.otp = order.otp;

  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
});

router.get("/", identityManager(["user", "admin", "vendor"], { order: "W" }), async (req, res) => {
  var criteria = {};
  var offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.jwtData.role === "user") criteria.userId = req.jwtData.userId;
  if (req.jwtData.role === "vendor") {
    criteria.vendorId = req.jwtData.userId;
    await Order.updateMany({ vendorId: req.jwtData.userId, isOrderSeen: false }, { $set: { isOrderSeen: true } });
  }
  if (req.query.userId) {
    criteria.userId = req.query.userId;
  }
  if (req.jwtData.role == "admin") {
    if (req.query.vendorId) {
      criteria.vendorId = req.query.vendorId;
    }
  }
  if (req.query.isReturnOrder && req.query.isReturnOrder == "true") {
    criteria.isReturnOrder = true;
  } else {
    criteria.isReturnOrder = false;
  }
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ name: regexName }, { mobile: regexName }];
  }
  if (req.query.vendorCategory == "pickUpAndDrop") {
    criteria.vendorCategory = "pickUpAndDrop";
  } else if (req.query.vendorCategory == "others") {
    criteria.vendorCategory = { $ne: "pickUpAndDrop" };
  }
  // if (req.jwtData.role === "vendor" || "storeManager") {
  //   if (req.query.userId) criteria.userId = req.jwtData.userId;
  // }
  // if (req.query.orderStatus) criteria.orderStatus = req.query.orderStatus.toUpperCase();
  if (req.query.orderStatus) {
    orderStatus = req.query.orderStatus.split(",");
    criteria.orderStatus = { $in: orderStatus };
  } else {
    criteria.orderStatus = { $ne: "PENDING" };
  }
  if (req.query.isRefundPending) criteria.isRefundPending = req.query.isRefundPending === "true" ? true : false;

  if (req.query.paymentType && req.query.paymentType == "online") criteria.paymentType = { $ne: "POD" };

  if (req.query.orderNumber) {
    criteria.orderNo = req.query.orderNumber;
    // console.log("hjgsgdfj", criteria);
  }
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null)
    criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  if (req.query.vendorId) criteria.vendorId = req.query.vendorId;
  if (req.query.orderId) criteria._id = mongoose.Types.ObjectId(req.query.orderId);
  console.log("criteria", criteria);
  let orders = await Order.aggregate([
    { $match: criteria },
    { $sort: { creationDate: -1 } },
    {
      $lookup: {
        from: "ratings",
        let: { orderId: { $toString: "$_id" }, userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$orderId", "$$orderId"] }, { $eq: ["$userId", "$$userId"] }]
              }
            }
          },
          {
            $project: { tag: 1, ratingType: 1, ratingId: "$_id" }
          }
        ],
        as: "ratingData"
      }
    },
    { $addFields: { userId: { $toObjectId: "$userId" }, vendorId: { $toObjectId: "$vendorId" } } },

    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "userData" } },

    {
      $addFields: {
        // name: { $arrayElemAt: ["$userData.name", 0] },
        orderId: "$_id"
        // defaultStore: { $toObjectId: { $arrayElemAt: ["$userData.defaultStore", 0] } },
      }
    },
    {
      $addFields: {
        driverId: {
          $cond: [{ $ne: ["$driverId", ""] }, { $toObjectId: "$driverId" }, "$driverId"]
        }
      }
    },
    { $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" } },
    { $addFields: { driverFirstName: { $arrayElemAt: ["$driverData.firstName", 0] } } },
    { $addFields: { driverId: { $arrayElemAt: ["$driverData._id", 0] } } },

    {
      $addFields: {
        driverLastName: { $arrayElemAt: ["$driverData.lastName", 0] },
        driverMobile: { $arrayElemAt: ["$driverData.mobile", 0] },
        driverTotalRatings: { $arrayElemAt: ["$driverData.totalRating", 0] },
        driverAvgRating: { $arrayElemAt: ["$driverData.avgRating", 0] },
        driverVehicleType: { $arrayElemAt: ["$driverData.vehicleType", 0] },
        driverCurrentLocation: { $arrayElemAt: ["$driverData.location", 0] }
      }
    },
    // { $addFields: { driverMobile: { $arrayElemAt: ["$driverData.mobile", 0] } } },
    // { $addFields: { driverTotalRatings: { $arrayElemAt: ["$driverData.totalRating", 0] } } },
    // { $addFields: { driverAvgRating: { $arrayElemAt: ["$driverData.avgRating", 0] } } },
    // { $addFields: { driverVehicleType: { $arrayElemAt: ["$driverData.vehicleType", 0] } } },

    // { $addFields: { driverCurrentLocation: { $arrayElemAt: ["$driverData.location", 0] } } },
    { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },
    {
      $lookup: feeLimitLookUp("$cityId")
    },
    {
      $addFields: {
        vendorAvgRating: { $arrayElemAt: ["$vendorData.avgRating", 0] },
        // platformFeePercentage: { $arrayElemAt: ["$vendorData.platformFeePercentage", 0] },

        platformFeePercentage: {
          $cond: [
            { $ne: [{ $arrayElemAt: ["$vendorData.isPlatformFee", 0] }, false] },
            { $arrayElemAt: ["$fareData.vendorPlatformFeePercent", 0] },
            { $arrayElemAt: ["$vendorData.platformFeePercentage", 0] }
          ]
        }
      }
    },

    { $skip: offset },
    { $limit: limit },
    {
      $project: {
        userData: 0,
        vendorData: 0,
        driverData: 0,
        requestedDrivers: 0,
        currentDriver: 0,
        _id: 0
      }
    }
  ]);
  let totalCount = await Order.countDocuments(criteria);
  return res.send({
    statusCode: 200,
    message: "Success",
    data: { totalCount, orders }
  });
});

router.get("/invoice", identityManager(["admin"], { order: "W" }), async (req, res) => {
  var criteria = {};
  var criteria1 = {};

  var offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);

  if (req.query.userId) {
    criteria.userId = req.query.userId;
  }
  if (req.jwtData.role == "admin") {
    if (req.query.vendorId) {
      criteria.vendorId = req.query.vendorId;
    }
  }
  if (req.query.text) {
    var terms = req.query.text.split(" ");
    // console.log("terms", terms);
    var regexName = new RegExp(terms[0], "i");
    var regexName1 = new RegExp(terms[1], "i");
    // console.log(terms.length);
    if (terms.length === 1 || terms[1] === "") {
      criteria1 = { $or: [{ driverFirstName: regexName }, { driverLastName: regexName }] }; //1
    } else {
      criteria1 = { $and: [{ driverFirstName: regexName }, { driverLastName: regexName1 }] }; //1
    }
  }

  // if (req.jwtData.role === "vendor" || "storeManager") {
  //   if (req.query.userId) criteria.userId = req.jwtData.userId;
  // }
  // if (req.query.orderStatus) criteria.orderStatus = req.query.orderStatus.toUpperCase();
  if (req.query.orderStatus) {
    orderStatus = req.query.orderStatus.split(",");
    criteria.orderStatus = { $in: orderStatus };
    // console.log("hjgsgdfj", criteria);
  } else {
    criteria.orderStatus = { $ne: "PENDING" };
  }
  if (req.query.vendorCategory == "pickUpAndDrop") {
    criteria.vendorCategory = "pickUpAndDrop";
  } else if (req.query.vendorCategory == "others") {
    criteria.vendorCategory = { $ne: "pickUpAndDrop" };
  }
  if (req.query.orderNumber) {
    criteria.orderNo = req.query.orderNumber;
    // console.log("hjgsgdfj", criteria);
  }
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null)
    criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  if (req.query.vendorId) criteria.vendorId = req.query.vendorId;
  if (req.query.orderId) criteria._id = mongoose.Types.ObjectId(req.query.orderId);
  console.log("criteria", criteria);
  let ordersList = await Order.aggregate([
    {
      $addFields: {
        driverId: {
          $cond: [{ $ne: ["$driverId", ""] }, { $toObjectId: "$driverId" }, "$driverId"]
        }
      }
    },
    { $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" } },
    { $addFields: { driverFirstName: { $arrayElemAt: ["$driverData.firstName", 0] } } },
    { $addFields: { driverLastName: { $arrayElemAt: ["$driverData.lastName", 0] } } },

    { $match: criteria },
    { $match: criteria1 },
    { $sort: { creationDate: -1 } },
    { $addFields: { userId: { $toObjectId: "$userId" }, vendorId: { $toObjectId: "$vendorId" } } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "userData" } },
    { $addFields: { driverId: { $arrayElemAt: ["$driverData._id", 0] } } },
    { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },
    {
      $facet: {
        allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],
        paginatedDocs: [
          { $skip: offset },
          { $limit: limit },
          {
            $project: {
              orderNo: 1,
              orderId: "$_id",
              orderStatus: 1,
              couponType: 1,
              isOrderAmtPaidToAdmin: 1,
              vendorCommissionPercent: 1,
              driverCommissionPercent: 1,
              vendorCategory: 1,
              paymentLinkStatus: 1,
              wasReassignOrderPickedUp: 1,
              isReturnOrder: 1,
              // vendorAddress: 1,
              // deliveryAddress: 1,
              packagingCharges: 1,
              paymentType: 1,
              orderAmount: 1,
              driverAmount: 1,
              adminAmount: 1,
              vendorAmount: 1,
              totalAmount: 1,
              insertDate: 1,
              adminSubtotalAmount: 1,
              adminDeliveryAmount: 1,
              rideTimeMin: 1,
              rideTimeFare: 1,
              waitingTimeinMin: 1,
              waitingTimeFare: 1,
              baseFare: 1,
              deliveryFare: 1,
              deliveryCharges: 1,
              details: 1,
              taxes: 1,
              initialWaiveShare: 1,
              exceededDeliveryChargesPerKm: 1,
              influencerDetails: 1,
              influencerAmount: 1,
              isInfluencerSharePaid: 1,
              driverId: 1,
              deliveryTip: 1,
              userMobile: "$mobile",
              driverFirstName: { $arrayElemAt: ["$driverData.firstName", 0] },
              driverLastName: { $arrayElemAt: ["$driverData.lastName", 0] },
              userFirstName: { $arrayElemAt: ["$userData.firstName", 0] },
              userLastName: { $arrayElemAt: ["$userData.lastName", 0] },
              vendorName: { $arrayElemAt: ["$vendorData.name", 0] },
              invoiceStatus: {
                $cond: [{ $in: ["$orderStatus", ["REJECTED", "CANCELLED"]] }, "failure", "success"]
              },
              _id: 0
            }
          }
        ]
      }
    }
  ]);
  let totalCount = ordersList[0].allDocs.length > 0 ? ordersList[0].allDocs[0].totalCount : 0;
  let orders = ordersList[0].paginatedDocs;
  return res.send({
    statusCode: 200,
    message: "Success",
    data: { totalCount, orders }
  });
});

router.get("/nearByDrivers", identityManager(["admin"], { order: "W" }), async (req, res) => {
  let order = await Order.findOne({ _id: req.query.orderId });
  if (!order) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }

  let criteria = {};

  if (order.rejectedBy.length > 0) {
    driverIds = order.rejectedBy.map((element) => mongoose.Types.ObjectId(element));
    criteria._id = { $nin: driverIds };
  }
  criteria.isAcceptingOrders = true;
  criteria.isFreezed = false;
  criteria.status = "active";
  criteria.pendingOrders = { $lt: config.get("maxOrders") };
  // Not needed for now
  let location;
  if (order.vendorCategory == "pickUpAndDrop") {
    criteria.vehicleType = order.vehicleType;
    criteria.isVendorDriver = { $ne: true };
    criteria.vehicleType = order.vehicleType;
    location = order.details.pickUpLocation;
  } else {
    location = order.vendorLocation.coordinates;
  }
  if (order.vendorCategory != "pickUpAndDrop") {
    criteria.$or = [{ isVendorDriver: { $ne: true } }, { vendorId: { $eq: order.vendorId } }];
  }

  drivers = await Driver.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: location },

        distanceField: "dist.calculated",
        maxDistance: parseInt(config.get("driverMaxDistance")),
        query: criteria,
        includeLocs: "dist.location",
        spherical: true
      }
    },
    { $sort: { dist: 1 } },
    { $limit: config.get("driversLimit") },
    {
      $project: {
        _id: 0,
        driverId: "$_id",
        deviceToken: 1,
        driverFirstName: "$firstName",
        driverLastName: "$lastName",

        driverCurrentLocation: "$location",
        distance: { $round: ["$dist.calculated", 2] }
      }
    }
  ]);

  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { drivers } });
});
router.get("/driverOrders", identityManager(["driver", "vendor"]), async (req, res) => {
  let driverId;
  let criteria = {};
  let criteria1 = {};
  let offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.jwtData.role === "driver") {
    driverId = req.jwtData.userId;
    // criteria.driverId = driverId;
  } else {
    if (req.query.driverId) {
      driverId = req.query.driverId;
      // criteria.driverId = driverId;
    }
  }
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria1.$or = [{ orderNo: regexName }, { driverName: regexName }];
    // { $or: [{ title: regexName }, { brand: regexName }, { category: regexName }, { subCategory: regexName }] };
  }
  criteria.driverId = driverId;
  if (req.query.orderStatus) {
    orderStatus = req.query.orderStatus.split(",");
    criteria.orderStatus = { $in: orderStatus };
    console.log("hjgsgdfj", criteria);
  }
  console.log(criteria,"criteriacriteriacriteriacriteria============")
  let order = await Order.aggregate([
    {
      $match: criteria
    },
    { $addFields: { driverId: { $toObjectId: "$driverId" } } },
    { $addFields: { storeId: { $toObjectId: "$storeId" } } },
    // { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },

    {
      $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" }
    },
    {
      $lookup: { from: "ratings", localField: "orderId", foreignField: "orderId", as: "ratingData" }
    },
    {
      $project: {
        // subTotal: { $sum: "$cartItems.testTotal" },
        cartDiscount: 1,

        // cartId: 1,
        userId: 1,
        orderNo: 1,
        orderId: "$_id",
        totalAmount: 1,
        driverAmount: 1,
        location: 1,
        deliveryCharges: 1,
        deliveryTip: 1,
        wasReassignOrderPickedUp: 1,
        packagingCharges: 1,
        deliveryTime: 1,
        deliveryDateTime: 1,
        deliveredAt: 1,
        platformFees: 1,
        deliveryAddress: 1,
        deliveryInstructions: 1,
        deliveryPic: 1,
        pickedUpTime: 1,
        deliveredAt: 1,
        acceptedAt: 1,
        driverAssignedAt: 1,
        vendorCategory: 1,
        arrivedDropAt: 1,
        countryCode: 1,
        codReceived: 1,
        insertDate: 1,
        driverId: 1,
        isUserVerified: 1,
        pickUpPic: 1,
        rideTimeMin: 1,
        rideTimeFare: 1,
        waitingTimeinMin: 1,
        waitingTimeFare: 1,
        baseFare: 1,
        deliveryFare: 1,
        driverName: { $arrayElemAt: ["$driverData.firstName", 0] },
        driverRatedByUser: { $arrayElemAt: ["$ratingData.rating", 0] },
        licenseImage: { $arrayElemAt: ["$driverData.licenseFrontImage", 0] },
        vehicleRegistrationImage: { $arrayElemAt: ["$driverData.vehicleRegistrationFront", 0] },
        orderStatus: 1,
        vendorName: 1,
        vendorLocation: 1,
        vendorAddress: 1,
        vendorImage: 1,
        name: 1,
        mobile: 1,
        details: 1,
        paymentType: 1,
        taxes: 1,
        taxesPercent: 1,
        cardId: 1,
        cardDetails: 1,
        isRefundPending: 1,
        rejectedBy: 1,
        isArrivedAtPickUp: 1,
        isArrivedAtDrop: 1,

        // "cartItems.isDeleted":1,
        // // storeId:1,
        // "cartItems.items.variantId":
        _id: 0
      }
    },
    { $match: criteria1 },
    { $skip: offset },
    { $limit: limit }
  ]);
  let totalCount = await Order.countDocuments(criteria);

  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, order } });
});
router.get("/unseenOrderCount", identityManager(["vendor"]), async (req, res) => {
  let order = await Order.find({ vendorId: req.jwtData.userId, isOrderSeen: false });
  // let order = await Order.find({ vendorId: req.jwtData.userId, isOrderSeen: false });

  let length = order.length;
  let isUnseenOrders = false;
  if (length > 0) {
    isUnseenOrders = true;
  }
  let response = {};
  response.isUnseenOrders = isUnseenOrders;
  response.length = length;
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
});
router.get("/unassignedOrdersSound", identityManager(["admin"], { order: "W" }), async (req, res) => {
  let order = await Order.find({ isUnassignedSoundNeedsToBeNotified: true });
  // let order = await Order.find({ vendorId: req.jwtData.userId, isOrderSeen: false });

  let length = order.length;
  let isUnassignedSoundNeedsToBeNotified = false;
  if (length > 0) {
    isUnassignedSoundNeedsToBeNotified = true;
  }
  let response = {};
  response.isUnassignedSoundNeedsToBeNotified = isUnassignedSoundNeedsToBeNotified;
  response.length = length;
  await Order.updateMany({}, { $set: { isUnassignedSoundNeedsToBeNotified: false } });
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
});
router.get("/driverDashboard", identityManager(["driver"]), async (req, res) => {
  let criteria = {};
  let criteria1 = {};
  let criteria2 = {};
  criteria.driverId = req.jwtData.userId;
  criteria.orderStatus = "DELIVERED";
  criteria1.isOrderAmtPaidToAdmin = false;

  criteria2.isOrderAmtPaidToDriver = false;
  console.log("criteriA", criteria);
  let orders = await Order.aggregate([
    {
      $facet: {
        allDetails: [
          { $match: criteria },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: "$driverAmount" },
              totalTipCharges: { $sum: "$deliveryTip" }
              // totalDriverAmount:{$sum:["$totalSaleAmount","$totalTipAmount"]}
            }
          }
        ],
        toBePaid: [
          // { $match: criteria },
          // { $match: criteria1 },
          // { $sort: { deliveredAt: 1 } },

          // {
          //   $group: {
          //     _id: null,
          //     toBePaid: { $sum: "$totalAmount" },
          //     deliveredAt: { $first: "$deliveredAt" },
          //   },
          // },
          {
            $lookup: {
              from: "payoutentries",
              let: { driverId: req.jwtData.userId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$userDetails.userId", "$$driverId"] },
                        { $eq: ["$type", "codByDriver"] },
                        { $eq: ["$status", "pending"] }
                      ]
                    }
                  }
                },
                {
                  $group: {
                    _id: null,
                    toBePaid: { $sum: "$accumulatedSum" },

                    payoutIds: { $push: "$_id" },

                    // totalTime: { $sum: "$totalTime" },

                    deliveredAt: { $first: "$insertDate" }
                  }
                }
              ],
              as: "payoutData"
            }
          }
        ],
        toBeReceived: [
          // {
          //   $group: {
          //     _id: null,
          //     toBeReceived: { $sum: "$driverAmount" },
          //   },
          // },
          {
            $lookup: {
              from: "payoutentries",
              let: { driverId: req.jwtData.userId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$userDetails.userId", "$$driverId"] },
                        { $eq: ["$type", "driver"] },
                        { $ne: ["$failureType", "permanent"] },
                        {
                          $not: { $in: ["$status", ["retried", "success"]] }
                        }
                      ]
                    }
                  }
                },
                {
                  $group: {
                    _id: null,
                    toBeReceived: { $sum: "$accumulatedSum" }
                  }
                }
              ],
              as: "earningData"
            }
          }
        ]
      }
    },
    { $addFields: { freezingInHours: config.get("freezingInHours") } },
    {
      $project: {
        orders: 1,
        totalOrders: { $arrayElemAt: ["$allDetails.totalOrders", 0] },
        totalTipCharges: { $arrayElemAt: ["$allDetails.totalTipCharges", 0] },
        totalDriverAmount: { $round: [{ $arrayElemAt: ["$allDetails.totalAmount", 0] }, 1] },
        // toBePaid: { $round: [{ $arrayElemAt: ["$toBePaid.toBePaid", 0] }, 1] },
        // toBePaidDemo: { $arrayElemAt: ["$toBePaid.payoutData", 0] },
        toBePaid: { $first: { $arrayElemAt: ["$toBePaid.payoutData.toBePaid", 0] } },
        deliveredAt: { $first: { $arrayElemAt: ["$toBePaid.payoutData.deliveredAt", 0] } },
        toBeReceived: { $first: { $arrayElemAt: ["$toBeReceived.earningData.toBeReceived", 0] } },

        // toBeReceived: { $round: [{ $arrayElemAt: ["$toBeReceived.toBeReceived", 0] }, 1] },
        freezingInHours: 1
      }
    }
  ]);
  // let driver = await Driver.findOne({ _id: req.jwtData.userId });
  let response = orders[0];
  response.isFreezed = req.userData.isFreezed;
  response.freezeDriverAt = req.userData.freezeDriverAt;
  response.toBeReceived = response.toBeReceived || null;
  response.toBePaid = response.toBePaid || null;

  // console.log("freezingInHours", config.get("freezingInHours"));
  // let totalPrice = orders[0].totalPrice;

  // let totalPrice = orders.totalPrice[0];
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
});
router.get("/driverEarnings", identityManager(["driver"]), async (req, res) => {
  let criteria = {};
  let criteria1 = {};
  let criteria2 = {};
  let criteria3 = {};

  let offset, limit;
  criteria.orderStatus = "DELIVERED";
  criteria1.orderStatus = "DELIVERED";
  criteria3.orderStatus = "DELIVERED";
  criteria1.paymentType = "POD";
  criteria2.$or = [{ paymentType: "paidOnline" }, { paymentType: "card" }];

  if (req.query.paymentType == "POD") {
    criteria.paymentType = "POD";
  } else if (req.query.paymentType == "paidOnline") {
    criteria.$or = [{ paymentType: "paidOnline" }, { paymentType: "card" }];
  }
  criteria1.orderStatus = "DELIVERED";
  criteria3.orderStatus = "DELIVERED";

  // criteria1.paymentType = "POD";
  criteria2.$or = [{ paymentType: "paidOnline" }, { paymentType: "card" }];

  console.log("criteria", criteria);
  // criteria2.orderStatus = "DELIVERED";
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.query.startEpoch && req.query.endEpoch) {
    criteria.deliveredAt = {
      $gte: parseInt(req.query.startEpoch),
      $lte: parseInt(req.query.endEpoch)
    };
    criteria1.deliveredAt = {
      $gte: parseInt(req.query.startEpoch),
      $lte: parseInt(req.query.endEpoch)
    };
    criteria2.deliveredAt = {
      $gte: parseInt(req.query.startEpoch),
      $lte: parseInt(req.query.endEpoch)
    };
    criteria3.deliveredAt = {
      $gte: parseInt(req.query.startEpoch),
      $lte: parseInt(req.query.endEpoch)
    };
  } else {
    let startEpoch = Math.round(new Date().setHours(0, 0, 0, 0) / 1000);
    let endEpoch = Math.round(new Date().setHours(23, 59, 59, 0) / 1000);

    criteria.deliveredAt = {
      $gte: startEpoch,
      $lte: endEpoch
    };
    criteria1.deliveredAt = {
      $gte: startEpoch,
      $lte: endEpoch
    };
    criteria2.deliveredAt = {
      $gte: startEpoch,
      $lte: endEpoch
    };
    criteria3.deliveredAt = {
      $gte: startEpoch,
      $lte: endEpoch
    };
  }
  if (req.jwtData.role === "driver") {
    criteria.driverId = req.jwtData.userId;
    criteria1.driverId = req.jwtData.userId;
    criteria2.driverId = req.jwtData.userId;
    criteria3.driverId = req.jwtData.userId;
  } else criteria.driverId = req.query.driverId;
  console.log("criteria", criteria);
  console.log("criteria1", criteria1);
  console.log("criteria2", criteria2);

  let orders = await Order.aggregate([
    {
      $facet: {
        orders: [
          { $match: criteria },
          { $sort: { deliveredAt: -1 } },
          { $skip: offset },
          { $limit: limit },
          // { $addFields: { driverId: { $toObjectId: "$driverId" } } },
          // { $addFields: { storeId: { $toObjectId: "$storeId" } } },
          // { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },

          // {
          //   $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" },
          // },

          {
            $project: {
              // subTotal: { $sum: "$cartItems.testTotal" },
              cartDiscount: 1,

              // cartId: 1,
              userId: 1,
              orderNo: 1,
              wasReassignOrderPickedUp: 1,
              orderId: "$_id",
              totalAmount: "$totalAmount",
              deliveryCharges: 1,
              deliveryTip: 1,
              deliveryPic: 1,
              driverAmount: 1,
              location: 1,
              deliveryAddress: 1,
              deliveryInstructions: 1,
              driverId: 1,
              pickUpPic: 1,
              rideTimeMin: 1,
              rideTimeFare: 1,
              waitingTimeinMin: 1,
              waitingTimeFare: 1,
              baseFare: 1,
              deliveryFare: 1,
              vendorCategory: 1,
              // driverFirstName: { $arrayElemAt: ["$driverData.firstName", 0] },
              // driverLastName: { $arrayElemAt: ["$driverData.lastName", 0] },
              // driverToAdminAmt: { $arrayElemAt: ["$driverData.driverToAdminAmt", 0] },
              orderStatus: 1,
              deliveryTime: 1,
              deliveryDateTime: 1,
              deliveredAt: 1,
              pickedUpTime: 1,
              vendorName: 1,
              vendorLocation: 1,
              vendorAddress: 1,
              vendorImage: 1,
              name: 1,
              mobile: 1,
              details: 1,
              paymentType: 1,
              taxes: 1,
              packagingCharges: 1,
              // cardId: 1,
              // cardDetails: 1,
              isRefundPending: 1,
              rejectedBy: 1,
              totalPrice: 1,
              isArrivedAtPickUp: 1,
              isArrivedAtDrop: 1,

              // "cartItems.isDeleted":1,
              // // storeId:1,
              // "cartItems.items.variantId":
              _id: 0
            }
          }
        ],

        allDetails: [
          { $match: criteria3 },

          {
            $group: {
              _id: null,
              totalDriverAmount: { $sum: "$driverAmount" }
              // driverToAdminAmt: { $first: { $arrayElemAt: ["$driverData.driverToAdminAmt", 0] } },

              // totalTipCharges: { $sum: "$deliveryTip" },

              // totalDriverAmount:{$sum:["$totalSaleAmount","$totalTipAmount"]}
            }
          }
        ],
        codDetails: [
          { $match: criteria1 },

          {
            $group: {
              _id: null,
              totalDriverAmount: { $sum: "$driverAmount" }
              // driverToAdminAmt: { $first: { $arrayElemAt: ["$driverData.driverToAdminAmt", 0] } },

              // totalTipCharges: { $sum: "$deliveryTip" },

              // totalDriverAmount:{$sum:["$totalSaleAmount","$totalTipAmount"]}
            }
          }
        ],
        cardDetails: [
          { $match: criteria2 },

          {
            $group: {
              _id: null,
              totalDriverAmount: { $sum: "$driverAmount" }

              // driverToAdminAmt: { $first: { $arrayElemAt: ["$driverData.driverToAdminAmt", 0] } },

              // totalTipCharges: { $sum: "$deliveryTip" },

              // totalDriverAmount:{$sum:["$totalSaleAmount","$totalTipAmount"]}
            }
          }
        ]
      }
    },
    {
      $project: {
        orders: 1,
        allDetails: { $arrayElemAt: ["$allDetails", 0] },
        codDetails: { $arrayElemAt: ["$codDetails", 0] },
        cardDetails: { $arrayElemAt: ["$cardDetails", 0] }
      }
    }
  ]);
  let totalCount = await Order.countDocuments(criteria);
  console.log("orderssss", orders);
  let response = orders[0];
  // let totalPrice = orders[0].totalPrice;

  // let totalPrice = orders.totalPrice[0];
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, response } });
});

router.get("/driverWeeklyEarnings", identityManager(["driver", "storeManager", "vendor"]), async (req, res) => {
  let criteria = {};
  criteria.orderStatus = "DELIVERED";
  let offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);

  if (req.jwtData.role == "driver") {
    criteria.driverId = req.jwtData.userId;
  } else {
    criteria.driverId = req.query.driverId;
  }
  let orders = await Order.aggregate([
    {
      $match: criteria
    },

    {
      $group: {
        _id: { week: { $isoWeek: "$deliveredAtDate" }, year: { $year: "$deliveredAtDate" } },
        deliveredAtDate: { $first: "$deliveredAtDate" },
        totalOrders: { $sum: 1 },
        totalDriverAmount: { $sum: "$driverAmount" },
        totalTipCharges: { $sum: "$deliveryTip" }
      }
    }
  ]);
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { orders } });
});

router.get("/driverCurrentRequests", identityManager(["driver"]), async (req, res) => {
  let driverId = req.jwtData.userId;
  let response = await OrderNotificationSent.find({ driverIds: { $in: [driverId] } });
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
});

router.put("/codReceived", identityManager(["driver"]), async (req, res) => {
  let order = await Order.findOne({ _id: req.body.orderId, driverId: req.jwtData.userId });
  if (!order) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }
  order.codReceived = true;
  await order.save();
  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ORDER_CONSTANTS.UPDATED }
  });
});
//accept reject order by vendor
router.put("/acceptReject", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateOrderAcceptRejectVendor(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let order = await Order.findOne({ _id: req.body.orderId, vendorId: req.jwtData.userId, orderStatus: { $in: ["ACTIVE", "ACCEPTED"] } });
  if (!order) {
    return res.send({
      statusCode: 400,
      message: "failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }
  order.orderStatus = req.body.orderStatus;
  if (req.body.orderStatus == "REJECTED") {
    order.rejectedAt = Math.round(new Date() / 1000);
    if (order.paymentType != "POD") {
      order.isRefundPending = true;
    }
    order.rejectedAt = Math.round(new Date() / 1000);

    let referral;
    if (order.referralId && order.referralId != "") {
      referral = await Referral.findOne({ userId: order.userId });
      if (referral) {
        referral.status = "active";
        await referral.save();
      } else {
        referral = await Referral.findOne({ referredByStatus: order.userId });
        if (referral) {
          referral.referredByStatus = "active";
          await referral.save();
          await User.updateOne({ _id: mongoose.Types.ObjectId(order.userId) }, { $inc: { totalReferral: 1 } })
        }
      }
    }





  } else if (req.body.orderStatus == "ACCEPTED") {
    order.acceptedAt = Math.round(new Date() / 1000);
  } else if (req.body.orderStatus === "DELIVERED") {
    order.deliveredAt = Math.round(new Date() / 1000);
    order.deliveredAtDate = new Date();
    if (order.paymentType === "POD") {
      order.codAmountToPay = order.totalAmount;
    }
    order.deliveryDate = moment.tz(config.get("timeZone")).format("YYYY-MM-DD");
  }


  await order.save();
  //to do fcm
  let data = {
    orderId: order._id.toString(),
    orderStatus: order.orderStatus.toString(),
    vendorName: order.vendorName.toString(),
    type: "driverAssigned"
  };
  let user = await User.findOne({ _id: order.userId });

  // if (req.body.orderStatus === "ACCEPTED") {
  // }
  if (user && user.deviceToken != "") {
    if (req.body.orderStatus === "ACCEPTED") {
      await sendFCM(user.deviceToken, data, "orderAccepted");
    } else if (req.body.orderStatus === "REJECTED") {
      await sendFCM(user.deviceToken, data, "orderRejected");
    } else {
      await sendFCM(user.deviceToken, data, "orderMarkedDeliveredByAdmin");
    }
  }
  res.send({
    statusCode: 200,
    message: "Success",
    data: { message: ORDER_CONSTANTS.UPDATED, order }
  });
});
router.put("/cancelOrder", identityManager(["user", "vendor", "admin"], { order: "W" }), async (req, res) => {
  const { error } = validateOrderStatusUpdate(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let order = await Order.findOne({ _id: req.body.orderId });
  if (!order) {
    return res.send({
      statusCode: 400,
      message: "failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }
  if (order.orderStatus === "CANCELLED") {
    return res.status(400).send({
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ALREADY_CANCELED }
    });
  }
  if (req.jwtData.role === "user" && req.jwtData.userId != order.userId) {
    return res.status(400).send({
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.NOT_AUTHORIZED_FOR_CANCELLATION }
    });
  }

  order.orderStatus = "CANCELLED";

  order.cancelledBy.role = req.jwtData.role;
  order.cancelledBy.userId = req.jwtData.userId;

  if (req.body.razorpayPaymentLinkStatus === "failure") {
    order.paymentLinkStatus = "failed"
    order.cancelledBy.role = "System";
  }


  if (req.body.razorpayPaymentLinkStatus != "failure" || (!req.body.razorpayPaymentLinkStatus)) {
    if (order.paymentType != "POD") {
      order.isRefundPending = true;
    }
  }

  order.cancelledAt = Math.round(new Date() / 1000);
  await order.save();
  if (req.jwtData.role == "admin") {
    let user = await User.findOne({ _id: order.userId });
    let data = {
      type: "orderCanceled"
    };
    if (user && user.deviceToken) {
      await sendFCM(user.deviceToken, data, "orderCanceled");
    }
  }
  res.send({
    statusCode: 200,
    message: "Success",
    data: { message: ORDER_CONSTANTS.CANCELED, order }
  });
});
router.put("/unassignedDriver", identityManager(["driver", "admin"], { order: "W" }), async (req, res) => {
  const { error } = validateCancelDriver(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let order = await Order.findOne({ _id: req.body.orderId });
  if (!order) {
    return res.send({
      statusCode: 400,
      message: "failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }
  if (order.orderStatus === "UNASSIGNED") {
    return res.status(400).send({
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ALREADY_UNASSIGNED }
    });
  }
  if (req.jwtData.role === "driver" && req.jwtData.userId != order.driverId && order.orderStatus != "ASSIGNED") {
    return res.status(400).send({
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.NOT_AUTHORIZED_FOR_CANCELLATION }
    });
  }
  if (order.orderStatus == "PICKEDUP") {
    order.wasReassignOrderPickedUp = true;
  }
  await Driver.updateOne({ _id: order.driverId }, { $set: { pendingOrders: 0 } });
  order.orderStatus = "UNASSIGNED";
  // await order.exDriverId.push(order.driverId);
  await order.rejectedBy.push(order.driverId);
  await DriverCancelOrder.insertMany([{ orderId: order._id, driverId: order.driverId }]);

  order.isReassignDriver = true;
  order.driverCancelledAt = Math.round(new Date() / 1000);
  if (req.jwtData.role == "admin") {
    console.log("req.jwtData.role", req.jwtData.role);
    let driver = await Driver.findOne({ _id: order.driverId });
    if (driver && driver.deviceToken != "") {
      data = {
        orderId: order._id.toString(),
        orderStatus: order.orderStatus.toString(),
        // driverName: driver.firstName.toString(),
        // vendorName: order.vendorName.toString(),
        type: "driverUnassigned"
      };
      await sendFCM(driver.deviceToken, data, "driverUnassigned");
    }
  }
  order.driverId = "";

  await order.save();

  res.send({
    statusCode: 200,
    message: "Success",
    data: { message: ORDER_CONSTANTS.UNASSIGNED_SUCCESSFULLY, order }
  });
});
router.put("/acceptRejectOrder", identityManager(["driver", "admin"], { order: "W" }), async (req, res) => {
  const { error } = validateAcceptReject(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let driverId;
  console.log("rolleeeeeeeeeeeeeee");
  if (req.jwtData.role === "driver") {
    driverId = req.jwtData.userId;
  } else {
    driverId = req.body.driverId;
  }
  let order = await Order.findOne({ _id: req.body.orderId });
  if (!order) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND }
    });
  }
  if (order.orderStatus != "ACCEPTED" && req.jwtData.role == "driver") {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.NOT_AVAILABLE }
    });
  }
  if (order.orderStatus != "UNASSIGNED" && req.jwtData.role == "admin") {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.NOT_AVAILABLE }
    });
  }

  let driver = await Driver.findOne({ _id: driverId });
  console.log("drivererrr", driver);
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DRIVER_NOT_FOUND }
    });

  if (driver.pendingOrders == config.get("maxOrders"))
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.MAX_ORDER_LIMIT_REACHED }
    });
  console.log("before");
  if (req.body.isAccepted) {
    order.driverId = driverId;
    console.log("after");
    order.orderStatus = "ASSIGNED";
    order.driverAssignedAt = Math.round(new Date() / 1000);
    order.currentDriver = {};
    driver.pendingOrders += 1;

    await order.save();
    await driver.save();
    order.orderId = order._id;
    // let store = await Store.findOne({ _id: order.storeId })
    // order.storeName = store.storeName
    // order.storeAddress = store.address
    // order.storeImage = store.image
    // order.storeLocation = store.location.coordinates
    order = _.pick(order, [
      "cartId",
      "orderStatus",
      "userId",
      "name",
      "countryCode",
      "driverAmount",
      "vendorCategory",
      "location",
      "pickedUpTime",
      "deliveryTime",
      "acceptedAt",
      "driverAssignedAt",
      "deliveredAt",
      "pickUpPic",
      "vendorName",
      "vendorAddress",
      "vendorImage",
      "vendorLocation",
      "packagingCharges",
      "mobile",
      "rideTimeMin",
      "rideTimeFare",
      "waitingTimeinMin",
      "waitingTimeFare",
      "baseFare",
      "deliveryFare",
      "orderNo",
      "isUserVerified",
      "orderId",
      "platformFees",
      "details",
      "driverId",
      "rejectedBy",
      "totalAmount",
      "deliveryCharges",
      "deliveryTip",
      "deliveryAddress",
      "paymentType",
      "taxes",
      "taxesPercent",
      "defaultStore",
      "isArrivedAtPickUp",
      "isArrivedAtDrop"
    ]);

    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.ACCEPTED, order }
    });
    let notificationType = "driverAssigned";

    let data = {};

    let user = await User.findOne({ _id: order.userId });
    if (user && user.deviceToken != "") {
      data = {
        orderId: order.orderId.toString(),
        orderStatus: order.orderStatus.toString(),
        driverName: driver.firstName.toString(),
        vendorName: order.vendorName.toString(),
        type: notificationType
      };
      await sendFCM(user.deviceToken, data, notificationType);
    }

    if (req.jwtData.role == "admin") {
      notificationType = "forceAssigned";
      console.log("notificationType", notificationType);

      data = {
        orderId: order.orderId.toString(),
        orderStatus: order.orderStatus.toString(),
        driverName: driver.firstName.toString(),
        vendorName: order.vendorName.toString(),
        type: notificationType
      };
      await sendFCM(driver.deviceToken, data, "forceAssigned");
    }
  } else {
    await Order.updateMany({ _id: req.body.orderId }, { $push: { rejectedBy: driverId } });
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.REJECTED, order }
    });
  }
});

router.put("/updateOrderStatus", identityManager(["driver", "vendor", "admin"], { order: "W" }), async (req, res) => {
  const { error } = validateOrderStatusUpdate(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let driverId;
  if (req.jwtData.role === "driver") {
    driverId = req.jwtData.userId;
  } else {
    driverId = req.body.driverId;
  }
  let driver = await Driver.findOne({ _id: driverId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DRIVER_NOT_FOUND }
    });

  let order = await Order.findOne({ _id: req.body.orderId });
  if (!order)
    return res
      .status(400)
      .send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: "order not found" } });
  if (req.jwtData.role === "driver") {
    if (order.driverId != req.jwtData.userId)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: ORDER_CONSTANTS.NOT_AUTHORIZED_FOR_PICKUP }
      });
  }
  if (req.jwtData.role === "admin") {
    if (req.body.orderStatus != "DELIVERED")
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: ORDER_CONSTANTS.NOT_AUTHORIZED }
      });
  }

  if (req.body.orderStatus === "ARRIVED_AT_DROP") {
    if (req.body.lat && req.body.lng) {
      let lat1 = req.body.lat;
      let lng1 = req.body.lng;
      let lat2, lng2;
      if (order.vendorCategory != "pickUpAndDrop") {
        lat2 = order.location.coordinates[1];
        lng2 = order.location.coordinates[0];
      } else {
        lat2 = order.details.dropLocation[1];
        lng2 = order.details.dropLocation[0];
      }
      distance = getDistance({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 }, (accuracy = 1));
      console.log("distance123", distance, lat1, lng1, lat2, lng2);

      // distance = Math.round(geolib.convertDistance(distance, "mi"), 1);
      // distance = distance * config.get("mileToKmValue") * 1000;
      // if (distance > 200) {
      //   return res.status(400).send({
      //     apiId: req.apiId,
      //     statusCode: 400,
      //     message: "Failure",
      //     data: { message: DRIVER_CONSTANTS.NOT_NEARBY_USER },
      //   });
      // }
      console.log("order.orderStatus", order.orderStatus);
      if (order.orderStatus != "PICKEDUP") {
        return res.status(400).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: ORDER_CONSTANTS.PICK_THE_ORDER_FIRST }
        });
      }
    }
  }
  if (
    req.body.orderStatus === "ARRIVED_AT_PICKUP" ||
    (req.body.orderStatus == "PICKEDUP" && order.vendorCategory != "pickUpAndDrop")
  ) {
    if (req.body.lat && req.body.lng) {
      let lat1 = req.body.lat;
      let lng1 = req.body.lng;
      let lat2, lng2;
      let message;
      if (order.vendorCategory != "pickUpAndDrop") {
        lat2 = order.vendorLocation.coordinates[1];
        lng2 = order.vendorLocation.coordinates[0];
        message = DRIVER_CONSTANTS.NOT_NEARBY_VENDOR;
      } else {
        lat2 = order.details.pickUpLocation[1];
        lng2 = order.details.pickUpLocation[0];
        message = DRIVER_CONSTANTS.NOT_NEARBY_USER;
      }
      distance = getDistance({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 }, (accuracy = 1));
      console.log("distance123", distance, lat1, lng1, lat2, lng2);
      // distance = Math.round(geolib.convertDistance(distance, "mi"), 1);
      // distance = distance * config.get("mileToKmValue") * 1000;
      // if (distance > 200) {
      //   return res.status(400).send({
      //     apiId: req.apiId,
      //     statusCode: 400,
      //     message: "Failure",
      //     data: { message: message },
      //   });
      // }
    }
  }
  let currentTime = Math.round(new Date() / 1000);
  order.orderStatus = req.body.orderStatus || orderStatus;
  if (req.body.orderStatus === "PICKEDUP") {
    order.pickedUpTime = currentTime;
  } else if (req.body.orderStatus === "DELIVERED") {
    order.deliveredAt = currentTime;
    order.deliveredAtDate = new Date();
    if (order.paymentType === "POD") {
      order.codAmountToPay = order.totalAmount;
    }
    order.deliveryDate = moment.tz(config.get("timeZone")).format("YYYY-MM-DD");
    if (order.isReturnOrder) {
      let parentOrder = await Order.findOne({ _id: order.parentOrderId });
      parentOrder.orderStatus = "RETURNED";
      if (parentOrder.paymentType === "POD") {
        parentOrder.codAmountToPay = parentOrder.totalAmount;
      }
      parentOrder.returnOrderFare = order.totalAmount;
      parentOrder.deliveredAtDate = new Date();
      parentOrder.deliveryDate = moment.tz(config.get("timeZone")).format("YYYY-MM-DD");

      parentOrder.deliveredAt = currentTime;

      await parentOrder.save();
      if (parentOrder.paymentType != "POD") {
        // Start  void the initial Pre-Auth 
        //  let data = {
        //   id: parentOrder.flutterwaveRef
        // };
        // let voidResponse = await voidTransaction(data);
        // // if (voidResponse.statusCode !== 200){
        // //   return res.status(400).send({
        // //     apiId: req.apiId,
        // //     statusCode: 400,
        // //     message: "Failure",
        // //     data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        // //   });
        // // }
        // let card = await Card.findOne({ _id: parentOrder.cardId });
        // let userData = await User.findOne({ _id: parentOrder.userId });

        // let chargeObject = {
        //   token: card.cardToken,
        //   narration: config.get("narration"),
        //   tx_ref: parentOrder._id.toString(),
        //   amount:  parentOrder.totalAmount,
        //   currency: config.get("currency"),
        //   country: config.get("country"),
        //   email: card.email || config.get("dummyEmail"),
        //   phonenumber: userData.mobile,
        //   first_name: userData.firstName,
        //   last_name: userData.lastName,
        //   // preauthorize: true
        // };
        // let response = await chargeWithToken(chargeObject);
        // if (response.statusCode !== 200)
        //   return res.status(400).send({
        //     apiId: req.apiId,
        //     statusCode: 400,
        //     message: "Failure",
        //     data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        //   });
        // End  void the initial Pre-Auth

        let paymentData = {
          id: parentOrder.flutterwaveRef,
          amount: parentOrder.totalAmount
        };
        let response = await captureTransaction(paymentData);

        let paymentLog = new PaymentLog();
        paymentLog.userId = req.jwtData.userId;
        paymentLog.type = "captureTransaction"
        paymentLog.paymentType = "updateOrderStatusReturnOrder"

        if (response.statusCode !== 200) {
          paymentLog.data = response.data.response.data;
          await paymentLog.save();
        } else {
          paymentLog.data = response;
          await paymentLog.save();
        }
      }
    }
    if (order.vendorCategory == "pickUpAndDrop") {

      order.driverAmount = order.deliveryCharges * (order.driverCommissionPercent / 100);
      if (order.paymentType != "POD") {
        // Start  void the initial Pre-Auth 
        // let data = {
        //   id: order.flutterwaveRef
        // };
        // let voidResponse = await voidTransaction(data);
        // // if (voidResponse.statusCode !== 200){
        // //   return res.status(400).send({
        // //     apiId: req.apiId,
        // //     statusCode: 400,
        // //     message: "Failure",
        // //     data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        // //   });
        // // }
        // let card = await Card.findOne({ _id: order.cardId });
        // let userData = await User.findOne({ _id: order.userId });

        // let chargeObject = {
        //   token: card.cardToken,
        //   narration: config.get("narration"),
        //   tx_ref: order._id.toString(),
        //   amount:  order.totalAmount,
        //   currency: config.get("currency"),
        //   country: config.get("country"),
        //   email: card.email || config.get("dummyEmail"),
        //   phonenumber: userData.mobile,
        //   first_name: userData.firstName,
        //   last_name: userData.lastName,
        //   // preauthorize: true
        // };
        // let response = await chargeWithToken(chargeObject);
        // if (response.statusCode !== 200)
        //   return res.status(400).send({
        //     apiId: req.apiId,
        //     statusCode: 400,
        //     message: "Failure",
        //     data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
        //   });
        // End  void the initial Pre-Auth

        let paymentData = {
          id: order.flutterwaveRef,
          amount: order.totalAmount
        };
        let response = await captureTransaction(paymentData);

        let paymentLog = new PaymentLog();
        paymentLog.userId = req.jwtData.userId;
        paymentLog.type = "captureTransaction"
        paymentLog.paymentType = "updateOrderStatus"

        if (response.statusCode !== 200) {
          paymentLog.data = response.data.response.data;
          await paymentLog.save();
        } else {
          paymentLog.data = response;
          await paymentLog.save();
        }
      }

      // console.log("responseresponseresponseresponse", response);
    }
    if (order.details.referralDiscount > 0) {
      let referral = await Referral.findOne({ _id: order.referralId });
      if (referral && referral.type == "signup") {
        await Referral.insertMany([
          {
            userId: referral.referredBy,
            referredBy: referral.userId,
            referredTo: referral.referredBy,
            status: "active",
            type: "invite"
          }
        ]);
      }
    }
    if (req.jwtData.role == "admin") {
      let data = {
        driverId: driver._id.toString(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus.toString(),
        type: "orderMarkedDeliveredByAdmin"
      };
      await sendFCM(driver.deviceToken, data, "orderMarkedDeliveredByAdmin");
    }
  } else if (req.body.orderStatus === "ARRIVED_AT_DROP") {
    order.arrivedDropAt = currentTime;
    let data = {
      orderId: order._id.toString(),
      orderStatus: order.orderStatus.toString(),
      driverName: driver.firstName.toString(),
      type: "arrivedAtDrop"
    };
    let user = await User.findOne({ _id: order.userId });
    await sendFCM(user.deviceToken, data, "arrivedAtDrop");
  } else if (req.body.orderStatus === "ARRIVED_AT_PICKUP") {
    order.arrivedPickUpAt = currentTime;
    let data = {
      orderId: order._id.toString(),
      orderStatus: order.orderStatus.toString(),
      driverName: driver.firstName.toString(),
      type: "arrivedAtPickUp"
    };
    let user = await User.findOne({ _id: order.userId });
    await sendFCM(user.deviceToken, data, "arrivedAtPickUp");
  }

  // order.orderStatus = req.body.orderStatus || orderStatus;
  await order.save();
  order.orderId = order._id;
  let store = await Vendor.findOne({ _id: order.vendorId });
  // order.storeName = store.storeName
  // order.storeAddress = store.address
  // order.storeImage = store.image
  // order.storeLocation = store.location.coordinates
  order = _.pick(order, [
    "cartId",
    "userId",
    "name",
    "location",
    "pickedUpTime",
    "vendorCategory",
    "driverAmount",
    "platformFees",
    "deliveryTime",
    "deliveredAt",
    "acceptedAt",
    "pickUpPic",
    "driverAssignedAt",
    "rideTimeMin",
    "wasReassignOrderPickedUp",
    "packagingCharges",
    "rideTimeFare",
    "waitingTimeinMin",
    "waitingTimeFare",
    "baseFare",
    "deliveryFare",
    "arrivedDropAt",
    "insertDate",
    "vendorName",
    "vendorAddress",
    "vendorImage",
    "vendorLocation",
    "countryCode",
    "mobile",
    "orderNo",
    "orderId",
    "details",
    "driverId",
    "rejectedBy",
    "totalAmount",
    "orderStatus",
    "deliveryCharges",
    "deliveryTip",
    "deliveryAddress",
    "paymentType",
    "taxes",
    "taxesPercent",
    "defaultStore",
    "isArrivedAtPickUp",
    "isArrivedAtDrop"
  ]);
  if (req.body.orderStatus === "PICKEDUP") {
    let data = {
      orderId: order.orderId.toString(),
      orderStatus: order.orderStatus.toString(),
      driverName: driver.firstName.toString(),
      type: "orderPickedUp"
    };
    let user = await User.findOne({ _id: order.userId });
    await sendFCM(user.deviceToken, data, "orderPickedUp");
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.PICKED_UP, order }
    });
  } else if (req.body.orderStatus === "DELIVERED") {
    driver.pendingOrders -= 1;
    await driver.save();
    console.log(" order._id.toString(),", order.orderId);
    let data = {
      orderId: order.orderId.toString(),
      orderStatus: order.orderStatus.toString(),
      driverName: driver.firstName.toString(),
      type: "rateTheDriver"
    };
    let user = await User.findOne({ _id: order.userId });
    await sendFCM(user.deviceToken, data, "rateTheDriver");
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.DELIVERED, order }
    });
  } else if (req.body.orderStatus === "ARRIVED_STORE") {
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.DRIVED_ARRIVED_AT_STORE, order }
    });
  } else if (req.body.orderStatus === "ITEM_MATCHED") {
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.ITEMS_MATCHED, order }
    });
  } else {
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: ORDER_CONSTANTS.UPDATED, order }
    });
  }
});

router.put("/productPic", identityManager(["driver"]), async (req, res) => {
  console.log("fe");
  const { error } = validateDeliveryPic(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let order = await Order.findOne({ _id: req.body.orderId });
  if (!order)
    return res
      .status(400)
      .send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: "order not found" } });
  order.deliveryPic = req.body.deliveryPic || order.deliveryPic;
  order.pickUpPic = req.body.pickUpPic || order.pickUpPic;
  await order.save();
  order.orderId = order._id;
  // let vendor = await Store.findOne({_id:order.storeId});
  // order.storeName = store.storeName;
  // order.storeAddress = store.address;
  // order.storeImage = store.image;
  // order.storeLocation = store.locaction.coordinates;
  order = _.pick(order, [
    "cartId",
    "userId",
    "name",
    "vendorImage",
    "vendorLocation",
    "mobile",
    "deliveredAt",
    "driverAmount",

    "driverAssignedAt",
    "arrivedDropAt",
    "acceptedAt",
    "insertDate",
    "orderNo",
    "orderId",
    "details",
    "driverId",
    "rejectedBy",
    "totalAmount",
    "deliveryCharges",
    "deliveryTip",
    "deliveryAddress",
    "paymentType",
    "taxes",
    "defaultStore"
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ORDER_CONSTANTS.UPDATED, order }
  });
});

router.get("/invoice/pdf", async (req, res) => {
  const stream = res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment;filename=invoice.pdf`
  });
  pdfService.buildPDF(
    (chunk) => stream.write(chunk),
    () => stream.end()
  );
});

router.post("/tokenizedCharges", identityManager(["user"]), async (req, res) => {
  let card = await Card.findOne({ cardToken: req.body.cardToken });
  if (!card)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CARD_CONSTANTS.INVALID_CARD }
    });

  let order = new TestOrder();
  // console.log("Amounttttt", order.totalAmount);
  let chargeObject = {
    token: req.body.cardToken,
    narration: config.get("narration"),
    tx_ref: order._id.toString(),
    // amount: order.totalAmount * 1.5,
    amount: req.body.amount * 1.5,
    currency: config.get("currency"),
    country: config.get("country"),
    email: card.email || config.get("dummyEmail"),
    phonenumber: req.userData.mobile,
    first_name: req.userData.firstName,
    last_name: req.userData.lastName,
    preauthorize: true
    // usesecureauth: true,
  };
  let response = await chargeWithToken(chargeObject);
  console.log("responsssseeee", response);

  let paymentLog = new PaymentLog();
  paymentLog.userId = req.jwtData.userId;
  paymentLog.type = "chargeWithToken"


  if (response.statusCode !== 200) {
    paymentLog.data = response.data.response.data;
    await paymentLog.save();

    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      // data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      data: response.data.response.data
    });
  } else {
    paymentLog.data = response;
    await paymentLog.save();
    if (response.data.status != "success")
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      });
    else {
      order.totalAmount = req.body.amount;
      order.flutterwaveRef = response.data.data.flw_ref;
      order.flutterwaveId = response.data.data.id;
      order.cardId = card._id;
      order.cardDetails = response.data.data.card;
      order.email = req.userData.email;

    }
  }
  // TestOrder
  await order.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Order created successfully", response }
  });
});


router.post("/finalCharge", identityManager(["user"]), async (req, res) => {

  // TestOrder
  let order = await TestOrder.findOne({ _id: req.body.tx_ref });
  // Start  void the initial Pre-Auth 
  console.log("order >", order)
  let data = {
    id: order.flutterwaveRef
  };
  let voidResponse = await voidTransaction(data);

  let paymentLog = new PaymentLog();
  paymentLog.userId = req.jwtData.userId;
  paymentLog.type = "voidTransaction"

  if (voidResponse.statusCode !== 200) {
    console.log("voidResponse 1:", voidResponse.data.response.data)
    paymentLog.data = voidResponse.data.response.data;
    await paymentLog.save();

    if (voidResponse.data.response.data.message == "This transaction has been voided or refunded") {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "This transaction has been voided or refunded" }
      });
    }
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      // data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      data: voidResponse.data.response.data
    });
  }

  paymentLog.data = voidResponse;
  await paymentLog.save();

  let card = await Card.findOne({ _id: order.cardId });
  let userData = await User.findOne({ _id: req.jwtData.userId });

  let chargeObject = {
    token: card.cardToken,
    narration: config.get("narration"),
    tx_ref: order._id.toString(),
    amount: order.totalAmount,
    currency: config.get("currency"),
    country: config.get("country"),
    email: card.email || config.get("dummyEmail"),
    phonenumber: userData.mobile,
    first_name: userData.firstName,
    last_name: userData.lastName,
    // preauthorize: true
  };
  let response = await chargeWithToken(chargeObject);

  let finalPaymentLog = new PaymentLog();
  finalPaymentLog.userId = req.jwtData.userId;
  finalPaymentLog.type = "finalChargeWithToken"


  if (response.statusCode !== 200) {
    finalPaymentLog.data = response.data.response.data;
    await finalPaymentLog.save();

    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      // data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED }
      data: response.data.response.data
    });
  }
  // End  void the initial Pre-Auth

  finalPaymentLog.data = response;
  await finalPaymentLog.save();

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Order update successfully", response }
  });
});



module.exports = router;
