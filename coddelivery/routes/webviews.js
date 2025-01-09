const express = require("express");
const router = express.Router();
const { Webview, validateWebviewPost } = require("../models/webview");
const { identityManager } = require("../middleware/auth");
const _ = require("lodash");

router.get("/", async (req, res) => {
  let criteria = {};
  if (req.query.status) criteria.status = req.query.status;
  if (req.query.role) criteria.role = req.query.role;
  let webview = await Webview.find(criteria);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: webview });
});

router.post("/", identityManager(["admin"], {}), async (req, res) => {
  const { error } = validateWebviewPost(req.body);
  if (error)
    return res
      .status(400)
      .send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let valueText = await Webview.findOne({ status: req.body.status, role: req.body.role });
  if (valueText) {
    await Webview.updateOne(
      { status: req.body.status, role: req.body.role },
      { $set: { status: req.body.status, url: req.body.url, docType: req.body.docType, text: req.body.text } }
    );
  } else {
    valueText = new Webview(_.pick(req.body, ["status", "url", "role", "docType", "text"]));
    await valueText.save();
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Webview updated successfully" }
  });
});

module.exports = router;
