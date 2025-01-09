const Joi = require("joi");
const mongoose = require("mongoose");
const fcmLogSchema = new mongoose.Schema({
  token: String,
  tokens: [String],
  typeofFCM: String,
  type: String,
  email: String,
  mobile: String,
  receiverId: { type: String, default: "" },
  receiverIds: [String],
  title: { type: String },
  body: { type: String },
  status: { type: String, enum: ["success", "failed"] },
  payload: Object,
  response: Object,
  messageData: Object,
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    }
  }
});
async function logFcm(token, data, type, mobile, status) {
  let fcmLog = new FcmLog({ token: token, messageData: data, type: type, mobile: mobile, status: status });
  await fcmLog.save();
}
const FcmLog = mongoose.model("FcmLog", fcmLogSchema);
module.exports.FcmLog = FcmLog;
module.exports.logFcm = logFcm;
