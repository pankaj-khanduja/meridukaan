const Joi = require("joi");
const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  userId: String,
  first6Digits: String,
  last4Digits: String,
  nameOnCard: { type: String, minlength: 1, maxlength: 100 },
  cardScheme: { type: String },
  cardType: { type: String },
  expiry: { type: String },
  email: String,
  // expiryMonth: Number,
  // expiryYear: Number,
  // maskedCard: String,
  cardToken: String,
  // stripeCardId: String,
  // stripeCustomerId: String,
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "blocked", "deleted"] },
  redirectUrl: String,

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

const Card = mongoose.model("Card", cardSchema);

function validateCardPost(card) {
  const schema = Joi.object({
    email: Joi.string().min(1).max(40),
    appType: Joi.string(),
    redirectUrl: Joi.string(),
  });
  return schema.validate(card);
}

exports.Card = Card;
exports.validateCardPost = validateCardPost;
