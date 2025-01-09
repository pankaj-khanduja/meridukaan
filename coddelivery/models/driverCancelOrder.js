const Joi = require("joi");
const mongoose = require("mongoose");
const driverCancelOrderSchema = new mongoose.Schema({
  orderId: String,
  driverId: String,
  status: { type: String, enum: ["active", "inactive"], default: "active" },
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
const DriverCancelOrder = mongoose.model("DriverCancelOrder", driverCancelOrderSchema);
exports.DriverCancelOrder = DriverCancelOrder;
