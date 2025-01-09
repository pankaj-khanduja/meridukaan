const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const config = require("config");
const { PickUpCategory, validatePickUpCategory } = require("../models/pickUpCategory");
const { OTHER_CONSTANTS } = require("../config/constant.js");
const { identityManager } = require("../middleware/auth");

router.post("/", identityManager(["admin"], { pickDropSettings: "W" }), async (req, res) => {
  const { error } = validatePickUpCategory(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let pickUpCategory = await PickUpCategory.findOne({ category: req.body.category.toLowerCase() });
  if (pickUpCategory) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.PICK_UP_CAT_ALREADY_EXISTS },
    });
  }
  pickUpCategory = new PickUpCategory({});
  pickUpCategory.category = req.body.category.toLowerCase();
  await pickUpCategory.save();
  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: OTHER_CONSTANTS.PICK_UP_CAT_CREATED },
  });
});

router.get("/", identityManager(["admin", "user", "public"], { pickDropSettings: "W" }), async (req, res) => {
  let criteria = {};
  if (req.query.pickUpCategoryId) {
    criteria._id = mongoose.Types.ObjectId(req.query.pickUpCategoryId);
  }
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.category = regexName;
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);
  let pickUpCategory = await PickUpCategory.aggregate([
    {
      $match: criteria,
    },
    {
      $sort: { category: 1 },
    },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        pickUpCategoryId: "$_id",
        category: 1,
        _id: 0,
      },
    },
  ]);
  let totalCount = await PickUpCategory.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, pickUpCategory },
  });
});

router.delete("/:id", identityManager(["admin"], { pickDropSettings: "W" }), async (req, res) => {
  let pickUpCategory = await PickUpCategory.findOne({ _id: req.params.id });
  if (!pickUpCategory)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTHER_CONSTANTS.PICK_UP_CAT_NOT_FOUND },
    });
  await PickUpCategory.deleteOne({ _id: req.params.id });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: OTHER_CONSTANTS.PICK_UP_CAT_DELETED },
  });
});
module.exports = router;
