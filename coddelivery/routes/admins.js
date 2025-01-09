const {
  USER_CONSTANTS,
  VENDOR_CONSTANTS,
  STORE_CONSTANTS,
  DRIVER_CONSTANTS,
  ADMIN_CONSTANTS,
  OTHER_CONSTANTS,
  ORDER_CONSTANTS,
  SUBACCOUNT_CONSTANTS,
  AUTH_CONSTANTS,
  MIDDLEWARE_AUTH_CONSTANTS,
} = require("../config/constant.js");
const config = require("config");
const bcrypt = require("bcrypt");
const _ = require("lodash");

const {
  Admin,
  validateAdminLogin,
  validateDriverApplication,
  validateRefund,
  validateUnFreezeDriver,
  validateManualPayout,
  validateAdminPost,
  validateAdminPut,
  validateForgotPassword,
  validateChangePassword,
} = require("../models/admin");
const { Vendor, Store } = require("../models/vendor");
const { User } = require("../models/user");
const { sendTemplateEmail } = require("../services/amazonSes");

const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { Driver, ChangeRequest } = require("../models/driver");
const { sendFCM } = require("../services/fcmModule");
const { Activity } = require("../models/activity");
const sgMail = require("@sendgrid/mail");
const { identityManager } = require("../middleware/auth");
const { FeeAndLimit, validateCharges, VehicleType, PickUpCategory, validateVehicleType, validatePickUpCategory, validateChargesCityWise } = require("../models/feeAndLimit.js");
const { Order } = require("../models/order.js");
// const { verifyTransaction, refundTransaction, manualPayout, voidTransaction } = require("../services/flutterWave");
const { refundTransaction } = require("../services/razorPayFunctions.js");

const FLUTTER_SECRET_KEY = config.get("secretKey");

const { calculateTime } = require("../services/commonFunctions");
const { City } = require("../models/city.js");
const { Subaccount } = require("../models/subaccount.js");

sgMail.setApiKey(config.get("sendGridApiKey"));
mongoose.set("debug", true);
//=====show admins====
router.get("/", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  let criteria = {};
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.email = regexName;
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.subRole) {
    criteria.subRole = req.query.subRole.toLowerCase();
  }
  if (req.query.adminId) {
    criteria._id = mongoose.Types.ObjectId(req.query.adminId);
  }
  let roleList = await Admin.aggregate([
    { $match: criteria },
    { $lookup: { from: "roles", localField: "subRole", foreignField: "role", as: "roleData" } },

    { $sort: { insertDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        adminId: "$_id",
        email: 1,
        insertDate: 1,
        role: 1,
        subRole: 1,
        status: 1,
        permissions: { $arrayElemAt: ["$roleData.permissions", 0] },
        _id: 0,
      },
    },
  ]);
  let totalCount = await Admin.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, roleList },
  });
});

router.post("/", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  const { error } = validateAdminPost(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  // if (req.userData.subRole != "all") {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: MIDDLEWARE_AUTH_CONSTANTS.RESOURCE_FORBIDDEN },
  //   });
  // }
  let admin = await Admin.findOne({ email: req.body.email.toLowerCase() });
  if (admin) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADMIN_CONSTANTS.EMAIL_ALREADY_EXISTS },
    });
  }
  admin = new Admin({ email: req.body.email.toLowerCase(), subRole: req.body.subRole.toLowerCase(), role: "admin" });
  admin.password = await bcrypt.hash(req.body.password, config.get("bcryptSalt"));
  await admin.save();
  admin.adminId = admin._id.toString();
  let link = config.get("admin_link");
  let data = {
    name: "  ",
    email: admin.email,
    password: req.body.password,
    link: link,
  };
  // console.log("Data", data);
  await sendTemplateEmail(data.email, data, "sendEmailPassword");
  let response = _.pick(admin, ["adminId", "email", "subrole"]);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

router.put("/", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  const { error } = validateAdminPut(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let admin = await Admin.findOne({ _id: req.body.adminId });
  if (!admin) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADMIN_CONSTANTS.NOT_FOUND },
    });
  }
  admin.subRole = req.body.subRole.toLowerCase() || admin.subRole;
  await admin.save();
  admin.adminId = admin._id.toString();
  let response = _.pick(admin, ["adminId", "email", "subrole"]);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});
router.delete("/:id", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  let admin = await Admin.findOne({ _id: req.params.id });
  if (!admin)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADMIN_CONSTANTS.NOT_FOUND },
    });
  await Admin.deleteOne({ _id: req.params.id });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADMIN_CONSTANTS.DELETED },
  });
});
router.post("/forgotPassword", async (req, res) => {
  const { error } = validateForgotPassword(req.body);
  if (error) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let email = req.body.email.toLowerCase();
  let admin = await Admin.findOne({ email: email });
  if (!admin) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: "This email is not registered" } });
  let length = 8;
  let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  var encryptPassword = await bcrypt.hash(password, config.get("bcryptSalt"));
  admin.password = encryptPassword;
  await Admin.updateOne({ _id: admin._id }, { $set: { password: admin.password } });
  await sendTemplateEmail(
    admin.email,
    {
      name: admin.name || "",
      email: admin.email,
      password: password,
      iconUrl: config.get("logo"),
      loginUrl: config.get("admin_link"),
      color: "#1a76d2",
      projectName: "waivedelivery",
    },
    "forgotPassword"
  );
  return res.send({ statusCode: 200, message: "Success", data: { message: ADMIN_CONSTANTS.PASSWORD_SENT_TO_EMAIL } });
});

//change password
router.post("/password/change/", identityManager(["admin"]), async (req, res) => {
  const { error } = validateChangePassword(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let admin = await Admin.findById(req.jwtData.userId);
  if (!admin)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });

  const validPassword = await bcrypt.compare(req.body.oldPassword, admin.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.PASSWORD_MISMATCH },
    });

  let encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  admin.password = encryptPassword;

  await admin.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.PASSWORD_CHANGE_SUCCESS },
  });
});

//admin login
router.post("/login", async (req, res) => {
  const { error } = validateAdminLogin(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let admin = await Admin.findOne({ email: req.body.email });
  if (!admin)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: USER_CONSTANTS.INVALID_CREDENTIALS },
    });

  const validPassword = await bcrypt.compare(req.body.password, admin.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: USER_CONSTANTS.INVALID_PASSWORD },
    });

  const token = admin.generateAuthToken();
  admin.accessToken = token;
  admin.deviceToken = req.body.deviceToken;
  await admin.save();
  let criteria = {};
  criteria._id = mongoose.Types.ObjectId(admin._id);
  let response = await Admin.aggregate([
    { $match: criteria },
    { $lookup: { from: "roles", localField: "subRole", foreignField: "role", as: "roleData" } },

    { $sort: { insertDate: -1 } },

    {
      $project: {
        adminId: "$_id",
        email: 1,
        insertDate: 1,
        role: 1,
        subRole: 1,
        status: 1,
        permissions: { $arrayElemAt: ["$roleData.permissions", 0] },
        _id: 0,
      },
    },
  ]);

  res.header("Authorization", token).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: USER_CONSTANTS.LOGGED_IN, response },
  });
});

router.post("/refundOrder", identityManager(["admin"], { refund: "W" }), async (req, res) => {
  const { error } = validateRefund(req.body);
  if (error) {
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let order = await Order.findOne({ _id: req.body.orderId, vendorCategory: { $ne: "" } });
  if (!order) {
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND },
    });
  }
  let data = {};
  let response;
  if (order.vendorCategory != "pickUpAndDrop") {
    // order.isRefundToVerified = true;
    data.paymentId = order.razorpay_payment_id;
    data.orderId = req.body.orderId;
    data.amount = order.totalAmount;
    response = await refundTransaction(data);
  }

  console.log("************************************", response);
  // console.log("response", response);
  // "statusCode": 400,
  // response.statusCode==200, response.data == success
  console.log("response.status", response.statusCode);
  if (response.statusCode != 200) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ADMIN_CONSTANTS.REFUND_FAILED, response },
    });
  }

  if (order.vendorCategory != "pickUpAndDrop") {
    order.isRefundToVerified = true;
    order.isRefundPending = false;
    order.refundId = response.data.id;
    let status;
    status = response.data.status;
    if (response.data.status === "processed") {
      status = "Refunded"
    }
    order.orderRefundStatus = status;
  } else {
    order.isRefundToVerified = false;
    order.isRefundPending = false;
  }

  await order.save();
  let user = await User.findOne({ _id: order.userId });
  if (user && user.deviceToken != "") {
    let data = {
      type: "orderRefund",
    };
    await sendFCM(user.deviceToken, data, "orderRefund");
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADMIN_CONSTANTS.ORDER_REFUNDED_SUCCESSFULLY },
  });
});

router.post("/manualVendorPayout", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  const { error } = validateManualPayout(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let currentTime = Math.round(new Date() / 1000);
  let criteria = {};
  criteria.vendorId = req.body.userId;
  criteria.isOrderAmtPaidToVendor = false;
  criteria.orderStatus = "DELIVERED";
  criteria.deliveredAt = { $lt: currentTime };

  let orders = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: {
        _id: "$vendorId",
        total: {
          $sum: "$vendorAmount",
        },
      },
    },
  ]);
  console.log("orders", orders);
  let subaccount = await Subaccount.findOne({ userId: req.body.userId, isDefault: true });
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
    });
  }
  console.log("subaccount", subaccount.bankName);
  let dataObj = {};

  dataObj.account_bank = subaccount.bankName;
  dataObj.account_number = subaccount.accountNumber;
  dataObj.narration = config.get("simpleTransfer");
  dataObj.currency = config.get("currency");
  dataObj.seckey = FLUTTER_SECRET_KEY;
  dataObj.amount = orders[0].total;
  dataObj.reference = "mk-902837-jk";
  let response = await manualPayout(dataObj);
  console.log("response", response);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

router.post("/manualDriverPayout", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  const { error } = validateManualPayout(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let currentTime = Math.round(new Date() / 1000);
  let criteria = {};
  criteria.driverId = req.body.userId;
  criteria.isOrderAmtPaidToDriver = false;
  criteria.orderStatus = "DELIVERED";
  criteria.deliveredAt = { $lt: currentTime };

  let orders = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $group: {
        _id: "$driverId",
        total: {
          $sum: "$vendorAmount",
        },
      },
    },
  ]);
  console.log("orders", orders);
  let subaccount = await Subaccount.findOne({ userId: req.body.userId, isDefault: true });
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
    });
  }
  console.log("subaccount", subaccount);
  let dataObj = {};

  dataObj.account_bank = subaccount.bankName;
  dataObj.account_number = subaccount.accountNumber;
  dataObj.narration = config.get("simpleTransfer");
  dataObj.currency = config.get("currency");
  dataObj.seckey = FLUTTER_SECRET_KEY;
  dataObj.amount = orders[0].total;
  let response = await manualPayout(dataObj);
  console.log("response", response);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

router.post("/unFreezeDriver", identityManager(["admin"], { drivers: "W" }), async (req, res) => {
  const { error } = validateUnFreezeDriver(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let driver = await Driver.findOne({ _id: req.body.driverId, isFreezed: true });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DRIVER_NOT_FOUND },
    });
  driver.freezeDriverAt = req.body.freezeDriverAt;
  driver.isFreezed = false;
  await driver.save();
  if (driver && driver.deviceToken != "") {
    let data = {
      type: "driverUnfreezed",
    };
    await sendFCM(driver.deviceToken, data, "driverUnfreezed");
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: DRIVER_CONSTANTS.DRIVER_UNFREEZED_SUCCESS },
  });
});

router.put("/driverApplications", identityManager(["admin"], { drivers: "W" }), async (req, res) => {
  const { error } = validateDriverApplication(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let driver = await Driver.findOne({ _id: req.body.driverId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DRIVER_NOT_FOUND },
    });

  let changeRequest = await ChangeRequest.findOne({ driverId: req.body.driverId, applicationStatus: "pending" });
  console.log("chaangeeee", changeRequest, req.body.applicationStatus, driver.applicationStatus);
  if (req.body.applicationStatus == "approved") {
    driver.isDriverApproved = true;

    let activity = new Activity({});
    activity.userId = req.body.driverId;
    activity.type = "documentApproved";
    await activity.save();
  } else {
    driver.rejectionReason = req.body.rejectionReason;
    let activity = new Activity({});
    activity.userId = req.body.driverId;
    activity.type = "documentRejected";
    await activity.save();
  }
  if (changeRequest) {
    if ((changeRequest && req.body.applicationStatus == "approved") || (changeRequest && driver.applicationStatus != "approved")) {
      driver.licenseFrontImage = changeRequest.licenseFrontImage || driver.licenseFrontImage;
      driver.licenseBackImage = changeRequest.licenseBackImage || driver.licenseBackImage;
      driver.vehicleRegistrationFront = changeRequest.vehicleRegistrationFront || driver.vehicleRegistrationFront;
      driver.vehicleRegistrationBack = changeRequest.vehicleRegistrationBack || driver.vehicleRegistrationBack;
      driver.driverLicenseExpiryDate = changeRequest.driverLicenseExpiryDate || driver.driverLicenseExpiryDate;
      driver.vehicleExpiryDate = changeRequest.vehicleExpiryDate || driver.vehicleExpiryDate;
      driver.vehicleExpiryEpoch = changeRequest.vehicleExpiryEpoch || driver.vehicleExpiryEpoch;
      driver.driverLicenseExpiryEpoch = changeRequest.driverLicenseExpiryEpoch || driver.driverLicenseExpiryEpoch;

      driver.vehicleNumber = changeRequest.vehicleNumber || driver.vehicleNumber;
      driver.vehicleModel = changeRequest.vehicleModel || driver.vehicleModel;
      driver.vehicleModelNo = changeRequest.vehicleModelNo || driver.vehicleModelNo;
      driver.vehicleType = changeRequest.vehicleType || driver.vehicleType;
      driver.otherDocuments = changeRequest.otherDocuments || driver.otherDocuments;
      driver.profilePic = changeRequest.profilePic || driver.profilePic;
      if (req.body.applicationStatus == "approved") {
        driver.applicationStatus = req.body.applicationStatus || driver.applicationStatus;
      }
      changeRequest.applicationStatus = req.body.applicationStatus;

      await driver.save();
      await changeRequest.save();

      let data = {
        type: "documentStatus",
        status: req.body.applicationStatus,
        driverId: driver._id.toString(),
      };

      if (driver && driver.deviceToken != "") {
        await sendFCM(driver.deviceToken, data, "documentStatus");
      }

      return res.send({
        apiId: req.apiId,
        statusCode: 200,
        message: "Success",
        data: { message: ADMIN_CONSTANTS.APPLICATION_UPDATED, driver },
      });
      //to do fcm
    } else if (req.body.applicationStatus === "rejected") {
      changeRequest.applicationStatus = req.body.applicationStatus;
      await changeRequest.save();
      let data = {
        type: "documentStatus",
        status: req.body.applicationStatus,
        driverId: driver._id.toString(),
      };
      if (driver && driver.deviceToken != "") {
        await sendFCM(driver.deviceToken, data, "documentStatus");
      }
      return res.send({
        apiId: req.apiId,
        statusCode: 200,
        message: "Success",
        data: { message: ADMIN_CONSTANTS.APPLICATION_UPDATED, driver },
      });
    }
  }
  driver.applicationStatus = req.body.applicationStatus || driver.applicationStatus;

  await driver.save();
  let data = {
    type: "documentStatus",
    status: req.body.applicationStatus,
    driverId: driver._id.toString(),
  };

  if (driver && driver.deviceToken != "") {
    await sendFCM(driver.deviceToken, data, "documentStatus");
  }
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ADMIN_CONSTANTS.APPLICATION_UPDATED, driver },
  });
});

router.get("/documentChangeRequests", identityManager(["admin"], { drivers: "W" }), async (req, res) => {
  var criteria = {};
  var criteria1 = {};

  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.text) {
    var terms = req.query.text.split(" ");

    var regexName = new RegExp(terms[0], "i");

    var regexName1 = new RegExp(terms[1], "i");
    if (terms.length === 1 || terms[1] === "") {
      criteria1 = {
        $or: [{ driverFirstName: regexName }, { driverLastName: regexName }, { email: regexName }, { mobile: regexName }],
      };
    } else {
      criteria1 = { $and: [{ driverFirstName: regexName }, { driverLastName: regexName1 }] };
    }
  }
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  console.log("criteria1", criteria1);
  if (req.query.status) {
    criteria.applicationStatus = req.query.status;
  } else criteria.applicationStatus = "pending";
  if (req.query.driverId) {
    criteria.driverId = req.query.driverId;
  }
  let requestList = await ChangeRequest.aggregate([
    {
      $match: criteria,
    },
    { $addFields: { driverId: { $toObjectId: "$driverId" } } },
    {
      $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" },
    },

    {
      $addFields: {
        driverFirstName: { $arrayElemAt: ["$driverData.firstName", 0] },

        driverLastName: { $arrayElemAt: ["$driverData.lastName", 0] },
        mobile: { $arrayElemAt: ["$driverData.mobile", 0] },
        email: { $arrayElemAt: ["$driverData.email", 0] },
      },
    },
    { $match: criteria1 },
    {
      $facet: {
        allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],
        paginatedDocs: [
          { $skip: skipVal },
          { $limit: limitVal },
          {
            $project: {
              driverId: 1,
              licenseBackImage: 1,
              licenseFrontImage: 1,
              vehicleRegistrationFront: 1,
              vehicleRegistrationBack: 1,
              driverLicenseExpiryDate: 1,
              driverLicenseExpiryEpoch: 1,
              vehicleExpiryDate: 1,
              vehicleExpiryEpoch: 1,
              vehicleNumber: 1,
              vehicleModel: 1,
              vehicleModelNo: 1,
              vehicleType: 1,
              profilePic: 1,
              otherDocuments: 1,
              applicationStatus: 1,
              driverFirstName: 1,
              driverLastName: 1,
              mobile: 1,
              email: 1,
              countryCode: { $arrayElemAt: ["$driverData.countryCode", 0] },
              insertDate: 1,
            },
          },
        ],
      },
    },
  ]);
  let totalCount = requestList[0].allDocs.length > 0 ? requestList[0].allDocs[0].totalCount : 0;
  requestList = requestList[0].paginatedDocs;
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, requestList },
  });
});

module.exports = router;
