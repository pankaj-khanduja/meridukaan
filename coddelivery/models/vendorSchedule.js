const Joi = require("joi");
const mongoose = require("mongoose");
Joi.objectId = require("joi-objectid")(Joi);

const scheduleSchema = new mongoose.Schema({
  vendorId: String,
  openingTime: String,
  closingTime: String,
  closingTimeInSec: Number,
  openingTimeInSec: Number,
  day: Number,
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

const VendorSchedule = mongoose.model("VendorSchedule", scheduleSchema);

function validateSchedulePost(req) {
  // const schema = Joi.object({
  //   vendorId: Joi.objectId(),
  //   openingTime: Joi.string().required(),
  //   closingTime: Joi.string().required(),
  //   day: Joi.number().required(),
  // });

  // return schema.validate(req);
  const schema = Joi.object({
    vendorId: Joi.string(),
    slots: Joi.array()
      .items(
        Joi.object({
          openingTime: Joi.string().required(),
          closingTime: Joi.string().required(),
          day: Joi.number().required(),
        })
      )
      .min(1),
  });
  return schema.validate(req);
}

function validateSchedulePut(req) {
  const schema = Joi.object({
    slotId: Joi.objectId().required(),
    openingTime: Joi.string(),
    closingTime: Joi.string(),
    day: Joi.number().required(),
  });

  return schema.validate(req);
}
exports.VendorSchedule = VendorSchedule;
exports.validateSchedulePost = validateSchedulePost;
exports.validateSchedulePut = validateSchedulePut;
