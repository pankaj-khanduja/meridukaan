const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");
Joi.objectId = require("joi-objectid")(Joi);

const ratingSchema = new mongoose.Schema({
  ratedUserId: String,
  userId: String,
  orderId: String,
  rating: Number,
  tag: [String],
  review: { type: String, default: "" },
  ratingType: { type: String, enum: ["driverRating", "vendorRating"] },
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    },
  },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    },
  },
});
const Rating = mongoose.model("Rating", ratingSchema);

function validateRatingPost(req) {
  const schema = Joi.object({
    ratedUserId: Joi.string().required(),
    orderId: Joi.objectId().required(),

    rating: Joi.number().min(1).max(5).required(),
    review: Joi.string(),
    tag: Joi.array(),
    ratingType: Joi.string().valid("driverRating", "vendorRating").required(),
  });
  return schema.validate(req);
}

module.exports.Rating = Rating;
module.exports.validateRatingPost = validateRatingPost;
