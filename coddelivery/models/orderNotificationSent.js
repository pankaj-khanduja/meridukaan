const Joi = require("joi");
const config = require("config");
const mongoose = require("mongoose");
Joi.objectId = require("joi-objectid")(Joi);

const orderNotificationSentSchema = new mongoose.Schema({
  driverIds: [String],
  notificationType: String,
  notificationData: Object,
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

orderNotificationSentSchema.index({ creationDate: 1 }, { expireAfterSeconds: 30 });
const OrderNotificationSent = mongoose.model("OrderNotificationSent", orderNotificationSentSchema);

exports.OrderNotificationSent = OrderNotificationSent;
