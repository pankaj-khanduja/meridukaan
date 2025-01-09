const Joi = require("joi");
const mongoose = require("mongoose");

const CategoryBannerSchema = new mongoose.Schema({
  banner: { type: String },
  type: { type: String },
  vendorId: { type: String },
  creationDate: { type: Date, default: () => { return new Date(); } },
  insertDate: { type: Number, default: () => { return Math.round(new Date() / 1000) } }
});

const CategoryBanner = mongoose.model("CategoryBanner", CategoryBannerSchema);

function validateBanner(post) {
  const schema = Joi.object({
    banner: Joi.string(),
    type: Joi.string().required(),
  });
  return schema.validate(post);
}

function validatePutBanner(post) {
  const schema = Joi.object({
    bannerId: Joi.string().required(),
    banner: Joi.string(),
    type: Joi.string(),
  });
  return schema.validate(post);
}

exports.CategoryBanner = CategoryBanner;
exports.validateBanner = validateBanner;
exports.validatePutBanner = validatePutBanner;
