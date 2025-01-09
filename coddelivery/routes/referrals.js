const { COUPON_CONSTANTS, CART_CONSTANTS, REFERRAl_CONSTANTS } = require("../config/constant.js");
const config = require("config");
const Joi = require("joi");
const mongoose = require("mongoose");
const _ = require("lodash");
const { identityManager } = require("../middleware/auth");
const { calculateTax, deliveryCharges } = require("../services/cartCharges");
const { vendorFareAggregate } = require("../models/vendor");

const { Referral, validateAddRemoveReferral } = require("../models/referral");
const { Vendor } = require("../models/vendor");

const { Redemption } = require("../models/redemption");

const { Cart } = require("../models/cart");
const express = require("express");
const { Card } = require("../models/card.js");
const router = express.Router();

router.put("/addRemove", identityManager(["user", "storeManager", "public"]), async (req, res) => {
  var { error } = validateAddRemoveReferral(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let cart;
  let userId;
  cart = await Cart.findOne({ userId: req.jwtData.userId });
  if (!cart) {
    return res.status.send({
      statusCode: 400,
      message: "Failure",
      data: { cart, message: CART_CONSTANTS.CART_NOT_FOUND },
    });
  }
  // let referral = await Referral.findOne({ referredBy: req.jwtData.userId, status: "active" });
  let referral = await Referral.findOne({ userId: req.jwtData.userId, status: "active" });
  if (!referral) {
    referral = await Referral.findOne({ referredBy: req.jwtData.userId, referredByStatus: "active" });
    if (!referral) {
      return res.status(400).send({
        statusCode: 400,
        message: "Failure",
        data: { message: REFERRAl_CONSTANTS.NO_REFERRAL_AVAILABLE },
      });
    }
  }




  if (req.body.applyReferralCode === true) {
    if (!referral) { return res.status.send({ statusCode: 400, message: "Failure", data: { cart, message: REFERRAl_CONSTANTS.NO_REFERRAL_AVAILABLE }, }); }
    console.log("referral", referral);
    cart.referralDiscount = config.get("referralCodeAmount");
  } else {
    cart.referralDiscount = 0;
  }
  let amount;
  let cartCharges = {};

  let deliveryCharge;
  // console.log("cartCharges", cartCharges);
  // let store = await Store.findOne({_id:})
  // if (cart.length > 0) {
  // data = cart[0]
  // amount = cart[0].subTotal - cart[0].cartDiscount
  let vendor = await vendorFareAggregate(cart.vendorId);
  let chargeDetails = {
    serviceTax: vendor.serviceTax,
    serviceCharge: vendor.serviceCharge,
    vatCharge: vendor.vatCharge,
  };
  amount = cart.subTotal - cart.cartDiscount - cart.referralDiscount;
  deliveryCharge = cart.deliveryCharges;

  if (amount > 0) {
    // let cartCharges

    cartCharges = calculateTax(amount, chargeDetails);
    cartCharges.deliveryCharge = deliveryCharge;
    cartCharges.platformFees = (cart.subTotal * vendor.platformFees) / 100;

    cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount + cartCharges.platformFees;
    cart.totalAmount += deliveryCharge;
  } else {
    // let cartCharges = {}

    cartCharges.serviceCharge = 0;
    cartCharges.serviceTax = 0;
    cartCharges.vatCharge = 0;
    cartCharges.platformFees = 0;
    cart.totalAmount = 0 + deliveryCharge;
  }
  let response = {};

  if (vendor.packagingCharges) {
    cart.totalAmount += vendor.packagingCharges;
    response.packagingCharges = vendor.packagingCharges;
  }
  await cart.save();

  let totalReferral = 0;
  if (req.jwtData.role === "user" && (req.userData.totalReferral != 0)) {
    if (req.body.applyReferralCode === true) {
      totalReferral = req.userData.totalReferral - 1;

    } else {
      totalReferral = req.userData.totalReferral;
    }
  }
  response.subTotal = cart.subTotal;
  response.cartDiscount = cart.cartDiscount;
  response.couponId = cart.couponId;
  response.referralDiscount = cart.referralDiscount;
  response.vendorId = cart.vendorId;
  response.totalReferral = totalReferral;
  response.totalAmount = cart.totalAmount;
  response.cartId = cart._id;
  response.cartCharges = cartCharges;
  response.deliveryCharge = deliveryCharge;
  return res.send({ statusCode: 200, status: "Success", response, });
});

module.exports = router;
