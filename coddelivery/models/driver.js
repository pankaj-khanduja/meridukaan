const mongoose = require("mongoose");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);
const jwt = require("jsonwebtoken");
const config = require("config");
const driverSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  mobile: { type: String, default: "" },
  email: { type: String, default: "" },
  deletedMobile: { type: String, default: "" },
  deletedEmail: { type: String, default: "" },
  // password: { type: String, default: "" },
  deviceToken: { type: String, default: "" },
  accessToken: { type: String, default: "" },
  avgRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  assignedStore: [String],
  authType: { type: String, enum: ["google", "apple", "facebook", "app"], default: "app" },
  status: { type: String, enum: ["active", "inactive", "blocked", "suspended", "deleted"] },
  isAcceptingOrders: { type: Boolean, default: false },
  isPaymentGatewayIntegrated: { type: Boolean, default: false },
  flutterwaveId: Number,

  subaccountId: String,
  applicationStatus: { type: String, enum: ["pending", "approved", "rejected"] },
  isDriverApproved: { type: Boolean, default: false },
  isFreezed: { type: Boolean, default: false },
  freezeDriverAt: { type: Number, default: 0 },
  rejectionReason: { type: String, default: "" },
  emailVerified: { type: Boolean, default: false },
  licenseBackImage: { type: String, default: "" },
  licenseFrontImage: { type: String, default: "" },
  vehicleRegistrationFront: { type: String, default: "" },
  vehicleRegistrationBack: { type: String, default: "" },
  driverLicenseExpiryDate: { type: String, default: "" },
  driverLicenseExpiryEpoch: Number,
  vehicleExpiryDate: { type: String },
  vehicleExpiryEpoch: Number,
  // driverToAdminAmt: { type: Number, default: 0 },
  // currentOrder:{type:String,default:""},
  gender: { type: String, enum: ["male", "female", "other"] },
  dateOfBirth: { type: String },
  sendPromotionalNotifications: { type: Boolean, default: true },
  navigationService: { type: String, enum: ["googleMaps", "withInApi", "waze"], default: "googleMaps" },
  vehicleNumber: { type: String, default: "" },
  vehicleModel: { type: String, default: "" },
  vehicleModelNo: String,
  vehicleType: { type: String, default: "" },
  otherDocuments: [String],
  facebookId: { type: String },
  pendingOrders: { type: Number, default: 0 },
  vendorId: String,
  isVendorDriver: { type: Boolean, default: false },
  countryCode: { type: String },
  socketId: { type: String, default: "" },
  lastSeen: {
    type: Date,
    default: () => {
      return new Date();
    },
  },
  isOnline: { type: Boolean, default: false },
  googleId: { type: String },
  profilePic: { type: String },
  appleId: { type: String },
  address: {
    currentAddress: { type: String },
    name: { type: String },
    completeAddress: { type: String },
    landmark: { type: String },
    houseNo: { type: String },
    // tag: { type: String, enum: ["home", "work", "other"] },
    zipcode: { type: String },
  },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  //   defaultStore: { type: String, default: "" },
  isZohoIntegration: { type: Boolean, default: false },

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

driverSchema.index({ location: "2dsphere" });

driverSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      userId: this._id,
      role: "driver",
    },
    config.get("jwtPrivateKey")
  );
  return token;
};
const Driver = mongoose.model("Driver", driverSchema);
const changeRequestSchema = new mongoose.Schema({
  driverId: { type: String },
  applicationStatus: { type: String, enum: ["pending", "rejected", "approved"], default: "pending" },

  licenseBackImage: String,
  licenseFrontImage: String,
  vehicleRegistrationFront: String,
  vehicleRegistrationBack: String,
  driverLicenseExpiryDate: String,
  driverLicenseExpiryEpoch: Number,
  vehicleExpiryDate: String,
  vehicleExpiryEpoch: Number,
  vehicleNumber: String,
  vehicleModel: String,
  vehicleModelNo: String,
  vehicleType: String,
  profilePic: String,
  otherDocuments: [String],

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

const ChangeRequest = mongoose.model("ChangeRequest", changeRequestSchema);

const requestedDriverSchema = new mongoose.Schema({
  driverId: { type: String },
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
requestedDriverSchema.index({ creationDate: 1 }, { expireAfterSeconds: 30 });
const RequestedDriver = mongoose.model("RequestedDriver", requestedDriverSchema);

function validateUserPost(user) {
  const schema = Joi.object({
    authType: Joi.string().valid(["app", "google", "facebook"]),
    firstName: Joi.string().max(200).required(),
    lastName: Joi.string().max(200),

    // password: Joi.string().min(8).max(20).required(),
    email: Joi.string().email(),
    mobile: Joi.string().required(),
    licenseFrontImage: Joi.string().required(),
    licenseBackImage: Joi.string().required(),
    vehicleRegistrationFront: Joi.string().required(),
    vehicleRegistrationBack: Joi.string().allow(""),
    driverLicenseExpiryDate: Joi.string(),
    vehicleExpiryDate: Joi.string(),
    driverLicenseExpiryEpoch: Joi.number(),
    vehicleExpiryEpoch: Joi.number(),
    vehicleNumber: Joi.string(),
    vehicleModel: Joi.string(),
    vehicleType: Joi.string().required(),
    otherDocuments: Joi.array().allow([]),
    countryCode: Joi.string(),
    address: Joi.object({
      currentAddress: Joi.string().required(),
      name: Joi.string().allow(""),
      completeAddress: Joi.string(),
      landmark: Joi.string().allow(""),
      houseNo: Joi.string().allow(""),
    }),
    gender: Joi.string().valid("male", "female", "other"),
    dateOfBirth: Joi.string(),

    location: Joi.array().required(),
    deviceToken: Joi.string().min(1).max(200),
    otpToken: Joi.number().required(),
    profilePic: Joi.string(),
  });
  return schema.validate(user);
}

function validateSetDefaultSubaccount(req) {
  const schema = Joi.object({
    accountId: Joi.objectId().required(),
  });
  return schema.validate(req);
}
function validateAssignMerchant(req) {
  const schema = Joi.object({
    driverId: Joi.objectId().required(),
    vendorId: Joi.objectId().required(),
  });
  return schema.validate(req);
}
function validateUserLogin(user) {
  const schema = Joi.object({
    email: Joi.string().email(),
    mobile: Joi.string(),
    password: Joi.string().min(8).max(255).required(),
    deviceToken: Joi.string().min(1).max(200),
  }).xor("email", "mobile");

  return schema.validate(user);
}
function validateUserSocialPost(req) {
  const schema = Joi.object({
    authType: Joi.string().valid("google", "facebook", "apple").required(),
    name: Joi.string().min(1).max(100).allow(""),
    mobile: Joi.string(),
    email: Joi.string(),
    profilePic: Joi.string(),

    licenseFrontImage: Joi.string(),
    licenseBackImage: Joi.string(),
    vehicleRegistrationFront: Joi.string(),
    vehicleRegistrationBack: Joi.string(),
    driverLicenseExpiryDate: Joi.string(),

    vehicleExpiryDate: Joi.string(),
    vehicleNumber: Joi.string(),
    vehicleModel: Joi.string(),
    vehicleType: Joi.string(),
    otherDocuments: Joi.array(),
    countryCode: Joi.string(),
    facebookId: Joi.when("authType", {
      is: "facebook",
      then: Joi.string().min(1).max(255).required(),
      otherwise: Joi.any(),
    }),
    googleId: Joi.when("authType", {
      is: "google",
      then: Joi.string().min(1).max(255).required(),
      otherwise: Joi.any(),
    }),
    appleId: Joi.when("authType", {
      is: "apple",
      then: Joi.string().min(1).max(255).required(),
      otherwise: Joi.any(),
    }),
    location: Joi.array(),
    address: Joi.object({
      currentAddress: Joi.string().required(),
      name: Joi.string().allow(""),
      completeAddress: Joi.string(),
      //   tag: Joi.string().valid("home", "work", "other"),
      zipcode: Joi.string().allow(""),
    }),
    deviceToken: Joi.string().min(1).max(200),

    // deviceType: Joi.string().valid("android", "ios").required(),
    otpToken: Joi.number(),
  });
  let result = schema.validate(req);
  // if (result.error) result.error.details[0].message = valMsgFormatter(result.error.details[0].message);
  return result;
}

function validateUserPut(user) {
  const schema = Joi.object({
    driverId: Joi.objectId(),
    name: Joi.string(),
    mobile: Joi.string(),
    email: Joi.string().min(5).max(40).email(),
    gender: Joi.string(),
    profilePic: Joi.string(),
    countryCode: Joi.string(),
    status: Joi.string().valid("active", "inactive"),
    navigationService: Joi.string().valid("googleMaps", "withInApi", "waze"),
    sendPromotionalNotifications: Joi.boolean(),
    deviceToken: Joi.string(),
    address: Joi.object({
      currentAddress: Joi.string(),
      name: Joi.string().allow(""),
      completeAddress: Joi.string(),
      zipcode: Joi.string().allow(""),
    }),

    location: Joi.array(),
    // defaultStore: Joi.string(),
    // cartId: Joi.string(),
    otpToken: Joi.number(),
  });
  return schema.validate(user);
}
function validateDocumentUpdate(user) {
  const schema = Joi.object({
    driverId: Joi.objectId(),
    licenseFrontImage: Joi.string(),
    profilePic: Joi.string(),
    licenseBackImage: Joi.string().allow(""),
    vehicleRegistrationFront: Joi.string(),
    vehicleRegistrationBack: Joi.string().allow(""),
    driverLicenseExpiryDate: Joi.string(),
    vehicleExpiryDate: Joi.string(),
    driverLicenseExpiryEpoch: Joi.number(),
    vehicleExpiryEpoch: Joi.number(),
    vehicleNumber: Joi.string(),
    vehicleModel: Joi.string(),
    vehicleType: Joi.string(),
    otherDocuments: Joi.array(),
  });
  return schema.validate(user);
}
function validateBankDetails(req) {
  const schema = Joi.object({
    isPaymentGatewayIntegrated: Joi.boolean(),
    accountBank: Joi.string().required(),
    bankName: Joi.string(),
    accountNumber: Joi.string().required(),
    countryAbbrevation: Joi.string().required(),
    name: Joi.string(),
    email: Joi.string(),
    mobile: Joi.string(),
    metaData: Joi.array(),
  });
  return schema.validate(req);
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

function validateChangePassword(req) {
  const schema = Joi.object({
    oldPassword: Joi.string()
      .min(8)
      .max(255)
      .required()
      .error(() => {
        return { message: "Old password length must be at least 8 characters long" };
      }),
    newPassword: Joi.string()
      .min(8)
      .max(255)
      .required()
      .error(() => {
        return { message: "New password length must be at least 8 characters long" };
      }),
  });
  return schema.validate(req);
}

function validateResetMobilePassword(req) {
  const schema = Joi.object({
    mobile: Joi.string().min(8).max(100).required(),
    newPassword: Joi.string().min(8).max(255).required(),
    otpToken: Joi.number().required(),
  });
  return schema.validate(req);
}

function validatePayCodToAdmin(user) {
  const schema = Joi.object({
    paymentType: Joi.string().valid("card", "others").required(),
    payoutIds: Joi.array().items(Joi.string().required()),
    amount: Joi.number(),
    cardToken: Joi.when("paymentType", {
      is: "card",
      then: Joi.string().required(),
      otherwise: Joi.string(),
    }),
  });

  return schema.validate(user);
}

// function validateResetMobilePassword(req) {
//   const schema = Joi.object({
//     mobile: Joi.string().min(8).max(100).required(),
//     newPassword: Joi.string().min(8).max(255).required(),
//     otpToken: Joi.number().required(),
//   });
//   return schema.validate(req);
// }
// function userProjection() {
//   return {
//     _id: 0,
//     userId: "$_id",
//     name: 1,
//     email: 1,
//     mobile: 1,
//     status: 1,
//     address: 1,
//     insertDate: 1,
//   };
// }

module.exports.Driver = Driver;
module.exports.ChangeRequest = ChangeRequest;
module.exports.RequestedDriver = RequestedDriver;
module.exports.validateUserPost = validateUserPost;
module.exports.validatePayCodToAdmin = validatePayCodToAdmin;
module.exports.validateUserLogin = validateUserLogin;
module.exports.validateAssignMerchant = validateAssignMerchant;
module.exports.validateDocumentUpdate = validateDocumentUpdate;
module.exports.validateUserPut = validateUserPut;
module.exports.validateUserSocialPost = validateUserSocialPost;
module.exports.validateSetDefaultSubaccount = validateSetDefaultSubaccount;
module.exports.validateBankDetails = validateBankDetails;

// module.exports.userProjection = userProjection;
module.exports.validateResetMobilePassword = validateResetMobilePassword;
module.exports.validateChangePassword = validateChangePassword;
