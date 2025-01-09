const Joi = require("joi");
const mongoose = require("mongoose");
Joi.objectId = require("joi-objectid")(Joi);

const pickUpCategorySchema = new mongoose.Schema({
  category: String,
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

const PickUpCategory = mongoose.model("PickUpCategory", pickUpCategorySchema);
function validatePickUpCategory(req) {
  const schema = Joi.object({
    category: Joi.string().required()
  });
  return schema.validate(req);
}

exports.PickUpCategory = PickUpCategory;
exports.validatePickUpCategory = validatePickUpCategory;
