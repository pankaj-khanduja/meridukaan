const Joi = require("joi");
const config = require("config");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { func } = require("joi");
Joi.objectId = require("joi-objectid")(Joi);

const storeManagerSchema = new mongoose.Schema({
  storeId: {
    type: String,
    default: "",
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  password: {
    type: String,
  },
  role: {
    type: String,
    enum: ["vendor", "storeManager"],
  },

  isActive: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  mobile: {
    type: String,
  },
  // mobileVerified:{
  //     type:Boolean,
  //     default:false
  // },
  // otpToken:{
  //     type: String
  // },
  accessToken: {
    type: String,
  },
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
storeManagerSchema.methods.generateManagerToken = function () {
  const token = jwt.sign({ userId: this._id, role: "storeManager", email: this.email }, config.get("jwtPrivateKey"));
  return token;
};
storeManagerSchema.methods.generateVendorToken = function () {
  const token = jwt.sign({ userId: this._id, role: "vendor", email: this.email }, config.get("jwtPrivateKey"));
  return token;
};

function validateStoreManagerRegister(storeManager) {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().lowercase().min(6).max(255).required().email(),
    password: Joi.string().min(6).max(255).required(),
    mobile: Joi.string().min(10).max(13),
    role: Joi.string().valid("vendor", "storeManager").required(),
    // store: Joi.string().required(),
    storeId: Joi.when("role", {
      is: "storeManager",
      then: Joi.string().required(),
      otherwise: Joi.forbidden(),
    }),
    // otpToken: Joi.number()

    // verificationType:Joi.string().required()
  });
  return schema.validate(storeManager);
}

function validateStoreManagerLogin(storeManager) {
  const schema = Joi.object({
    password: Joi.string().min(6).max(255).required(),
    email: Joi.string().min(6).max(255).email(),
  });
  return schema.validate(storeManager);
}

function validateStoreManagerPut(storeManager) {
  const schema = Joi.object({
    storeManagerId: Joi.objectId(),
    storeId: Joi.objectId(),
    name: Joi.string(),
    email: Joi.string().lowercase().min(6).email(),
    password: Joi.string().min(6).max(255),
    mobile: Joi.string().min(8).max(14),

    // verificationType:Joi.string().required()
  });
  return schema.validate(storeManager);
}

const StoreManager = mongoose.model("StoreManager", storeManagerSchema);

exports.StoreManager = StoreManager;
exports.validateStoreManagerRegister = validateStoreManagerRegister;
exports.validateStoreManagerPut = validateStoreManagerPut;
exports.validateStoreManagerLogin = validateStoreManagerLogin;
