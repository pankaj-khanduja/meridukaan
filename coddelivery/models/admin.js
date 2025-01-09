const Joi = require("joi");
const jwt = require("jsonwebtoken");
const config = require("config");
const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  accessToken: { type: String, default: "" },
  deviceToken: { type: String, default: "" },
  password: { type: String, default: "" },
  email: { type: String, default: "" },
  role: String,
  subRole: String,
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

adminSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      userId: this._id,
      email: this.email,
      role: "admin",
    },
    config.get("jwtPrivateKey")
  );
  return token;
};

const Admin = mongoose.model("Admin", adminSchema);

function validateAdminLogin(admin) {
  const schema = Joi.object({
    email: Joi.string().min(5).max(255).email().required(),
    password: Joi.string().min(5).max(255).required(),
  });

  return schema.validate(admin);
}

function validateAdminPost(admin) {
  const schema = Joi.object({
    subRole: Joi.string().min(1).max(255).required(),
    password: Joi.string().min(5).max(255).required(),
    email: Joi.string().min(5).max(255).required(),
  });

  return schema.validate(admin);
}
function validateAdminPut(admin) {
  const schema = Joi.object({
    adminId: Joi.objectId().required(),
    subRole: Joi.string().min(1).max(255).required(),
  });

  return schema.validate(admin);
}
// validateRefund;
function validateRefund(admin) {
  const schema = Joi.object({
    orderId: Joi.objectId().required(),
  });

  return schema.validate(admin);
}
function validateUnFreezeDriver(admin) {
  const schema = Joi.object({
    driverId: Joi.objectId().required(),
    freezeDriverAt: Joi.number().required(),
  });

  return schema.validate(admin);
}
function validateDriverApplication(req) {
  const schema = Joi.object({
    driverId: Joi.objectId().required(),
    applicationStatus: Joi.string().valid("approved", "rejected"),
    rejectionReason: Joi.when("applicationStatus", {
      is: "rejected",
      then: Joi.string().required(),
      otherwise: Joi.string(),
    }),
  });
  return schema.validate(req);
}
function validateManualPayout(req) {
  const schema = Joi.object({
    userId: Joi.objectId().required(),
  });
  return schema.validate(req);
}
function validateForgotPassword(body) {
  const schema = {
    email: Joi.string().email().required(),
  };
  return Joi.validate(body, schema);
}
function validateChangePassword(user) {
  const schema = Joi.object({
    oldPassword: Joi.string()
      .min(6)
      .max(255)
      .required()
      .error(() => {
        return {
          message: "Old Password length must be at least 6 characters long...",
        };
      }),
    newPassword: Joi.string()
      .min(6)
      .max(255)
      .required()
      .error(() => {
        return {
          message: "New Password length must be at least 6 characters long",
        };
      }),
  });
  return schema.validate(user);
}
module.exports.Admin = Admin;
module.exports.validateAdminLogin = validateAdminLogin;
module.exports.validateRefund = validateRefund;
module.exports.validateUnFreezeDriver = validateUnFreezeDriver;
module.exports.validateDriverApplication = validateDriverApplication;
module.exports.validateManualPayout = validateManualPayout;
module.exports.validateAdminPost = validateAdminPost;
module.exports.validateAdminPut = validateAdminPut;
module.exports.validateForgotPassword = validateForgotPassword;
module.exports.validateChangePassword = validateChangePassword;
