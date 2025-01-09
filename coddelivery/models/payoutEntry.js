const Joi = require("joi");
const mongoose = require("mongoose");
const payoutEntrySchema = new mongoose.Schema({
  accumulatedSum: Number,
  payoutNo: Number,
  initialSum: Number,
  codAmount: Number,
  userAmount: Number,
  orderDetails: [],
  userDetails: {},
  otherDetails: {},
  userId: String,
  payoutDay: String,
  parentPayoutId: String,
  retryCount: { type: Number, default: 0 },
  type: { type: String, enum: ["vendor", "driver", "influencer", "codByDriver"] },
  transferId: Number,
  deferredIds: [String],
  isSettled: { type: Boolean, default: false },
  status: {
    type: String,
    enum: [
      "pending",
      "queued",
      "failure",
      "success",
      "halted",
      "retried",
      "deferred",
      "undeferred",
      "completed",
      "awaitingWebhook",
      "settled",
      "partiallySettled"
    ],
    default: "pending"
  },
  // settledAmount: { type: Number, default: 0 },
  failureType: { type: String, enum: ["temporary", "permanent"] },

  settledWith: [String],

  transactionId: [String],
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
const PayoutEntry = mongoose.model("PayoutEntry", payoutEntrySchema);

function validateRetryTransfer(req) {
  const schema = Joi.object({
    payoutId: Joi.string().required()
  });
  return schema.validate(req);
}
function validatePayoutOrders(req) {
  const schema = {
    payoutId: Joi.objectId().required(),
    type: Joi.string().valid("vendor", "influencer", "driver").required()
  };
  return Joi.validate(req, schema);
}
function validatePaymentHistory(req) {
  const schema = {
    type: Joi.string().valid("bulkInfluencerPayout", "bulkVendorPayout", "bulkDriverPayout").required(),
    limit: Joi.number(),
    offset: Joi.number(),
    status: Joi.string().valid("success", "failure"),
    text: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string()
  };
  return Joi.validate(req, schema);
}
function validateDriverPayoutDetails(req) {
  const schema = {
    userId: Joi.objectId().required(),
    limit: Joi.number(),
    offset: Joi.number(),
    text: Joi.string(),
    startDate: Joi.number(),
    endDate: Joi.number(),
    status: Joi.string()
    // payoutId: Joi.objectId().required(),
  };
  return Joi.validate(req, schema);
}
exports.PayoutEntry = PayoutEntry;
exports.validatePaymentHistory = validatePaymentHistory;
exports.validateDriverPayoutDetails = validateDriverPayoutDetails;
exports.validateRetryTransfer = validateRetryTransfer;
exports.validatePayoutOrders = validatePayoutOrders;
