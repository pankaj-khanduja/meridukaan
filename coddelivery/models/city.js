const Joi = require("joi");
const mongoose = require("mongoose");

const citySchema = new mongoose.Schema({
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }
  },
  cityName: String,
  country: String,
  storeStatus: { type: String, enum: ["active", "pending"], default: "pending" },
  pickUpAndDropStatus: { type: String, enum: ["active", "pending"], default: "pending" },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    }
  },
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  }
});

citySchema.index({ location: "2dsphere" });
const City = mongoose.model("City", citySchema);

function validateCityPost(req) {
  const schema = Joi.object({
    cityName: Joi.string().required(),
    country: Joi.string().required(),
    location: Joi.array().required()
  });
  return schema.validate(req);
}
function validateCityGet(req) {
  const schema = Joi.object({
    type: Joi.string().valid("pickUpAndDrop", "store", "all").required(),
    limit: Joi.number(),
    offset: Joi.number(),
    lon: Joi.number(),
    lat: Joi.number(),
    text: Joi.string()
  });
  return schema.validate(req);
}
module.exports.validateCityPost = validateCityPost;
module.exports.validateCityGet = validateCityGet;

module.exports.City = City;
