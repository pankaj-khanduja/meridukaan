const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");
Joi.objectId = require("joi-objectid")(Joi);

const driverAdminLogsSchema = new mongoose.Schema({
  paidBy: { type: String, enum: ["driver", "admin", "user"] },
  paidTo: { type: String, enum: ["driver", "admin", "vendor", "influencer"] },
  paymentAmount: Number,
  userId: String,
  type: { type: String, enum: ["codPayment", "tipPayment", "bulkDriverPayout", "bulkInfluencerPayout", "bulkVendorPayout", "other"] },
  status: { type: String, enum: ["success", "failure", "pending"] },
  otherDetails: {},
  metaData: {},
  paymentType: { type: String, enum: ["card", "others"] },
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
const DriverAdminLogs = mongoose.model("DriverAdminLogs", driverAdminLogsSchema);
function validatePaymentHistory(req) {
  const schema = {
    type: Joi.string().valid("bulkInfluencerPayout", "bulkVendorPayout", "bulkDriverPayout").required(),
    limit: Joi.number(),
    offset: Joi.number(),
    status: Joi.string().valid("success", "failure"),
    text: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string(),
  };
  return Joi.validate(req, schema);
}
function validatePaymentHistoryDetails(req) {
  const schema = {
    type: Joi.string().valid("driver").required(),
    limit: Joi.number(),
    offset: Joi.number(),
    status: Joi.string().valid("success", "failure"),
    text: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string(),
  };
  return Joi.validate(req, schema);
}
exports.DriverAdminLogs = DriverAdminLogs;
exports.validatePaymentHistory = validatePaymentHistory;
