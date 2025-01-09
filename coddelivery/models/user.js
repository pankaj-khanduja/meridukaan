const mongoose = require("mongoose");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);
const jwt = require("jsonwebtoken");
const config = require("config");

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Point"],
    required: true,
  },
  coordinates: {
    type: [Number],
    required: true,
  },
});

const UserSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  mobile: { type: String, default: "" },
  email: { type: String, default: "" },
  deletedMobile: { type: String, default: "" },
  deletedEmail: { type: String, default: "" },
  profilePic: { type: String },
  password: { type: String, default: "" },
  deviceToken: { type: String, default: "" },
  accessToken: { type: String, default: "" },
  location: { type: pointSchema },
  address: { type: String },
  cityId: String,
  authType: { type: String, enum: ["google", "apple", "facebook", "app", "web"], default: "app" },
  status: { type: String, enum: ["active", "inactive", "blocked", "suspended", "deleted"] },
  emailVerified: { type: Boolean, default: false },
  facebookId: { type: String },
  googleId: { type: String },
  isOnline: { type: Boolean, default: false },
  // socketId: { type: String, default: "" },
  referralCode: { type: String, default: "" },
  totalReferral: { type: Number, default: 0 },
  lastSeen: {
    type: Date,
    default: () => {
      return new Date();
    },
  },
  appleId: { type: String },
  razorpayCustomerId: { type: String },
  countryCode: { type: String },
  defaultStore: { type: String, default: "" },
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

UserSchema.index({ location: "2dsphere" });

UserSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      userId: this._id,
      role: "user",
    },
    config.get("jwtPrivateKey")
  );
  return token;
};

UserSchema.methods.createReferralCode = async function () {
  let referralCode = this.firstName.substr(0, 3).toLowerCase() + Math.floor(Math.random() * 90000 + 10000);
  let loop = true;
  while (loop) {
    let found = await User.findOne({ referralCode: referralCode });
    if (!found) {
      loop = false;
    } else {
      referralCode = this.firstName.substr(0, 7).toLowerCase().replace(" ", "").substr(0, 3) + Math.floor(Math.random() * 90000 + 10000);
    }
  }
  return referralCode;
};
// UserSchema.index({ locationPoint: "2dsphere" });
// UserSchema.index({ userType: 1, email: 1 }, { unique: true });
const User = mongoose.model("User", UserSchema);

function validateUserPost(user) {
  const schema = Joi.object({
    authType: Joi.string().valid(["app", "google", "facebook", "web"]).required(),
    firstName: Joi.string().max(200).required(),
    lastName: Joi.string().max(200),
    email: Joi.string().email().required(),
    mobile: Joi.string().required(),
    referralCode: Joi.string(),
    countryCode: Joi.string(),
    deviceToken: Joi.string().min(1).max(200),
    otpToken: Joi.number().required(),
  });
  return schema.validate(user);
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
    email: Joi.string().allow(""),
    countryCode: Joi.string(),
    profilePic: Joi.string(),
    // .email()
    // .allow("")
    // .error(() => {
    //   return {
    //     message: "Please enter a valid Email",
    //   };
    // }),
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
      tag: Joi.string().valid("home", "work", "other"),
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
    userId: Joi.objectId(),
    firstName: Joi.string(),
    lastName: Joi.string(),
    mobile: Joi.string(),
    email: Joi.string().min(5).max(40).email().allow(""),
    profilePic: Joi.string(),
    status: Joi.string().valid("active", "inactive", "blocked", "suspended", "deleted"),
    deviceToken: Joi.string(),
    countryCode: Joi.string(),
    defaultStore: Joi.string(),
    cartId: Joi.string(),
    referralCode: Joi.string(),
    otpToken: Joi.number(),
  });
  return schema.validate(user);
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

function validateUserDeletionAuthenticate(user) {
  const schema = Joi.object({
    mobile: Joi.string().required(),
    type: Joi.string().valid("UL"),
    otp: Joi.number().required(),
  });
  return schema.validate(user);
}


function userProjection() {
  return {
    _id: 0,
    userId: "$_id",
    firstName: 1,
    lastName: 1,
    email: 1,
    mobile: 1,
    status: 1,
    address: 1,
    insertDate: 1,
  };
}

module.exports.User = User;
module.exports.validateUserPost = validateUserPost;
module.exports.validateUserLogin = validateUserLogin;
module.exports.validateUserPut = validateUserPut;
module.exports.validateUserSocialPost = validateUserSocialPost;
module.exports.userProjection = userProjection;
module.exports.validateResetMobilePassword = validateResetMobilePassword;
module.exports.validateChangePassword = validateChangePassword;
module.exports.validateUserDeletionAuthenticate = validateUserDeletionAuthenticate;