const mongoose = require("mongoose");

const webhookSchema = new mongoose.Schema({
    data: { type: Object },
    type: String,
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

const Webhook = mongoose.model("Webhook", webhookSchema);

exports.Webhook = Webhook;
