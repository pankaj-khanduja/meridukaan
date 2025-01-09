const config = require("config");
const mongoose = require("mongoose");
const { Coupon } = require("../models/coupon");
const { Banner } = require("../models/banner");

mongoose.set("debug", true);

async function checkCouponExpiry() {
  let currentTime = Math.round(new Date() / 1000);
  await Coupon.updateMany({ status: "active", couponEndTime: { $lt: currentTime } }, { $set: { status: "expired" } });
}

async function checkBannerExpiry() {
  let currentTime = Math.round(new Date() / 1000);
  await Banner.updateMany({ status: "active", expireTime: { $lt: currentTime } }, { $set: { status: "expired" } });
}

module.exports.checkCouponExpiry = checkCouponExpiry;
module.exports.checkBannerExpiry = checkBannerExpiry;
