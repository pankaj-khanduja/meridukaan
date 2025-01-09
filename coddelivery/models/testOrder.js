const Joi = require("joi");
const config = require("config");
const mongoose = require("mongoose");
const { Topping, Product } = require("../models/product");
const { FeeAndLimit } = require("./feeAndLimit");

Joi.objectId = require("joi-objectid")(Joi);

// const { array } = require("joi")
const testOrderSchema = new mongoose.Schema({
  flutterwaveRef: { type: String, default: "" },
  flutterwaveId: String,
  orderNo: { type: String },
  mobile: { type: String, default: "" },
  name: { type: String },
  email: { type: String, default: "" },
  appType: { type: String, default: "app" },
  details: { type: Object },
  cardId: String,
  totalAmount: Number,
  cardDetails: { type: Object, default: {} },
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

const TestOrder = mongoose.model("TestOrder", testOrderSchema);

module.exports.TestOrder = TestOrder;
