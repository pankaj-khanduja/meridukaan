const Joi = require("joi");
const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema({
  vendorId: { type: String },
  banner: { type: String },
  status: { type: String, enum: ["active", "inactive", "expired"] },
  type: { type: String, enum: ["app", "web"], default: "app" },
  bannerType: { type: String, enum: ["food", "restaurant"] },
  startTime: { type: Number },
  expireTime: { type: Number },
  link: { type: String, default: "" },
  sortOrder: { type: Number },
  cityId: String,
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    }
  }
});

const Banner = mongoose.model("Banner", BannerSchema);

function validateBanner(post) {
  const schema = Joi.object({
    vendorId: Joi.string().allow(""),
    banner: Joi.string().required(),
    type: Joi.string().valid(["app", "web"]),
    bannerType: Joi.string().valid(["food", "restaurant"]).required(),
    link: Joi.string(),
    startTime: Joi.number(),
    expireTime: Joi.number(),
    sortOrder: Joi.number(),
    cityId: Joi.string()
  });
  return schema.validate(post);
}

function validatePutBanner(post) {
  const schema = Joi.object({
    vendorId: Joi.string().allow(""),
    bannerId: Joi.string().required(),
    banner: Joi.string(),
    type: Joi.string().valid(["app", "web"]),
    bannerType: Joi.string().valid(["food", "restaurant"]),
    link: Joi.string(),
    startTime: Joi.number(),
    expireTime: Joi.number(),
    sortOrder: Joi.number(),
    cityId: Joi.string(),
    status: Joi.string().valid(["active", "inactive"])
  });
  return schema.validate(post);
}

function getValidateBanner(post) {
  const schema = Joi.object({
    type: Joi.string(),
    bannerType: Joi.string(),
    lng: Joi.number(),
    lat: Joi.number(),
    cityId: Joi.number()
  });
  return schema.validate(post);
}

exports.Banner = Banner;
exports.validateBanner = validateBanner;
exports.validatePutBanner = validatePutBanner;
exports.getValidateBanner = getValidateBanner;
