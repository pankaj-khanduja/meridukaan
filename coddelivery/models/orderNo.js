const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");

const orderNoSchema = new mongoose.Schema({
  orderNo: { type: Number, default: 0 },
  payoutNo: { type: Number, default: 0 }
});

const OrderNo = mongoose.model("OrderNo", orderNoSchema);
exports.OrderNo = OrderNo;
