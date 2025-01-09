const Joi = require("joi");
const config = require("config");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { func } = require("joi");
const { feeLimitLookUp } = require("./feeAndLimit");
Joi.objectId = require("joi-objectid")(Joi);

const vendorSchema = new mongoose.Schema({
  name: String,
  email: String,
  profilePic: { type: String, default: "" },
  password: String,
  mobile: String,
  countryCode: String,
  city: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  cityId: String,
  address: String,
  platformFeePercentage: { type: Number, default: config.get("defaultPlatformFee") },
  status: { type: String, enum: ["active", "inactive", "deleted", "blocked"], default: "active" },
  paymentMode: String,
  enableEmailNotification: { type: Boolean, default: true },
  packagingCharges: Number,
  merchantCategory: { type: String, enum: ["restaurant", "grocery", "liquor","pickUpAndDrop","cosmetic", "confectionary","meatAndSeafood","beverages"] },
  deliveryRadius: { type: Number, default: config.get("deliveryRadius") },
  deliveryTime: { type: Number, default: config.get("deliveryTime") },
  minimumOrderAmount: { type: Number, default: config.get("minimumOrderAmount") },
  isPaymentGatewayIntegrated: { type: Boolean, default: false },
  flutterwaveId: Number,
  subaccountId: String,
  openTill: [Object],
  accessToken: { type: String },
  deviceToken: { type: String },
  isDeleted: { type: Boolean, default: false },
  avgRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  vatCharge: { type: Number, default: 0 },
  serviceTax: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  isDefaultTaxes: { type: Boolean, default: false },
  isPlatformFee: { type: Boolean, default: false },
  isDeliveryRadius: { type: Boolean, default: false },
  isZohoIntegration: { type: Boolean, default: false },
  driverCount: Number,
  contactId: { type: String },
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

vendorSchema.index({ location: "2dsphere" });

vendorSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ userId: this._id, role: "vendor" }, config.get("jwtPrivateKey"));
  return token;
};
// storeSchema.methods.generateAuthToken = function () {

//     const token = jwt.sign(
//         {userId:this._id, role:"store"},
//         config.get("jwtPrivateKey")
//     );
//     return token;
// };

const Vendor = mongoose.model("Vendor", vendorSchema);

function validateVendorPost(vendor) {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().lowercase().min(6).max(255).required().email(),
    password: Joi.string().min(4).max(255).required(),
    mobile: Joi.string().min(7).max(14).required(),
    merchantCategory: Joi.string().valid("restaurant", "grocery", "liquor"),
    location: Joi.array(),
    address: Joi.string(),
    city: Joi.string(),
    cityId: Joi.objectId().required(),
    platformFeePercentage: Joi.number(),
    vatCharge: Joi.number(),
    serviceTax: Joi.number(),
    serviceCharge: Joi.number(),
    deliveryRadius: Joi.number().required(),
    profilePic: Joi.string().required(),
    isPlatformFee: Joi.boolean(),
    isDeliveryRadius: Joi.boolean(),
    isDefaultTaxes: Joi.boolean(),
    countryCode: Joi.string(),

    // otpToken: Joi.number().required(),

    // verificationType:Joi.string().required()
  });
  return schema.validate(vendor);
}

function validateVendorPut(vendor) {
  const schema = Joi.object({
    vendorId: Joi.string(),
    name: Joi.string(),
    email: Joi.string(),
    otpToken: Joi.number(),
    mobile: Joi.string(),
    enableEmailNotification: Joi.boolean(),
    packagingCharges: Joi.number(),
    // merchantCategory: Joi.string().valid("restaurant", "grocery", "liquor"),
    location: Joi.array(),
    address: Joi.string(),
    city: Joi.string(),
    cityId: Joi.objectId(),
    openTill: Joi.array(),
    deliveryRadius: Joi.number(),
    deliveryTime: Joi.number(),
    minimumOrderAmount: Joi.number(),
    status: Joi.string().valid("active", "inactive", "deleted", "blocked"),
    paymentMode: Joi.string(),
    profilePic: Joi.string(),
    vatCharge: Joi.number(),
    serviceTax: Joi.number(),
    serviceCharge: Joi.number(),
    platformFeePercentage: Joi.number(),
    isPlatformFee: Joi.boolean(),
    isDeliveryRadius: Joi.boolean(),
    isDefaultTaxes: Joi.boolean(),
    countryCode: Joi.string(),
    // accountBank: Joi.string().required(),
    // accountNumber: Joi.string().required(),
    // meta: Joi.array(),
    // countryAbbrevation: Joi.string().required(),
    // otpToken: Joi.number().required(),

    // verificationType:Joi.string().required()
  });
  return schema.validate(vendor);
}

function validateVendorLogin(vendor) {
  const schema = Joi.object({
    password: Joi.string().min(6).max(255).required(),
    email: Joi.string().min(6).max(255).email(),
    // mobile: Joi.string().min(10).max(13),
  });
  // .xor("email", "mobile")
  return schema.validate(vendor);
}

function validateChangePassword(user) {
  const schema = Joi.object({
    oldPassword: Joi.string()
      .min(6)
      .max(255)
      .required()
      .error(() => {
        return {
          message: "Old Password length must be at least 6 characters long...",
        };
      }),
    newPassword: Joi.string()
      .min(6)
      .max(255)
      .required()
      .error(() => {
        return {
          message: "New Password length must be at least 6 characters long",
        };
      }),
  });
  return schema.validate(user);
}

function venderProjection() {
  return {
    _id: 0,
    vendorId: "$_id",
    name: 1,
    mobile: 1,
    countryCode: 1,
    email: 1,
    profilePic: 1,
    merchantCategory: 1,
    address: 1,
    city: 1,
    cityId: 1,
    location: 1,
    status: 1,
    deliveryRadius: 1,
    deliveryTime: 1,
    minimumOrderAmount: 1,
    platformFeePercentage: 1,
    openTill: 1,
    isDeleted: 1,
    creationDate: 1,
    insertDate: 1,
    flutterwaveId: 1,
    subaccountId: 1,
    dist: 1,
    isStoreDeliverable: 1,
    avgRating: 1,
    totalRatings: 1,
    isDeliveryRadius: 1,
    merchantCategory: 1,
    isPlatformFee: 1,
    isDefaultTaxes: 1,
    packagingCharges: 1,
    vatCharge: 1,
    serviceTax: 1,
    serviceCharge: 1,
    driverData: 1,
    venderDiscount: { $arrayElemAt: ["$couponsData.value", 0] },
    couponType: { $arrayElemAt: ["$couponsData.couponType", 0] },
    scheduleData: { $arrayElemAt: ["$scheduleData.closingTime", 0] },
    isVenderOpen: { $anyElementTrue: ["$scheduleData"] },
    // scheduleData: 1,
  };
}
async function vendorFareAggregate(vendorId) {
  let criteria = {};
  if (vendorId) {
    criteria._id = mongoose.Types.ObjectId(vendorId);
  }
  let vendor = await Vendor.aggregate([
    {
      $match: criteria,
    },
    {
      $lookup: feeLimitLookUp("$cityId"),
    },
    {
      $project: {
        cityId: 1,
        status: 1,
        packagingCharges: 1,
        name: 1,
        vendorId: "$_id",
        // chargeDetails: {
        serviceCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceCharge", 0] }, "$serviceCharge"],
        },
        serviceTax: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceTax", 0] }, "$serviceTax"],
        },
        vatCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.vatCharge", 0] }, "$vatCharge"],
        },
        platformFees: { $arrayElemAt: ["$fareData.platformFees", 0] },

        // },
      },
    },
  ]);
  return vendor[0];
}
function slotLookUp(vendorId) {
  let currentTime = Math.round(new Date() / 1000);
  let dayStartTime = Math.round(new Date().setUTCHours(0, 0, 0, 0) / 1000) + parseInt(config.get("inOffset"));

  let currentTimeinSec = currentTime - dayStartTime;
  console.log("currentTimeinSec", dayStartTime, currentTime, currentTimeinSec);
  let currentDay = new Date().getDay();
  return {
    from: "vendorschedules",
    let: { vendorId: { $toString: vendorId } },
    pipeline: [
      {
        $match: {
          $and: [
            { $expr: { $eq: ["$vendorId", "$$vendorId"] } },
            { $expr: { $eq: ["$day", currentDay] } },

            {
              $expr: {
                $or: [
                  {
                    $and: [{ $lte: [currentTimeinSec, "$closingTimeInSec"] }, { $gte: [currentTimeinSec, "$openingTimeInSec"] }],
                  },
                ],
              },
            },
          ],
        },
      },
    ],
    as: "scheduleData",
  };
}

function forgotPassword(body) {
  const schema = {
    email: Joi.string().email().required(),
  };
  return Joi.validate(body, schema);
}

exports.Vendor = Vendor;
exports.validateVendorPost = validateVendorPost;
exports.validateVendorLogin = validateVendorLogin;
exports.validateVendorPut = validateVendorPut;
exports.slotLookUp = slotLookUp;
exports.vendorFareAggregate = vendorFareAggregate;
exports.validateChangePassword = validateChangePassword;
exports.venderProjection = venderProjection;
exports.forgotPassword = forgotPassword;
