const config = require("config");
const mongoose = require("mongoose");

const locationLogSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  userId: String,
  locationData: {},
  role: String,

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
locationLogSchema.index({ creationDate: 1 }, { expireAfterSeconds: 7 * 86400 });

const LocationLog = mongoose.model("LocationLog", locationLogSchema);
module.exports.LocationLog = LocationLog;
