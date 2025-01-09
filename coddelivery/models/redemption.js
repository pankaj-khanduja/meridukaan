const Joi = require("joi");
const mongoose = require("mongoose");

const redemptionSchema = new mongoose.Schema({
  userId: String,
  couponId: String,
  productId: String,
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

const Redemption = mongoose.model("Redemption", redemptionSchema);

exports.Redemption = Redemption;
