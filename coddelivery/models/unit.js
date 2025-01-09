const mongoose = require("mongoose");
const unitSchema = new mongoose.Schema({
  vendorId: String,
  unit: { type: String },
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
const Unit = mongoose.model("Unit", unitSchema);

function validateUnit(unit) {
  const schema = Joi.object({
    unit: Joi.string().min(5).max(50).required()
  });

  return schema.validate(unit);
}

exports.Unit = Unit;

exports.validateUnit = validateUnit;
