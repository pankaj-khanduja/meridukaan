const Joi = require("joi");
const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  userId: String,
  usedReferralCode: String,
  referredBy: String,
  referredTo: String,
  referredByStatus: { type: String, enum: ["active", "redeemed"] },
  status: { type: String, enum: ["active", "redeemed"] },
  type: { type: String, enum: ["signup", "invite"] },
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

const Referral = mongoose.model("referral", referralSchema);

async function getReferralCode(userId) {
  let referralCode = await Referral.aggregate([
    { $match: { userId: userId, status: "active" } },
    { $sort: { insertDate: 1 } },
    { $limit: 1 }
  ]);

  if (referralCode.length) return referralCode[0]._id;
  else return null;
}
function validateAddRemoveReferral(req) {
  const schema = Joi.object({
    applyReferralCode: Joi.boolean().required()
  });
  return schema.validate(req);
}

exports.Referral = Referral;
exports.getReferralCode = getReferralCode;
exports.validateAddRemoveReferral = validateAddRemoveReferral;
