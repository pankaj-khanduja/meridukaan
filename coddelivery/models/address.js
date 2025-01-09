const Joi = require("joi");
const mongoose = require("mongoose");
const addressSchema = new mongoose.Schema({
  address: {
    currentAddress: { type: String },
    name: { type: String },
    completeAddress: { type: String },
    tag: { type: String, enum: ["home", "work", "other"] },
    cityName: String,
    cityId: String,
  },
  isDefaultAddress: { type: Boolean, default: false },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  userId: { type: String },
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
const Address = mongoose.model("Address", addressSchema);

function validateAddress(address) {
  const schema = Joi.object({
    address: Joi.object({
      currentAddress: Joi.string().required(),
      name: Joi.string().allow(""),
      completeAddress: Joi.string(),
      tag: Joi.string().valid("home", "work", "other"),
      zipcode: Joi.string().allow(""),
      cityName: Joi.string().allow(""),
      cityId: Joi.string(),
    }),
    isDefaultAddress: Joi.boolean(),

    location: Joi.array().required(),
  });

  return schema.validate(address);
}
function validateDeliveryLocation(req) {
  const schema = Joi.object({
    lat1: Joi.number().required(),
    lon1: Joi.number().required(),
    vendorId: Joi.string().required(),
  });
  return schema.validate(req);
}

function validateAddressPut(address) {
  const schema = Joi.object({
    addressId: Joi.string(),
    address: Joi.object({
      currentAddress: Joi.string(),
      name: Joi.string().allow(""),
      completeAddress: Joi.string().allow(""),
      tag: Joi.string().valid("home", "work", "other"),
      zipcode: Joi.string().allow(""),
      cityName: Joi.string().allow(""),
      cityId: Joi.string(),
    }),
    isDefaultAddress: Joi.boolean(),

    location: Joi.array(),
  });

  return schema.validate(address);
}
function validateDefaultAddress(address) {
  const schema = Joi.object({
    addressId: Joi.string(),
  });
  return schema.validate(address);
}

exports.Address = Address;

exports.validateAddress = validateAddress;
exports.validateDeliveryLocation = validateDeliveryLocation;
exports.validateAddressPut = validateAddressPut;
exports.validateDefaultAddress = validateDefaultAddress;
