const Joi = require("joi");
const mongoose = require("mongoose");
const apiLogSchema = new mongoose.Schema({
  apiId: String,
  method: String,
  userId: String,
  url: String,
  completeUrl: String,
  baseUrl: String,
  params: Object,
  query: Object,
  email: String,
  role: String,
  subRole: String,
  body: Object,
  startTimeMilli: {
    type: Number,
    default: () => {
      return new Date();
    },
  },
  endTimeMilli: Number,
  responseTimeMilli: { type: Number, default: -1 },
  statusCode: { type: Number, default: -1 },
  message: String,
  errorMessage: String,
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
apiLogSchema.index({ creationDate: 1 }, { expireAfterSeconds: 90 * 86400 });
const ApiLog = mongoose.model("apiLog", apiLogSchema);

module.exports.ApiLog = ApiLog;
