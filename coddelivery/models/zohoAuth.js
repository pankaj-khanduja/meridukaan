const mongoose = require("mongoose");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);
const jwt = require("jsonwebtoken");
const config = require("config");

const ZohoAuthSchema = new mongoose.Schema({
  accessToken: { type: String, default: "" },
  tokenType: { type: String, default: "" },
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

const ZohoAuth = mongoose.model("ZohoAuth", ZohoAuthSchema);

module.exports.ZohoAuth = ZohoAuth;
