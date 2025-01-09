const Joi = require("joi");
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  userId: String,
  code: String,
  description: String,
  couponStartTime: Number,
  couponEndTime: Number,
  perUserLimit: Number,
  couponType: { type: String, enum: ["percentage", "fixed"] },
  value: Number,
  maxRedemption: { type: Number, default: 0 },
  maxDiscountPrice: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "expired", "deleted", "scheduled"] },
  type: { type: String, enum: ["coupon", "promocode", "influencerCode"] },
  redemptionCount: { type: Number, default: 0 },
  redemptionAmount: { type: Number, default: 0 },
  minOrderPrice: { type: Number, default: 0 },
  vendorType: [String],
  isFirstOrder: { type: Boolean, default: false },
  isDisabled: { type: Boolean, default: false },
  createdBy: String,
  updatedBy: String,
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    },
  },
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    },
  },
});

const Coupon = mongoose.model("Coupon", couponSchema);

function validateCouponPost(coupon) {
  const schema = {
    code: Joi.string().required(),
    description: Joi.string().required(),
    couponStartTime: Joi.number().required(),
    couponEndTime: Joi.number().required(),
    perUserLimit: Joi.number().required(),
    couponType: Joi.valid(["percentage", "fixed"]).required(),
    type: Joi.valid(["coupon", "promocode", "influencerCode"]).required(),
    userId: Joi.when("type", {
      is: "influencerCode",
      then: Joi.string().required(),
      otherwise: Joi.any(),
    }),
    value: Joi.number().required(),
    vendorType: Joi.when("type", {
      is: "coupon",
      then: Joi.forbidden(),
      otherwise: Joi.array().items(Joi.string().required().valid("grocery", "restaurant", "liquor", "delivery")).required(),
    }),
    maxRedemption: Joi.number().required(),
    minOrderPrice: Joi.number().required(),
    maxDiscountPrice: Joi.number(),
    isFirstOrder: Joi.boolean(),
  };
  return Joi.validate(coupon, schema);
}

function validateCouponPut(coupon) {
  const schema = {
    couponId: Joi.string().required(),
    description: Joi.string(),
    couponStartTime: Joi.number(),
    type: Joi.valid(["coupon", "promocode", "influencerCode"]),

    code: Joi.when("type", {
      is: "influencerCode",
      then: Joi.string(),
      otherwise: Joi.any().forbidden(),
    }),
    couponEndTime: Joi.number(),
    perUserLimit: Joi.number(),
    maxRedemption: Joi.number(),
    minOrderPrice: Joi.number(),
    vendorType: Joi.array(),
    status: Joi.string(),
    isFirstOrder: Joi.boolean(),
    isDisabled: Joi.boolean(),
    maxDiscountPrice: Joi.number(),
  };
  return Joi.validate(coupon, schema);
}

function validateGet(coupon) {
  const schema = {
    isNewPromocode: Joi.string(),
    vendorId: Joi.string(),
    couponId: Joi.string(),
    code: Joi.string(),
    status: Joi.string(),
    type: Joi.string(),
    startDate: Joi.number(),
    endDate: Joi.number(),
    vendorType: Joi.string(),
    offset: Joi.number(),
    limit: Joi.number(),
    isDisabled: Joi.string(),
  };
  return Joi.validate(coupon, schema);
}
function validateAddPromocodeInPickUp(coupon) {
  const schema = {
    couponCode: Joi.string(),
    deliveryCharges: Joi.number().required(),
    lat1: Joi.number().required(),
    lon1: Joi.number().required(),
    isReferralApplied: Joi.boolean(),
  };
  return Joi.validate(coupon, schema);
}
exports.Coupon = Coupon;
exports.validateCouponPost = validateCouponPost;
exports.validateCouponPut = validateCouponPut;
exports.validateAddPromocodeInPickUp = validateAddPromocodeInPickUp;

exports.validateGet = validateGet;
