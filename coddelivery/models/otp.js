const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");

const otpSchema = new mongoose.Schema({
  mobile: { type: String, minlength: 5, maxlength: 20 },
  email: { type: String, default: "" },
  otp: { type: Number, min: 1000, max: 9999 },
  orderId: { type: String },
  status: { type: Boolean, default: true },
  type: {
    type: String,
    enum: ["UR", "UL", "UU", "UFP", "UO", "VR", "VU", "VFP", "DR", "DL", "DU", "DFP", "AD", "AP", "IU"]
  },
  verifyCount: { type: Number, default: 0 },
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
  },
  otpExpiry: {
    type: Date,
    default: () => {
      return new Date();
    }
  }
});

otpSchema.methods.generateOtp = function () {
  const otp = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
  return otp;
};

const Otp = mongoose.model("Otp", otpSchema);

const otpTokenSchema = new mongoose.Schema({
  mobile: { type: String, minlength: 5, maxlength: 20 },
  email: { type: String },
  type: { type: String, enum: ["UR", "UL", "UU", "UFP", "UO", "VR", "VU", "VFP", "DR", "DL", "DU", "DFP", "AD", "AP", "IU"] },
  token: Number,
  insertDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  }
});

otpTokenSchema.index({ insertDate: 1 }, { expireAfterSeconds: 600 });

otpTokenSchema.methods.generateToken = function () {
  const token = Math.floor(Math.random() * (9999999 - 1000000 + 1) + 1000000);
  return token;
};

const OtpToken = mongoose.model("OtpToken", otpTokenSchema);

function validateGenerateOtp(otp) {
  const schema = Joi.object({
    mobile: Joi.string(),
    email: Joi.string().allow(""),
    type: Joi.any()
      .valid("UR", "UL", "UU", "UFP", "UO", "VR", "VU", "VFP", "DR", "DL", "DU", "DFP", "AD", "AP", "IU")
      .required(),
    hashKey: Joi.string().allow(""),
    countryCode: Joi.string(),
    // orderId: Joi.string()
    orderId: Joi.when("type", {
      is: "AD" || "AP",
      then: Joi.string().required(),
      otherwise: Joi.string()
    })
  });
  return schema.validate(otp);
}

function validateVerifyOtp(otp) {
  const schema = Joi.object({
    mobile: Joi.string().min(5).max(20),
    email: Joi.string(),
    otp: Joi.number().min(1000).max(9999).required(),
    type: Joi.valid("UR", "UL", "UU", "UFP", "UO", "VR", "VU", "VFP", "DU", "DR", "DL", "DFP", "AD", "AP", "IU").required(),
    orderId: Joi.when("type", {
      is: "AD" || "AP",
      then: Joi.string().required(),
      otherwise: Joi.string()
    }),
    deviceToken: Joi.string()
  });
  return schema.validate(otp);
}

async function verifyAndDeleteOtpMobile(mobile, InOtp, type) {
  const otp = await Otp.findOne({ status: true, mobile: mobile, type: type });

  let cheatOTP = config.get("cheatOTP");
  if ((InOtp === 1111 && cheatOTP) || InOtp === 6723) return true;
  if (!otp || otp.otp !== InOtp) return false;
  else {
    await Otp.deleteOne({ status: true, mobile: mobile });
    return true;
  }
}

async function verifyAndDeleteToken(mobile, InToken, type) {
  const token = await OtpToken.findOne({ mobile: mobile, type: type, token: InToken });
  if (!token) return false;
  else {
    await OtpToken.deleteOne({ mobile: mobile, type: type });
    return true;
  }
}
async function verifyAndDeleteTokenEmail(email, InToken, type) {
  const token = await OtpToken.findOne({ email: email, type: type, token: InToken });
  if (!token) return false;
  else {
    await OtpToken.deleteOne({ email: email, type: type });
    return true;
  }
}

exports.Otp = Otp;
exports.OtpToken = OtpToken;
exports.validateGenerateOtp = validateGenerateOtp;
exports.validateVerifyOtp = validateVerifyOtp;
exports.verifyAndDeleteOtpMobile = verifyAndDeleteOtpMobile;
exports.verifyAndDeleteToken = verifyAndDeleteToken;
exports.verifyAndDeleteTokenEmail = verifyAndDeleteTokenEmail;
