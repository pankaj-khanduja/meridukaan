const Joi = require("joi");
const mongoose = require("mongoose");
const activitySchema = new mongoose.Schema({
  userId: { type: String },
  //   userBy: { type: String, default: "" },
  data: Object,
  isRead: { type: Boolean, default: false },
  type: { type: String, enum: ["paidToAdmin", "paidByAdmin", "documentApproved", "documentRejected", "tipPaidByUser"] },
  //   status: { type: String, enum: ["pending", "active"] },

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
const Activity = mongoose.model("Activity", activitySchema);

exports.Activity = Activity;
