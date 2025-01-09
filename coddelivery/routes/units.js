const { UNIT_CONSTANTS } = require("../config/constant.js");
const { Unit } = require("../models/unit");
const config = require("config");
const { PayoutEntry } = require("../models/payoutEntry");
const express = require("express");
const { identityManager } = require("../middleware/auth");
const router = express.Router();

/*******************Unit ENDPOINTS*******************************/

router.post("/", identityManager(["vendor"]), async (req, res) => {
  let unit = await Unit.findOne({ unit: req.body.unit.toLowerCase(), vendorId: req.jwtData.userId });
  if (!unit) {
    unit = new Unit({ unit: req.body.unit.toLowerCase() });
    unit.vendorId = req.jwtData.userId;
    await unit.save();
  }

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { unit },
  });
});

router.get("/", identityManager(["vendor", "admin"]), async (req, res) => {
  let criteria = {};
  if (req.jwtData.role == "vendor") criteria.vendorId = req.jwtData.userId;
  let unit = await Unit.find(criteria).select({
    _id: 0,
    unitId: "$_id",
    unit: 1,
  });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { unit },
  });
});

// router.put("/", identityManager(["admin"]), async (req, res) => {
//   let unit = await Unit.findByIdAndUpdate(req.body.id, { unit: req.body.unit }, { new: true });
//   if (!unit)
//     return res.status(400).send({
//       apiId: req.apiId,
//       statusCode: 400,
//       message: "Failure",
//       data: { message: UNIT_CONSTANTS.UNIT_NOT_FOUND },
//     });

//   res.status(200).send({
//     apiId: req.apiId,
//     statusCode: 200,
//     message: "Success",
//     data: { message: UNIT_CONSTANTS.UNIT_UPDATE, updatedDoc: unit },
//   });
// });

router.delete("/:id", identityManager(["admin", "vendor"]), async (req, res) => {
  let unit = await Unit.findOne({ _id: req.params.id, vendorId: req.jwtData.userId });
  if (!unit)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: _CONSTANTS.UNIT_NOT_FOUND },
    });
  await Unit.deleteOne({ _id: req.params.id });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: UNIT_CONSTANTS.UNIT_DELETED, deletedDoc: unit },
  });
});

router.get("/testApi", async (req, res) => {
  if (req.query.response == "true") {
    res.send("ok");
  } else {
  }
});

module.exports = router;
