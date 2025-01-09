const { VERSION_CONSTANT } = require("../config/constant.js");
const config = require("config");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { identityManager } = require("../middleware/auth");
const _ = require("lodash");
const { Version, validateAppVersionPost } = require("../models/appVersion");

router.post("/", identityManager(["user", "admin"], {}), async (req, res) => {
  const { error } = validateAppVersionPost(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  let version = await Version.findOne({ appType: req.body.appType, app: req.body.app });
  if (!version) {
    version = new Version(
      _.pick(req.body, [
        "major",
        "minor",
        "patch",
        "appType",
        "app",
        "forceUpdateTitle",
        "forceUpdateMessage",
        "optionalUpdateTitle",
        "optionalUpdateMessage",
        "updateType",
        "showAppMaintainace",
        "isStickOnScreen",
        "appMaintainanceMesageTitle",
        "appMaintainanceMesageBody",
        "isShowImage",
        "imageUrl",
        "appStoreUrl",
        "playStoreUrl",
      ])
    );
  } else {
    version.major = req.body.major;
    version.minor = req.body.minor;
    version.patch = req.body.patch;
    version.forceUpdateTitle = req.body.forceUpdateTitle;
    version.forceUpdateMessage = req.body.forceUpdateMessage;
    version.optionalUpdateTitle = req.body.optionalUpdateTitle;
    version.optionalUpdateMessage = req.body.optionalUpdateMessage;
    version.updateType = req.body.updateType;
    version.showAppMaintainace = req.body.showAppMaintainace;
    version.isStickOnScreen = req.body.isStickOnScreen;
    version.appMaintainanceMesageTitle = req.body.appMaintainanceMesageTitle;
    version.appMaintainanceMesageBody = req.body.appMaintainanceMesageBody;
    version.isShowImage = req.body.isShowImage;
    version.imageUrl = req.body.imageUrl;
    version.appStoreUrl = req.body.appStoreUrl;
    version.playStoreUrl = req.body.playStoreUrl;
  }
  await version.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VERSION_CONSTANT.SUBMIT_SUCCESS },
  });
});

router.get("/check", identityManager(["user", "public"]), async (req, res) => {
  let respObj = {};

  respObj.optionalUpdate = false;
  respObj.forceUpdate = false;
  respObj.forceUpdateTitle = "";
  respObj.forceUpdateMessage = "";
  respObj.optionalUpdateTitle = "";
  respObj.optionalUpdateMessage = "";
  respObj.showAppMaintainace = false;
  respObj.isStickOnScreen = false;
  respObj.appMaintainanceMesageTitle = "";
  respObj.appMaintainanceMesageBody = "";
  respObj.isShowImage = false;
  respObj.imageUrl = "";
  respObj.appStoreUrl = "";
  respObj.playStoreUrl = "";

  if (!req.query.v) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { optionalUpdate: false, forceUpdate: false, message: VERSION_CONSTANT.VERSION_MANDATORY },
    });
  } else if (!req.query.appType) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { optionalUpdate: false, forceUpdate: false, message: VERSION_CONSTANT.APPTYPE_MANDATORY },
    });
  } else if (!req.query.app) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { optionalUpdate: false, forceUpdate: false, message: VERSION_CONSTANT.APP_MANDATORY },
    });
  }

  let versionArray = req.query.v.split(".");
  console.log("versionArray :", versionArray);

  let major = 0;
  let minor = 0;
  let patch = 0;
  if (versionArray[0]) major = parseInt(versionArray[0]);
  if (versionArray[1]) minor = parseInt(versionArray[1]);
  if (versionArray[2]) patch = parseInt(versionArray[2]);

  if (isNaN(major)) return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: respObj });
  else if (isNaN(minor)) return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: respObj });
  else if (isNaN(patch)) {
    return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: respObj });
  }

  let flag = 0; // Flag 1 -> mandatory . Flag 2 -> Recommended.
  let latestVersionList = await Version.aggregate([{ $match: { appType: req.query.appType, app: req.query.app } }, { $sort: { insertDate: -1 } }, { $limit: 1 }]);

  if (!latestVersionList.length) {
    return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: respObj });
  }

  let latestVersion = latestVersionList[0];

  if (major < latestVersion.major) {
    flag = 1;
  } else if (minor < latestVersion.minor) {
    if (latestVersion.updateType == "minor" || latestVersion.updateType == "patch") {
      flag = 1;
    } else {
      flag = 2;
    }
  } else if (patch < latestVersion.patch) {
    if (latestVersion.updateType == "patch") {
      flag = 1;
    } else {
      flag = 2;
    }
  }
  if (flag == 1) {
    respObj.optionalUpdate = false;
    respObj.forceUpdate = true;
    respObj.forceUpdateTitle = latestVersion.forceUpdateTitle;
    respObj.forceUpdateMessage = latestVersion.forceUpdateMessage;
    respObj.optionalUpdateTitle = latestVersion.optionalUpdateTitle;
    respObj.optionalUpdateMessage = latestVersion.optionalUpdateMessage;
    respObj.showAppMaintainace = latestVersion.showAppMaintainace;
    respObj.isStickOnScreen = latestVersion.isStickOnScreen;
    respObj.appMaintainanceMesageTitle = latestVersion.appMaintainanceMesageTitle;
    respObj.appMaintainanceMesageBody = latestVersion.appMaintainanceMesageBody;
    respObj.isShowImage = latestVersion.isShowImage;
    respObj.imageUrl = latestVersion.imageUrl;
    respObj.appStoreUrl = latestVersion.appStoreUrl;
    respObj.playStoreUrl = latestVersion.playStoreUrl;
  }
  if (flag == 2) {
    respObj.optionalUpdate = true;
    respObj.forceUpdate = false;
    respObj.forceUpdateTitle = latestVersion.forceUpdateTitle;
    respObj.forceUpdateMessage = latestVersion.forceUpdateMessage;
    respObj.optionalUpdateTitle = latestVersion.optionalUpdateTitle;
    respObj.optionalUpdateMessage = latestVersion.optionalUpdateMessage;
    respObj.showAppMaintainace = latestVersion.showAppMaintainace;
    respObj.isStickOnScreen = latestVersion.isStickOnScreen;
    respObj.appMaintainanceMesageTitle = latestVersion.appMaintainanceMesageTitle;
    respObj.appMaintainanceMesageBody = latestVersion.appMaintainanceMesageBody;
    respObj.isShowImage = latestVersion.isShowImage;
    respObj.imageUrl = latestVersion.imageUrl;
    respObj.appStoreUrl = latestVersion.appStoreUrl;
    respObj.playStoreUrl = latestVersion.playStoreUrl;
  }

  respObj.showAppMaintainace = latestVersion.showAppMaintainace;
  respObj.isStickOnScreen = latestVersion.isStickOnScreen;
  respObj.appMaintainanceMesageTitle = latestVersion.appMaintainanceMesageTitle;
  respObj.appMaintainanceMesageBody = latestVersion.appMaintainanceMesageBody;
  respObj.isShowImage = latestVersion.isShowImage;
  respObj.imageUrl = latestVersion.imageUrl;
  respObj.appStoreUrl = latestVersion.appStoreUrl;
  respObj.playStoreUrl = latestVersion.playStoreUrl;

  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: respObj });
});

router.get("/list", identityManager(["user", "admin"], {}), async (req, res) => {
  let versionList = await Version.find({});
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { versionList } });
});

module.exports = router;
