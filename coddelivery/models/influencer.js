const Joi = require("joi");
const config = require("config");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
Joi.objectId = require("joi-objectid")(Joi);

const influencerSchema = new mongoose.Schema({
  name: String,
  email: String,
  profilePic: { type: String, default: "" },
  password: String,
  mobile: String,
  isPaymentGatewayIntegrated: { type: Boolean, default: false },
  code: String,
  isCouponAssigned: { type: Boolean, default: false },
  paymentType: { type: String, enum: ["fixed", "percentage"] },
  paymentValue: Number,
  accessToken: { type: String },
  isDeleted: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "inactive", "deleted", "blocked"], default: "active" },
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

influencerSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ userId: this._id, role: "influencer" }, config.get("jwtPrivateKey"));
  return token;
};
const Influencer = mongoose.model("Influencer", influencerSchema);

function validateInfluencerPost(influencer) {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().required(),
    mobile: Joi.string(),
    profilePic: Joi.string(),
    password: Joi.string().required(),
    paymentType: Joi.string().valid("fixed", "percentage").required(),
    paymentValue: Joi.number().required(),
    // otpToken: Joi.number().required(),
    // verificationType:Joi.string().required()
  });
  return schema.validate(influencer);
}

function validateInfluencerPut(influencer) {
  const schema = Joi.object({
    influencerId: Joi.string(),
    name: Joi.string(),
    email: Joi.string(),
    otpToken: Joi.number(),
    mobile: Joi.string(),
    status: Joi.string().valid("active", "inactive", "deleted", "blocked"),
    profilePic: Joi.string(),
    paymentType: Joi.string().valid("fixed", "percentage"),
    paymentValue: Joi.number(),
  });
  return schema.validate(influencer);
}

function validateInfluencerLogin(influencer) {
  const schema = Joi.object({
    password: Joi.string().min(6).max(255).required(),
    email: Joi.string().min(3).max(255).email(),
    // mobile: Joi.string().min(10).max(13),
  });
  // .xor("email", "mobile")
  return schema.validate(influencer);
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

function forgotPassword(body) {
  const schema = {
    email: Joi.string().email().required(),
  };
  return Joi.validate(body, schema);
}

exports.Influencer = Influencer;
exports.validateInfluencerPost = validateInfluencerPost;
exports.validateInfluencerLogin = validateInfluencerLogin;
exports.validateInfluencerPut = validateInfluencerPut;
exports.validateChangePassword = validateChangePassword;
exports.forgotPassword = forgotPassword;
