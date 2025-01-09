const mongoose = require("mongoose");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const config = require("config");
const roleSchema = new mongoose.Schema({
  role: String,
  permissions: {
    dashboard: String,
    merchant: String,
    roles: String,
    users: String,
    invoices: String,
    drivers: String,
    order: String,
    coupon: String,
    banner: String,
    pickDropSettings: String,
    fares: String,
    refund: String,
    influencer: String,
    city: String,
    setting: String,
    audit: String,
    serviceArea: String,
    payout: String,
  },
  status: { type: String, enum: ["active", "inactive", "deleted", "blocked"], default: "active" },
  createdBy: String,
  notEditable: { type: Boolean, default: false },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    },
  },
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    },
  },
});
const Role = mongoose.model("Role", roleSchema);
// roleSchema.createIndex({ role: -1 });
function validateRolePost(req) {
  const schema = Joi.object({
    role: Joi.string().required(),
    permissions: Joi.object({
      dashboard: Joi.string().required(),
      merchant: Joi.string().required(),
      roles: Joi.string().required(),
      users: Joi.string().required(),
      invoices: Joi.string().required(),
      drivers: Joi.string().required(),
      order: Joi.string().required(),
      coupon: Joi.string().required(),
      banner: Joi.string().required(),
      pickDropSettings: Joi.string().required(),
      fares: Joi.string().required(),
      refund: Joi.string().required(),
      influencer: Joi.string().required(),
      city: Joi.string().required(),
      setting: Joi.string().required(),
      audit: Joi.string().required(),
      serviceArea: Joi.string().required(),
      payout: Joi.string().required(),
    }).required(),
  });

  return schema.validate(req);
}

exports.Role = Role;
exports.validateRolePost = validateRolePost;

