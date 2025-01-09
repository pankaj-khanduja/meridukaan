const { DRIVER_CONSTANTS, AUTH_CONSTANTS, OTP_CONSTANTS, CARD_CONSTANTS, PAYMENT_CONSTANTS, SUBACCOUNT_CONSTANTS, VENDOR_CONSTANTS } = require("../config/constant.js");

const mongoose = require("mongoose");
const config = require("config");
const bcrypt = require("bcrypt");
const _ = require("lodash");
const express = require("express");
const router = express.Router();
const { Order, validateAcceptReject, validateOrderStatusUpdate, validateDeliveryPic } = require("../models/order");
const {
  Driver,
  ChangeRequest,
  validateUserPost,
  validateUserLogin,
  validateUserPut,
  validateResetMobilePassword,
  validateChangePassword,
  validateUserSocialPost,
  validateDocumentUpdate,
  validatePayCodToAdmin,
  validateSetDefaultSubaccount,
  validateBankDetails,
  validateAssignMerchant,
} = require("../models/driver");
const { sendFCM } = require("../services/fcmModule");
const { createSubaccount, updateSubaccount, fetchSubaccount, createTransaction, chargeWithToken } = require("../services/flutterWave");
const { verifyAndDeleteToken } = require("../models/otp");
const { identityManager } = require("../middleware/auth");
const { Subaccount, postSubaccount, setDefaultSubaccount } = require("../models/subaccount.js");
const { Card } = require("../models/card");
const { Address } = require("../models/address.js");
const { ZohoAuth } = require("../models/zohoAuth");
const { createLeads } = require("../services/zoho");
const { createCart, CartItem } = require("../models/cart.js");
const { query } = require("express");
const { DriverAdminLogs } = require("../models/transactionLog.js");
const { Activity } = require("../models/activity.js");
const { Vendor } = require("../models/vendor.js");
const { DriverCancelOrder } = require("../models/driverCancelOrder.js");
const { PayoutEntry } = require("../models/payoutEntry.js");
const { PaymentLog } = require("../models/paymentLogs");
const moment = require("moment-timezone");

mongoose.set("debug", true);

//show drivers
router.get("/", identityManager(["admin", "driver"], { drivers: "W" }), async (req, res) => {
  let criteria = {};
  let limit, offset;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);

  if (req.query.applicationStatus) criteria.applicationStatus = req.query.applicationStatus;
  if (!req.query.status) criteria.status = { $ne: "deleted" };
  if (req.query.status) criteria.status = req.query.status;
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  if (req.query.text) {
    var terms = req.query.text.split(" ");
    // console.log("terms", terms);

    var regexName = new RegExp(terms[0], "i");

    var regexName1 = new RegExp(terms[1], "i");
    // console.log(terms.length);
    if (terms.length === 1 || terms[1] === "") {
      criteria = {
        $or: [{ firstName: regexName }, { lastName: regexName }, { email: regexName }, { mobile: regexName }],
      };
    } else {
      criteria = { $and: [{ firstName: regexName }, { lastName: regexName1 }] };
    }
  }
  // if(req.query.isFreezed)
  if (req.query.isFreezed) {
    criteria.isFreezed = req.query.isFreezed === "true" ? true : false;
  }

  if (isNaN(parseInt(req.query.limit))) limit = 5000;
  else limit = parseInt(req.query.limit);

  if (req.jwtData.role === "driver") {
    criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);
  } else {
    if (req.query.driverId) {
      criteria._id = mongoose.Types.ObjectId(req.query.driverId);
    }
  }
  criteria.driverId = { $ne: "" };
  let driverList = await Driver.aggregate([
    {
      $match: criteria,
    },
    {
      $addFields: {
        vendorId: {
          $cond: [{ $ne: ["$vendorId", null] }, { $toObjectId: "$vendorId" }, ""],
        },
      },
    },
    { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },
    { $sort: { insertDate: -1 } },
    {
      $project: {
        vendorName: { $arrayElemAt: ["$vendorData.name", 0] },
        vendorEmail: { $arrayElemAt: ["$vendorData.email", 0] },
        vendorMobile: { $arrayElemAt: ["$vendorData.mobile", 0] },
        firstName: 1,
        lastName: 1,
        gender: 1,
        dateOfBirth: 1,
        email: 1,
        mobile: 1,
        address: 1,
        countryCode: 1,
        status: 1,
        profilePic: 1,
        licenseFrontImage: 1,
        licenseBackImage: 1,
        driverLicenseExpiryDate: 1,
        vehicleExpiryDate: 1,
        vehicleModel: 1,
        vehicleNumber: 1,
        vehicleType: 1,
        totalRatings: 1,
        avgRating: 1,
        vehicleRegistrationFront: 1,
        applicationStatus: 1,
        pendingOrders: 1,
        driverId: "$_id",
        isAcceptingOrders: 1,
        isFreezed: 1,
        freezeDriverAt: 1,
        currentStatus: {
          $switch: {
            branches: [
              { case: { $eq: ["$isAcceptingOrder", false] }, then: "offline" },

              { case: { $gt: ["$pendingOrders", 0] }, then: "occupied" },
              { case: { $eq: ["$pendingOrders", 0] }, then: "idle" },
            ],
            default: "offline",
          },
        },
      },
    },
    {
      $lookup: {
        from: "orders",
        let: { driverId: { $toString: "$driverId" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$driverId", "$$driverId"] }, { $eq: ["$orderStatus", "DELIVERED"] }],
              },
            },
          },
        ],
        as: "orderData",
      },
    },
    { $addFields: { totalDeliveredOrders: { $size: "$orderData" } } },
    {
      $skip: offset,
    },
    {
      $limit: limit,
    },
    { $project: { orderData: 0 } },
  ]);

  let totalCount = await Driver.countDocuments(criteria);

  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, driverList } });
});

// Create a new driver
router.post("/", async (req, res) => {
  const { error } = validateUserPost(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  var email;
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.body.email) email = req.body.email.toLowerCase();
  else email = "NMB";
  let driver = await Driver.findOne({ $or: [{ email: email }, { mobile: mobile }] });
  if (driver) {
    if (email === driver.email)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.EMAIL_ALREADY_EXISTS },
      });
    if (mobile === driver.mobile)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.MOBILE_ALREADY_EXISTS },
      });
  }
  // console.log("fsdjk");
  let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "DR");
  if (!isValid)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTP_CONSTANTS.INVALID_OTP },
    });
  // console.log("fsdjk");

  driver = new Driver(
    _.pick(req.body, [
      "firstName",
      "lastName",
      "gender",
      "authType",
      "dateOfBirth",
      "mobile",
      "email",
      "deviceToken",
      "countryCode",
      "licenseFrontImage",
      "licenseBackImage",
      "vehicleRegistrationFront",
      "vehicleRegistrationBack",
      "driverLicenseExpiryDate",
      "driverLicenseExpiryEpoch",
      "vehicleExpiryEpoch",
      "vehicleExpiryDate",
      "vehicleNumber",
      "vehicleModel",
      "vehicleModelNo",
      "otherDocuments",
      "profilePic",
      "address",
    ])
  );
  if (email != "NMB") {
    driver.email = email;
    //driver.emailVerified = false;
    // status(400).sendActivation mail
  }
  // driver.password = await bcrypt.hash(req.body.password, config.get("bcryptSalt"));
  // let address = await new Address(_.pick(req.body, ["address"]));
  driver.location.coordinates[0] = req.body.location[0];
  driver.location.coordinates[1] = req.body.location[1];
  //   driver.isDefaultAddress = true;
  driver.driverId = driver._id.toString();
  let token = driver.generateAuthToken();
  driver.accessToken = token;
  driver.vehicleType = req.body.vehicleType.toLowerCase();
  driver.status = "active";
  driver.applicationStatus = "pending";
  // to unset device token of other driver from same handset.
  if (req.body.deviceToken) await Driver.updateMany({ deviceToken: req.body.deviceToken, mobile: { $ne: driver.mobile } }, { $set: { deviceToken: "" } });
  driver.deviceToken = req.body.deviceToken;
  await driver.save();
  driver.driverId = driver._id;
  driver.role = "driver";
  // let data = {};
  // await sendFCM(driver.deviceToken, data, "documentUpload");

  //   let cartId = await createCart(driver.deviceToken, driver.driverId);
  let response = _.pick(driver, [
    "driverId",
    "role",
    "status",
    "isPaymentGatewayIntegrated",
    "applicationStatus",
    "authType",
    "firstName",
    "lastName",
    "gender",
    "dateOfBirth",
    "mobile",
    "email",
    "deviceToken",
    "countryCode",
    "licenseFrontImage",
    "licenseBackImage",
    "vehicleRegistrationFront",
    "vehicleRegistrationBack",
    "driverLicenseExpiryDate",
    "vehicleExpiryDate",
    "vehicleNumber",
    "vehicleModel",
    "vehicleModelNo",
    "vehicleType",
    "otherDocuments",
    "profilePic",
    "address",
    "isDriverApproved",
  ]);

  // let response = _.pick(driver, [
  //   "driverId",
  //   "name",
  //   "role",
  //   "accessToken",
  //   "mobile",
  //   "licenseFrontImage",
  //   "licenseBackImage",
  //   "vehicleRegistrationFront",
  //   "vehicleRegistrationBack",
  //   "profilePic",
  //   "email",
  //   "status",
  //   "insertDate",
  //   "deviceToken",
  //   "countryCode",
  //   "address",
  //   "location",
  //   "defaultStore",
  // ]);
  //
  //   }

  // zoho Integration start
  let auth = await ZohoAuth.findOne();
  let userDataObj = {
    data: [
      {
        First_Name: response.firstName,
        Last_Name: response.lastName,
        Email: response.email,
        Phone: response.mobile,
        Lead_Source: response.authType,
        Lead_Status: "driver",
      },
    ],
  };
  if (config.get("zohoIntegration") == "true") {
    let leads = await createLeads(userDataObj, auth.accessToken);
    console.log("leads :", leads);
    if (leads.data.data[0].status == "success") {
      await Driver.updateOne({ _id: response.driverId }, { $set: { isZohoIntegration: true } });
    }
  }
  // zoho Integration end

  return res.header("Authorization", token).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: {
      response,
      message: DRIVER_CONSTANTS.ADMIN_REQUESTED,
    },
  });
});
router.put("/assignVendor", identityManager(["admin"], { drivers: "W" }), async (req, res) => {
  const { error } = validateAssignMerchant(req.body);
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
  let vendor = await Vendor.findOne({ _id: req.body.vendorId });
  if (!vendor)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });
  driver.vendorId = req.body.vendorId;
  driver.isVendorDriver = true;
  vendor.driverCount = vendor.driverCount || 0 + 1;

  await driver.save();
  await vendor.save();
  let data = {
    vendorName: vendor.name,
    type: "vendorAssigned",
  };
  if (driver && driver.deviceToken != "") {
    await sendFCM(driver.deviceToken, data, "vendorAssigned");
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: DRIVER_CONSTANTS.VENDOR_ASSIGNED },
  });
});

//view bank details
router.get("/bankDetails", identityManager(["driver"]), async (req, res) => {
  let driver = await Driver.findOne({ _id: req.jwtData.userId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DRIVER_NOT_FOUND },
    });
  let response = await fetchSubaccount(driver.flutterwaveId);
  response.data.isPaymentGatewayIntegrated = driver.isPaymentGatewayIntegrated;
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response: response.data } });
});

//Manage bank details
router.put("/bankDetails", identityManager(["driver"]), async (req, res) => {
  const { error } = validateBankDetails(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  let driver = await Driver.findOne({ _id: req.jwtData.userId });
  // const validPassword = await bcrypt.compare(req.body.password, vendor.password);
  // if (!validPassword)
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: VENDOR_CONSTANTS.INVALID_LOGIN_CREDENTIALS },
  //   });
  let object = {
    accountBank: req.body.accountBank,
    accountNumber: req.body.accountNumber,
    businessName: req.body.name || driver.firstName,
    businessEmail: req.body.email || driver.email,
    businessContact: mobile || driver.mobile,
    countryAbbrevation: req.body.countryAbbrevation,
  };
  if (req.body.meta) {
    object.meta = req.body.meta;
  }
  let account;
  if (req.body.isPaymentGatewayIntegrated) {
    object.flutterwaveId = driver.flutterwaveId;
    console.log("objectttt", object);
    account = await updateSubaccount(object);

    if (account.status !== "success") {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: account.data.message || "FlutterWave failure" },
      });
    }
  } else {
    account = await createSubaccount(object);
    if (account.status !== "success") {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: account.data.message || "FlutterWave failure" },
      });
    }
    driver.isPaymentGatewayIntegrated = true;
    driver.flutterwaveId = account.data.data.id;
    driver.subaccountId = account.data.data.subaccount_id;
  }

  await driver.save();
  driver.driverId = driver._id;
  let response = _.pick(driver, ["firstName", "lastName", "email", "isPaymentGatewayIntegrated"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: DRIVER_CONSTANTS.DRIVER_UPDATED, response },
  });
});

router.post("/addAccount", identityManager(["driver"]), async (req, res) => {
  const { error } = validateBankDetails(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  let driver = await Driver.findOne({ _id: req.jwtData.userId });
  let data = await postSubaccount(

    {
      accountBank: req.body.accountBank,
      bankName: req.body.bankName,
      accountNumber: req.body.accountNumber,
      user: driver,
      countryAbbrevation: req.body.countryAbbrevation,
      meta: req.body.meta,
      role: "driver"
    }
  );

  if (data.accountCreated) {
    driver.isPaymentGatewayIntegrated = true;
    await driver.save();
    driver.driverId = driver._id;
    let response = _.pick(driver, ["firstName", "mobile", "email", "isPaymentGatewayIntegrated"]);
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_CREATED, response },
    });
  } else {
    console.log("data.message ", data.message);
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: data.message },
    });
  }
});

router.get("/subaccounts", identityManager(["driver"]), async (req, res) => {
  let criteria = {};
  criteria.userId = req.jwtData.userId;
  criteria.status = "active";
  let subaccount = await Subaccount.aggregate([
    {
      $match: criteria,
    },
    {
      $project: {
        // subaccountId: 1,
        accountId: "$_id",
        _id: 0,
        isDefault: 1,
        status: 1,
        // flutterwaveId: 1,
        userId: 1,
        role: 1,
        last4Digits: 1,
        // bankName: 1,
        ifsc: 1,
      },
    },
  ]);
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { subaccount },
  });
});

router.put("/setDefaultSubaccount", identityManager(["driver"]), async (req, res) => {
  const { error } = validateSetDefaultSubaccount(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let subaccount = await setDefaultSubaccount(req.body.accountId, req.jwtData.userId);
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
    });
  }

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_SET_DEFAULT },
  });
  // let subaccount = await Subaccount.findOne({ _id: req.body.accountId, userId: req.jwtData.userId });
  // if (!subaccount) {
  //   return res.send({
  //     apiId: req.apiId,
  //     statusCode: 200,
  //     message: "Failure",
  //     data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
  //   });
  // }
  // subaccount.isDefault = true;
  // await subaccount.save();
  // await Subaccount.updateMany({ userId: subaccount.userId, _id: { $ne: subaccount._id } }, { $set: { isDefault: false } });

  // return res.send({
  //   apiId: req.apiId,
  //   statusCode: 200,
  //   message: "Success",
  //   data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_SET_DEFAULT },
  // });
});

router.put("/deleteSubaccount", identityManager(["driver"]), async (req, res) => {
  const { error } = validateSetDefaultSubaccount(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let subaccount = await Subaccount.findOne({ _id: req.body.accountId, userId: req.jwtData.userId, isDefault: false });
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND },
    });
  }
  subaccount.status = "deleted";
  await subaccount.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_DELETED },
  });
});

router.get("/driverCurrentLocation", identityManager(["user"]), async (req, res) => {
  let order = Order.findOne({ _id: req.query.orderId }, { orderStatus: 1, _id: 0 });
  let driver = Driver.findOne({ _id: req.query.driverId }, { "location.coordinates": 1, _id: 0 });
  let data = await Promise.all([order, driver]);
  console.log("data", data);
  let response = {
    orderStatus: data[0].orderStatus,
    driverLocation: data[1].location,
  };

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

router.get("/driverStatus", identityManager(["driver"]), async (req, res) => {
  let criteria = {};
  let startTime = Math.round(new Date().setUTCHours(0, 0, 0, 0) / 1000) + parseInt(config.get("inOffset"));
  let endTime = startTime + 86400;
  let todayCancelledOrders = await DriverCancelOrder.countDocuments({ driverId: req.jwtData.userId, insertDate: { $gte: startTime, $lte: endTime } });
  criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);

  let drivers = await Driver.aggregate([
    {
      $match: criteria,
    },
    {
      $addFields: {
        vendorId: {
          $cond: [{ $ne: ["$vendorId", null] }, { $toObjectId: "$vendorId" }, ""],
        },
      },
    },
    { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },
    // { $sort: { insertDate: -1 } },

    {
      $lookup: {
        from: "orders",
        let: { driverId: { $toString: "$_id" } },
        pipeline: [
          { $sort: { insertDate: -1 } },
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$driverId", "$$driverId"] }],
              },
            },
          },

          //
        ],
        as: "orderData",
      },
    },
    {
      $addFields: {
        currentOrderId: {
          $cond: [{ $ne: [{ $arrayElemAt: ["$orderData.orderStatus", 0] }, "DELIVERED"] }, { $arrayElemAt: ["$orderData._id", 0] }, ""],
        },
        vendorName: { $arrayElemAt: ["$vendorData.name", 0] },
        vendorEmail: { $arrayElemAt: ["$vendorData.email", 0] },
        vendorMobile: { $arrayElemAt: ["$vendorData.mobile", 0] },
      },
    },

    {
      $lookup: {
        from: "changerequests",
        let: { driverId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$driverId", "$$driverId"] }, { $eq: ["$applicationStatus", "pending"] }],
              },
            },
          },
          //
        ],
        as: "updateRequestData",
      },
    },
    { $project: { accessToken: 0, orderData: 0, vendorData: 0 } },
  ]);
  let response = drivers[0];
  if (todayCancelledOrders >= config.get("maxCancelPerDay")) {
    response.canDriverCancel = false;
  } else {
    response.canDriverCancel = true;
  }
  response.minPickupNearByDistance = config.get("minPickupNearByDistance");
  response.todayCancelledOrders = todayCancelledOrders;

  let hour = getCurrentGreeting();
  let name;
  let currentDriver = {
    name: req.userData.firstName + " " + req.userData.lastName,
    hour: hour,
    text: `${hour + "," + " " + req.userData.firstName + " " + req.userData.lastName}`,
    message: "test"

  }

  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response, currentDriver } });
});

//verify email or mobile
router.post("/verify", async (req, res) => {
  let criteria = {};
  let email = "NMB";
  if (req.body.email) {
    email = req.body.email.toLowerCase();
    criteria.email = email;
  }
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.body.mobile) criteria.mobile = mobile;
  if (req.body.email && req.body.mobile) criteria = { $or: [{ email: email }, { mobile: mobile }] };

  let driver = await Driver.findOne(criteria);
  if (driver) {
    if (email == driver.email && mobile == driver.mobile)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.MOBILE_EMAIL_ALREADY_EXISTS },
      });
    if (email === driver.email)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.EMAIL_ALREADY_EXISTS },
      });
    if (mobile === driver.mobile)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.MOBILE_ALREADY_EXISTS },
      });
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: DRIVER_CONSTANTS.VERIFICATION_SUCCESS },
  });
});

router.post("/payCod", identityManager(["driver"]), async (req, res) => {
  const { error } = validatePayCodToAdmin(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let driver = await Driver.findOne({ _id: req.jwtData.userId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DRIVER_NOT_FOUND },
    });
  let criteria = {};
  criteria = { "userDetails.userId": req.jwtData.userId };
  criteria.type = "codByDriver";
  criteria.status = "pending";
  // criteria._id = { $in: payoutIds };
  // criteria.isOrderAmtPaidToAdmin = false;
  // criteria.driverId = req.jwtData.userId;
  let order = await PayoutEntry.aggregate([
    {
      $match: criteria,
    },
    {
      $group: {
        _id: null,
        toBePaid: { $sum: "$accumulatedSum" },
        payoutIds: { $push: { $toString: "$_id" } },
      },
    },
  ]);
  console.log("order", order);

  if (!order[0] || !order[0].toBePaid) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PAYMENT_CONSTANTS.AMOUNT_GREATER_THAN_ZERO },
    });
  }

  // if (order[0].toBePaid != req.body.amount) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: PAYMENT_CONSTANTS.DATA_MISMATCH },
  //   });
  // }
  console.log("typeof", typeof order[0].payoutIds[0]);
  let log = new DriverAdminLogs({});
  log.userId = req.jwtData.userId;
  log.paidBy = "driver";
  log.paidTo = "admin";
  log.paymentAmount = order[0].toBePaid;
  log.paymentType = req.body.paymentType || "others";
  log.type = "codPayment";
  log.status = "pending";
  log.metaData = order[0].payoutIds;

  console.log("ooooooo", order);
  if (req.body.paymentType === "card") {
    let card = await Card.findOne({ cardToken: req.body.cardToken });
    if (!card)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: CARD_CONSTANTS.INVALID_CARD },
      });
    let chargeObject = {
      token: req.body.cardToken,
      narration: config.get("narration"),
      tx_ref: log._id.toString(),
      amount: order[0].toBePaid,
      currency: config.get("currency"),
      country: config.get("country"),
      email: card.email || config.get("dummyEmail"),
      phonenumber: driver.mobile,
      first_name: driver.firstName,
      last_name: driver.lastName,
    };
    let response = await chargeWithToken(chargeObject);
    console.log("responsssseeee", response);
    let paymentLog = new PaymentLog();
    paymentLog.userId = req.jwtData.userId;
    paymentLog.type = "chargeWithToken";
    paymentLog.paymentType = "payCod";

    if (response.statusCode !== 200) {
      paymentLog.data = response.data.response.data;
      await paymentLog.save();
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
      });
    } else {
      if (response.data.data.status != "successful")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
        });
      else {
        log.status = "success";
        let payoutIds = order[0].payoutIds.map((x) => mongoose.Types.ObjectId(x));

        await PayoutEntry.updateMany({ _id: { $in: log.metaData } }, { $set: { status: "completed", accumulatedSum: 0 }, $push: { transactionId: log._id.toString() } });
        await Order.updateMany(criteria, { $set: { isOrderAmtPaidToAdmin: true } });
        driver.isFreezed = false;
        driver.freezeDriverAt = 0;

        await driver.save();
        let activity = new Activity({});
        activity.userId = req.jwtData.userId;
        activity.data = { amount: order[0].toBePaid };
        activity.type = "paidToAdmin";
        await activity.save();

        paymentLog.data = response;
        await paymentLog.save();
      }
    }
  } else {
    let chargeObject = {
      tx_ref: log._id.toString(),
      amount: order[0].toBePaid,
      currency: config.get("currency"),
      redirect_url: config.get("redirectBaseUrl") + "/api/webhook/codPaymentBydriver",
      payment_options: config.get("paymentOptions"),
      meta: {
        consumer_id: driver._id.toString(),
        consumer_mac: "92a3-912ba-1192a",
      },
      customer: {
        email: driver.email || config.get("dummyEmail"),
        phonenumber: driver.mobile,
        name: driver.firstName + driver.lastName,
      },
      // customizations: {
      //   title: order.vendorName,
      //   description: order.vendorName,
      //   logo: order.vendorImage,
      // },
    };
    let response = await createTransaction(chargeObject);
    let paymentLog = new PaymentLog();
    paymentLog.userId = req.jwtData.userId;
    paymentLog.type = "createTransaction";
    paymentLog.paymentType = "payCod";

    if (response.statusCode !== 200) {
      paymentLog.data = response.data.response.data;
      await paymentLog.save();

      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
      });
    } else {
      if (response.message != "Success")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
        });
      else {
        log.otherDetails = response.data.data.link;
        paymentLog.data = response;
        await paymentLog.save();
      }
    }
  }

  await log.save();
  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: PAYMENT_CONSTANTS.PAYMENT_SUCCESS, log },
  });
});

router.put("/", identityManager(["driver", "admin"], { drivers: "W" }), async (req, res) => {
  const { error } = validateUserPut(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.jwtData.role === "admin") {
    if (req.body.driverId) driverId = req.body.driverId;
    else
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "UserId required if viewing as admin" },
      });
  }
  if (req.jwtData.role === "driver") driverId = req.jwtData.userId;

  driver = await Driver.findOne({ _id: driverId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.INVALID_driver },
    });

  driver.firstName = req.body.firstName || driver.firstName;
  driver.lastName = req.body.lastName || driver.lastName;
  driver.gender = req.body.gender || driver.gender;
  driver.dateOfBirth = req.body.dateOfBirth || driver.dateOfBirth;

  driver.countryCode = req.body.countryCode || driver.countryCode;

  // driver.licenseFrontImage = req.body.licenseFrontImage || driver.licenseFrontImage;
  // driver.licenseBackImage = req.body.licenseBackImage || driver.licenseBackImage;
  // driver.vehicleRegistrationFront = req.body.vehicleRegistrationFront || driver.vehicleRegistrationFront;
  // driver.vehicleRegistrationBack = req.body.vehicleRegistrationBack || driver.vehicleRegistrationBack;
  if (req.body.location) {
    driver.location.coordinates[0] = req.body.location[0] || driver.location.coordinates[0];
    driver.location.coordinates[1] = req.body.location[1] || driver.location.coordinates[1];
  }
  driver.address = req.body.address || driver.address;
  driver.navigationService = req.body.navigationService || driver.navigationService;
  if (req.body.hasOwnProperty("sendPromotionalNotifications")) {
    driver.sendPromotionalNotifications = req.body.sendPromotionalNotifications;
  }
  // if (driver.defaultStore != req.body.defaultStore) {
  //   let cleanCart = await CartItem.deleteMany({ cartId: req.body.cartId });
  // }
  // driver.defaultStore = req.body.defaultStore || driver.defaultStore;
  driver.profilePic = req.body.profilePic || driver.profilePic;

  if (req.body.email && req.body.email != driver.email) {
    tempdriver = await Driver.findOne({ email: req.body.email.toLowerCase() });
    if (tempdriver)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.EMAIL_ALREADY_EXISTS },
      });
    driver.email = req.body.email.toLowerCase();

    //driver.emailVerified = false;
    //sendActivationEmail
  }
  if (req.body.mobile && mobile != driver.mobile) {
    let tempdriver = await Driver.findOne({ mobile: mobile });
    if (tempdriver)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: DRIVER_CONSTANTS.USER_NOT_FOUND },
      });

    if (req.body.otpToken) {
      let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "DU");
      if (!isValid)
        return res.status(400).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: OTP_CONSTANTS.INVALID_OTP },
        });
    } else {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: OTP_CONSTANTS.INVALID_OTP },
      });
    }
    driver.mobile = mobile;
  }
  if (req.jwtData.role === "admin") {
    driver.status = req.body.status || driver.status;
    if (req.body.status != "active") {
      driver.accessToken = "";
    }
  }

  await driver.save();
  driver.driverId = driver._id;
  driver.role = "driver";
  let response = _.pick(driver, [
    "driverId",
    "role",
    "address",
    "location",
    "countryCode",
    "name",
    "sendPromotionalNotifications",
    "navigationService",
    "mobile",
    "email",
    "pendingOrders",
    "profilePic",
    "status",
    "isAcceptingOrders",
    "insertDate",
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Driver updated successfully.", response },
  });
});

router.put("/updateDocuments", identityManager(["driver"]), async (req, res) => {
  const { error } = validateDocumentUpdate(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  if (req.jwtData.role === "driver") driverId = req.jwtData.userId;

  driver = await Driver.findOne({ _id: driverId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.INVALID_DRIVER },
    });
  let changeRequest = await ChangeRequest.findOne({ driverId: driver._id, applicationStatus: "pending" });
  if (changeRequest) {
    changeRequest.licenseFrontImage = req.body.licenseFrontImage || changeRequest.licenseFrontImage;
    changeRequest.licenseBackImage = req.body.licenseBackImage || changeRequest.licenseBackImage;
    changeRequest.vehicleRegistrationFront = req.body.vehicleRegistrationFront || changeRequest.vehicleRegistrationFront;
    changeRequest.driverLicenseExpiryEpoch = req.body.driverLicenseExpiryEpoch || changeRequest.driverLicenseExpiryEpoch;
    changeRequest.vehicleExpiryEpoch = req.body.vehicleExpiryEpoch || changeRequest.vehicleExpiryEpoch;

    changeRequest.vehicleRegistrationBack = req.body.vehicleRegistrationBack || changeRequest.vehicleRegistrationBack;
    changeRequest.driverLicenseExpiryDate = req.body.driverLicenseExpiryDate || changeRequest.driverLicenseExpiryDate;
    changeRequest.vehicleExpiryDate = req.body.vehicleExpiryDate || changeRequest.vehicleExpiryDate;
    changeRequest.vehicleNumber = req.body.vehicleNumber || changeRequest.vehicleNumber;
    changeRequest.vehicleModel = req.body.vehicleModel || changeRequest.vehicleModel;
    changeRequest.vehicleModelNo = req.body.vehicleModelNo || changeRequest.vehicleModelNo;
    changeRequest.vehicleType = req.body.vehicleType.toLowerCase() || changeRequest.vehicleType;
    changeRequest.otherDocuments = req.body.otherDocuments || changeRequest.otherDocuments;
    changeRequest.applicationStatus = "pending";
    changeRequest.driverId = req.jwtData.userId;
    await changeRequest.save();
    console.log("driver.applicationStatus", driver.applicationStatus);
    if (driver.applicationStatus === "rejected") {
      driver.applicationStatus = "pending";
      await driver.save();
    }
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: DRIVER_CONSTANTS.ADMIN_REQUESTED },
    });
  }
  changeRequest = new ChangeRequest(
    _.pick(req.body, [
      "licenseFrontImage",
      "licenseBackImage",
      "vehicleRegistrationFront",
      "vehicleRegistrationBack",
      "driverLicenseExpiryDate",
      "vehicleExpiryDate",
      "vehicleNumber",
      "vehicleModel",
      "vehicleModelNo",
      "otherDocuments",
      "profilePic",
    ])
  );
  changeRequest.vehicleType = req.body.vehicleType.toLowerCase();
  changeRequest.applicationStatus = "pending";
  changeRequest.driverId = req.jwtData.userId;
  await changeRequest.save();

  if (driver.applicationStatus === "rejected") {
    driver.applicationStatus = "pending";
    await driver.save();
  }

  let response = _.pick(changeRequest, [
    "driverId",
    "profilePic",
    "status",
    "licenseFrontImage",
    "licenseBackImage",
    "vehicleRegistrationFront",
    "vehicleRegistrationBack",
    "driverLicenseExpiryDate",
    "vehicleExpiryDate",
    "vehicleNumber",
    "vehicleModel",
    "vehicleModelNo",
    "vehicleType",
    "otherDocuments",
  ]);

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: DRIVER_CONSTANTS.ADMIN_REQUESTED, response },
  });
});

router.put("/changeStatus", identityManager(["driver"]), async (req, res) => {
  let driver = await Driver.findOne({ _id: req.jwtData.userId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_USER },
    });
  console.log("driver", driver.isDriverApproved);
  if (!driver.isDriverApproved) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.DOCUMENT_NOT_APPROVED },
    });
  }
  if (driver.isAcceptingOrders === true) {
    driver.isAcceptingOrders = false;
    await driver.save();
  } else {
    driver.isAcceptingOrders = true;
  }
  await driver.save();
  driver.driverId = driver._id;
  driver.role = "driver";
  let response = _.pick(driver, ["driverId", "role", "countryCode", "name", "mobile", "email", "pendingOrders", "profilePic", "status", "isAcceptingOrders", "insertDate"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "status changed successfully", response },
  });
});

router.post("/password/change/", identityManager(["driver"]), async (req, res) => {
  const { error } = validateChangePassword(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let driver = await Driver.findById(req.jwtData.driverId);
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.INVALID_USER },
    });

  const validPassword = await bcrypt.compare(req.body.oldPassword, driver.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.INVALID_PASSWORD },
    });

  let encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  driver.password = encryptPassword;

  await driver.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: driver_CONSTANTS.PASSWORD_CHANGE_SUCCESS },
  });
});

// Reset password by mobile
router.post("/password/reset/mobile", async (req, res) => {
  const { error } = validateResetMobilePassword(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  let driver = await Driver.findOne({ mobile: mobile });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.INVALID_USER },
    });

  let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "DFP");
  if (!isValid)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTP_CONSTANTS.INVALID_OTP },
    });

  var encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  driver.password = encryptPassword;

  await driver.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: AUTH_CONSTANTS.PASSWORD_CHANGE_SUCCESS },
  });
});

router.post("/logout", identityManager(["driver"]), async (req, res) => {
  driverId = req.jwtData.userId;
  let driver = await Driver.findById(driverId);
  if (!driver) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: DRIVER_CONSTANTS.USER_NOT_FOUND },
    });
  }
  // await unsubscribeFromTopic(user.deviceToken, "subscribedUser");

  driver.accessToken = "";
  driver.deviceToken = "";
  driver.isAcceptingOrders = false;
  await driver.save();
  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Logged out successfully" },
  });
});

router.delete("/", identityManager(["driver"]), async (req, res) => {
  let driver = await Driver.findOne({ _id: req.jwtData.userId });
  if (!driver)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: "Cannot find driver" },
    });

  if (driver.pendingOrders > 0) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: "Cannot delete driver." },
    });
  }
  await Driver.deleteOne({ _id: req.jwtData.userId });
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Failure",
    data: { message: "Driver deleted" },
  });
});
function getCurrentGreeting() {


  const now = moment().tz('Asia/Kolkata');
  hours = now.format('H');
  console.log(hours, "hours");
  return getGreeting(hours);
}

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
}



module.exports = router;


// let token = "eu8-FA2MRza2IiwyZZbkfh:APA91bHjKCGRZV1QBBQPbh1MjmPG1HfXTo6PgjjLChcC1lXnKYyn1f2Bqsm4hqw6HMble-lTdYZSRNSLYwKR1YnDGkoVHaQiMW9Wd41RXnsZClsZ3NTnwhUzF4kGe12MWKIYMk5Qo6m_";


// let data = {
//   vendorName: "TEST",
//   type: "vendorAssigned",
// };
// sendFCM(token, data, "vendorAssigned");
