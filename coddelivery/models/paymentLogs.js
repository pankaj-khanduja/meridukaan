const Joi = require("joi");
const mongoose = require("mongoose");
const paymentLogSchema = new mongoose.Schema({
    userId: { type: String },
    data: Object,
    type: { type: String, enum: ["chargeWithToken", "voidTransaction", "finalChargeWithToken", "createTransaction", "captureTransaction", "payout"] },
    paymentType: { type: String },
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
const PaymentLog = mongoose.model("PaymentLog", paymentLogSchema);

exports.PaymentLog = PaymentLog;
