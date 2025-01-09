const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");
Joi.objectId = require("joi-objectid")(Joi);

const feeAndLimitSchema = new mongoose.Schema({
  driverPlatformFeePercent: Number,
  maxOrderAmtForCod: Number,
  vendorPlatformFeePercent: Number,
  // deliveryBaseFare: Number,
  platformFees: Number,
  baseFare: Number,
  exceededDeliveryChargesPerKm: Number,
  waitingTimeFarePerMin: Number,
  waitingTimeMinBuffer: Number,
  rideTimeFarePerMin: Number,
  defaultRideTimeFreeMin: Number,
  deliveryRadius: Number,
  serviceTax: Number,
  serviceCharge: Number,
  vatCharge: Number,
  defaultDistance: Number,
  startDeliveryTime: String,
  endDeliveryTime: String,
  startDeliveryTimeInSec: Number,
  endDeliveryTimeInSec: Number,
  cityId: String,
  type: { type: String, enum: ["pickUpDrop", "store"] },
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
const FeeAndLimit = mongoose.model("FeeAndLimit", feeAndLimitSchema);

function validateChargesPickUpDrop(req) {
  const schema = Joi.object({
    maxOrderAmtForCod: Joi.number(),
    driverPlatformFeePercent: Joi.number().required(),
    baseFare: Joi.number().required(),
    exceededDeliveryChargesPerKm: Joi.number().required(),
    waitingTimeFarePerMin: Joi.number().required(),
    waitingTimeMinBuffer: Joi.number().required(),
    rideTimeFarePerMin: Joi.number().required(),
    defaultRideTimeFreeMin: Joi.number().required(),
    deliveryRadius: Joi.number().required(),
    serviceTax: Joi.number().required(),
    vatCharge: Joi.number().required(),
    defaultDistance: Joi.number().required(),
    startDeliveryTime: Joi.string().required(),
    endDeliveryTime: Joi.string().required(),
    platformFees: Joi.number().required(),
    cityId: Joi.string().required().required(),
  });
  return schema.validate(req);
}
function validateChargesStore(req) {
  const schema = Joi.object({
    maxOrderAmtForCod: Joi.number().required(),
    driverPlatformFeePercent: Joi.number().required(),
    vendorPlatformFeePercent: Joi.number().required(),
    baseFare: Joi.number().required(),
    exceededDeliveryChargesPerKm: Joi.number().required(),
    deliveryRadius: Joi.number().required(),
    serviceTax: Joi.number().required(),
    vatCharge: Joi.number().required(),
    defaultDistance: Joi.number().required(),
    startDeliveryTime: Joi.string().required(),
    platformFees: Joi.number(),
    endDeliveryTime: Joi.string().required(),
    serviceCharge: Joi.number().required(),
    cityId: Joi.string().required(),
  });
  return schema.validate(req);
}
function feeLimitLookUp(cityId) {
  return {
    from: "feeandlimits",
    let: { cityId: cityId },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
          },
        },
      },
    ],
    as: "fareData",
  };
}

exports.FeeAndLimit = FeeAndLimit;

exports.validateChargesPickUpDrop = validateChargesPickUpDrop;
exports.validateChargesStore = validateChargesStore;
exports.feeLimitLookUp = feeLimitLookUp;
