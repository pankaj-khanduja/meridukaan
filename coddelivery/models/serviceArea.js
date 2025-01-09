const Joi = require("joi");
const mongoose = require("mongoose");

const serviceAreaSchema = new mongoose.Schema({
  cityId: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  radius: Number,
  areaName: String,
  serviceType: { type: String, enum: ["pickUpAndDrop", "store"] },
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
serviceAreaSchema.index({ location: "2dsphere" });
const ServiceArea = mongoose.model("ServiceArea", serviceAreaSchema);

function validateServiceAreaPost(req) {
  const schema = Joi.object({
    cityId: Joi.objectId().required(),
    radius: Joi.number().required(),
    location: Joi.array().required(),
    areaName: Joi.string().required(),
  });
  return schema.validate(req);
}
function validateServiceAreaPut(req) {
  const schema = Joi.object({
    areaId: Joi.objectId().required(),
    radius: Joi.number().required(),
  });
  return schema.validate(req);
}

async function isPickUpPossible(lon, lat, criteria) {
  console.log("lon,lat,", lon, lat, criteria);
  let data = await ServiceArea.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lon, lat] },
        distanceField: "dist.calculated",
        // maxDistance: config.get("deliveryRadius"),

        query: criteria,
        includeLocs: "dist.location",
        spherical: true,
      },
    },
    {
      $addFields: {
        isDeliveryPossible: {
          $cond: [
            {
              $lte: ["$dist.calculated", { $multiply: ["$radius", 1000] }],
            },
            true,
            false,
          ],
        },
      },
    },
    { $match: { isDeliveryPossible: true } },
    { $sort: { "dist.calculated": 1 } },
    { $limit: 1 },
    {
      $project: {
        cityId: 1,
        _id: 0,
      },
    },
  ]);
  console.log("data[0]", data[0]);
  return data[0];
}

module.exports.validateServiceAreaPost = validateServiceAreaPost;
module.exports.validateServiceAreaPut = validateServiceAreaPut;
module.exports.isPickUpPossible = isPickUpPossible;

module.exports.ServiceArea = ServiceArea;
