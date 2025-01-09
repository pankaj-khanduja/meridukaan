const Joi = require("joi");
const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema({
  email: String,
  template: String,
  data: Object,
  status: { type: String, enum: ["success", "failure"] },
  messageId: String,
  errorMessage: String,
  errorCode: String,
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

emailLogSchema.index({ creationDate: 1 }, { expireAfterSeconds: 90 * 86400 }); // Delete log after 90 days.

const EmailLog = mongoose.model("EmailLog", emailLogSchema);

module.exports.EmailLog = EmailLog;
