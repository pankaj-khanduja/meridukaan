const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");

const smsMultiSchema = new mongoose.Schema({
  mobile: { type: String, default: "" },
  countryCode: { type: String },
  msgId: { type: String },
  type: { type: String, enum: ["otp", "pickUpAmount"] },
  status: { type: String },
  message: { type: String },
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

const SmsMulti = mongoose.model("SmsMulti", smsMultiSchema);

exports.SmsMulti = SmsMulti;
