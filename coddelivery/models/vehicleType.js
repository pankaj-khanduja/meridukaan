const Joi = require("joi");
const mongoose = require("mongoose");
Joi.objectId = require("joi-objectid")(Joi);

const vehicleTypeSchema = new mongoose.Schema({
  vehicle: String,
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
const VehicleType = mongoose.model("VehicleType", vehicleTypeSchema);

function validateVehicleType(req) {
  const schema = Joi.object({
    vehicle: Joi.string().required()
  });
  return schema.validate(req);
}

exports.VehicleType = VehicleType;
exports.validateVehicleType = validateVehicleType;
