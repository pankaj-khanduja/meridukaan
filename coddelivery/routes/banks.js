const config = require("config");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { identityManager } = require("../middleware/auth");
const _ = require("lodash");
const { getAllBanks } = require("../services/flutterWave");

router.get("/", identityManager(["vendor", "influencer", "admin", "driver"], {}), async (req, res) => {
  let criteria = {};
  let response = await getAllBanks();

  response = response.data;
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
});
module.exports = router;
