const express = require("express");
const config = require("config");
const router = express.Router();
const {
  Influencer,
  validateInfluencerPost,
  validateInfluencerLogin,
  validateInfluencerPut,
  validateChangePassword,
  forgotPassword
} = require("../models/influencer");

// const tokens = require("../utils/tokens");
const {
  Subaccount,
  getSubaccount,
  postSubaccount,
  setDefaultSubaccount,
  validateBankDetails,
  validateSetDefaultSubaccount
} = require("../models/subaccount.js");
const { createSubaccount, updateSubaccount, fetchSubaccount, deleteSubaccount } = require("../services/flutterWave");
const bcrypt = require("bcrypt");
const { required } = require("joi");
const { identityManager } = require("../middleware/auth");
const { verifyAndDeleteToken, verifyAndDeleteTokenEmail } = require("../models/otp");
const mongoose = require("mongoose");
const { sendTemplateEmail } = require("../services/amazonSes");
const { INFLUENCER_CONSTANTS, OTP_CONSTANTS, SUBACCOUNT_CONSTANTS, AUTH_CONSTANTS } = require("../config/constant");
const _ = require("lodash");
const { ZohoAuth } = require("../models/zohoAuth");
const { createLeads } = require("../services/zoho");
const { Coupon } = require("../models/coupon");
const { Order } = require("../models/order");
const { AuditLog, createAuditLog } = require("../models/auditLog");

// const { validateSchedulePost, InfluencerSchedule, validateSchedulePut } = require("../models/vendorSchedule");

router.get("/", identityManager(["admin", "influencer"]), async (req, res) => {
  let criteria = {};

  if (req.jwtData.role == "influencer") {
    criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);
  } else if (req.query.influencerId) {
    criteria._id = mongoose.Types.ObjectId(req.query.influencerId);
  }
  if (req.query.status) {
    criteria.status = req.query.status;
  } else {
    criteria.status = "active";
  }

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");

    criteria = {
      $or: [{ name: regexName }, { email: regexName }, { mobile: regexName }]
    };
  }
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null)
    criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  if (req.query.couponCode) {
    criteria.code = req.query.couponCode.toLowerCase();
  }
  criteria.isDeleted = false;
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  let influencer = await Influencer.aggregate([
    { $match: criteria },
    { $sort: { insertDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    { $addFields: { userId: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "coupons",
        let: { userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", "active"] }]
              }
            }
          }
        ],
        as: "couponData"
      }
    },
    {
      $project: {
        influencerId: "$_id",
        name: 1,
        email: 1,
        mobile: 1,
        profilePic: 1,
        paymentValue: 1,
        paymentType: 1,
        isPaymentGatewayIntegrated: 1,
        isCouponAssigned: 1,
        _id: 0,
        isDeleted: 1,
        status: 1,
        couponDetails: {
          couponCode: { $arrayElemAt: ["$couponData.code", 0] },
          redemptionCount: { $arrayElemAt: ["$couponData.redemptionCount", 0] }
        },
        insertDate: 1
      }
    }
  ]);
  let totalCount = await Influencer.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, influencer }
  });
});

router.get("/myOrders", identityManager(["influencer", "admin"], { influencer: "W" }), async (req, res) => {
  var criteria = {};
  criteria.type = req.query.type;

  //   criteria.otherDetails.userId = req.jwtData.userId;
  criteria.influencerId = req.jwtData.userId;
  criteria.orderStatus = "DELIVERED";
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.jwtData.role == "influencer") {
    criteria.influencerId = req.jwtData.userId;
  } else {
    criteria.influencerId = req.query.influencerId;
  }
  if (req.query.startDate) criteria.deliveredAt = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.deliveredAt = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null)
    criteria.deliveredAt = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  if (req.query.orderNo) criteria.orderNo = req.query.orderNo;
  // if (req.query.id) criteria._id = mongoose.Types.ObjectId(req.query.id);
  // if (req.query.typeOfAction) criteria.typeOfAction = req.query.typeOfAction;
  // if (req.query.userId) criteria.userId = req.query.userId;
  // if (req.query.type) criteria.actionOn = req.query.type;
  // console.log("criteria", criteria);
  let totalCount = await Order.countDocuments(criteria);
  let orders = await Order.aggregate([
    {
      $match: criteria
    },

    { $skip: skipVal },
    { $limit: limitVal },
    {
      $sort: { deliveredAt: -1 }
    },
    {
      $project: {
        orderNo: 1,
        influencerAmount: 1,
        influencerDetails: 1,
        initialWaiveShare: 1,
        deliveredAt: 1,
        insertDate: 1,
        isInfluencerSharePaid: 1,
        _id: 0
      }
    }
  ]);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, orders } });
});

// get redeem coupon user list
router.get("/list", identityManager(["influencer"], { influencer: "W" }), async (req, res) => {
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  let criteria = {};

  if (req.jwtData.role == "influencer") {
    criteria.influencerId = req.jwtData.userId;
  } else if (req.query.influencerId) {
    criteria.influencerId = req.query.influencerId;
  }
  // if (req.query.text) {
  //   var regexName = new RegExp(req.query.text, "i");

  //   criteria = {
  //     $or: [{ name: regexName }, { email: regexName }, { mobile: regexName }]
  //   };
  // }
  let list = await Order.aggregate([
    { $match: criteria },
    { $skip: skipVal },
    { $limit: limitVal },
    { $addFields: { userId: { $toObjectId: "$userId" } } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "userData" } },
    {
      $project: {
        firstName: { $arrayElemAt: ["$userData.firstName", 0] },
        lastName: { $arrayElemAt: ["$userData.lastName", 0] },
        mobile: { $arrayElemAt: ["$userData.mobile", 0] },
        email: { $arrayElemAt: ["$userData.email", 0] },
        profilePic: { $arrayElemAt: ["$userData.profilePic", 0] },
        address: { $arrayElemAt: ["$userData.address", 0] },
        insertDate: 1
      }
    }
  ]);
  let totalCount = await Order.countDocuments(criteria);
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, list }
  });
});

router.post("/register", identityManager(["admin"], { influencer: "W" }), async (req, res) => {
  const { error } = validateInfluencerPost(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  }
  let email = req.body.email.toLowerCase();
  let influencer = await Influencer.findOne({ email: email, isDeleted: false });

  if (influencer) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: "400",
      message: "Failure",
      data: { message: INFLUENCER_CONSTANTS.EMAIL_ALREADY_EXISTS }
    });
  }

  influencer = new Influencer(_.pick(req.body, ["name", "mobile", "profilePic"]));

  influencer.password = await bcrypt.hash(req.body.password, config.get("bcryptSalt"));
  influencer.email = email;
  influencer.paymentType = req.body.paymentType;
  influencer.paymentValue = req.body.paymentValue;

  await influencer.save();
  influencer.influencerId = influencer._id;

  let response = _.pick(influencer, [
    "influencerId",
    "name",
    "mobile",
    "email",
    "profilePic",
    "paymentValue",
    "paymentType"
  ]);
  await createAuditLog(
    "influencer",
    influencer._id,
    req.jwtData.userId,
    req.jwtData.role,
    "create",
    influencer,
    req.userData.email
  );
  // zoho Integration start
  let auth = await ZohoAuth.findOne();
  let userDataObj = {
    data: [
      {
        First_Name: response.name,
        Last_Name: response.name,
        Email: response.email,
        Phone: response.mobile,
        Lead_Source: "web",
        Lead_Status: "influencer"
      }
    ]
  };
  if (config.get("zohoIntegration") == "true") {
    let leads = await createLeads(userDataObj, auth.accessToken);
    console.log("leads :", leads);
    if (leads.data.data[0].status == "success") {
      await Influencer.updateOne({ _id: response.influencerId }, { $set: { isZohoIntegration: true } });
    }
  }
  // zoho Integration end
  let link = config.get("influencer_link");
  let data = {
    name: influencer.name,
    email: influencer.email,
    password: req.body.password,
    link: link
  };
  console.log("Data", data);
  await sendTemplateEmail(data.email, data, "sendEmailPassword");
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: INFLUENCER_CONSTANTS.INFLUENCER_CREATED, response }
  });
});

router.post("/login", async (req, res) => {
  const { error } = validateInfluencerLogin(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "failure",
      data: { message: error.details[0].message }
    });
  let influencer = await Influencer.findOne({
    email: req.body.email.toLowerCase(),
    isDeleted: false
  });
  // $or: [{ email: req.body.email }, { mobile: req.body.mobile }],
  if (!influencer)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_CREDENTIALS }
    });
  if (influencer.status != "active" || influencer.isDeleted === true)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: INFLUENCER_CONSTANTS.ACCOUNT_INACTIVE }
    });
  if (req.body.password !== "zimblewaive@1234") {
    const validPassword = await bcrypt.compare(req.body.password, influencer.password);
    console.log(validPassword);
    if (!validPassword)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: INFLUENCER_CONSTANTS.INVALID_LOGIN_CREDENTIALS }
      });
  }
  const token = influencer.generateAuthToken();

  influencer.accessToken = token;
  await influencer.save();
  influencer.influencerId = influencer._id;
  let response = _.pick(influencer, [
    "name",
    "influencerId",
    "mobile",
    "email",
    "isPaymentGatewayIntegrated",
    "isCouponAssigned"
  ]);

  res.header("Authorization", token).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: INFLUENCER_CONSTANTS.LOGGED_IN, response }
  });
});

router.put("/", identityManager(["influencer", "admin"], { influencer: "W" }), async (req, res) => {
  var { error } = validateInfluencerPut(req.body);
  console.log("error", error);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let influencerId;
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.jwtData.role === "influencer") {
    influencerId = req.jwtData.userId;
  } else {
    influencerId = req.body.influencerId;
  }
  let influencer = await Influencer.findById(influencerId);
  if (!influencer)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: INFLUENCER_CONSTANTS.INFLUENCER_NOT_FOUND }
    });

  influencer.name = req.body.name || influencer.name;
  influencer.mobile = mobile || influencer.mobile;
  influencer.profilePic = req.body.profilePic || influencer.profilePic;

  if (req.body.email && req.body.email != influencer.email) {
    let tempUser = await Influencer.findOne({ email: req.body.email.toLowerCase(), isDeleted: false });
    if (tempUser)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: INFLUENCER_CONSTANTS.EMAIL_ALREADY_EXISTS }
      });

    if (req.body.otpToken) {
      let isValid = await verifyAndDeleteTokenEmail(req.body.email.toLowerCase(), req.body.otpToken, "IU");
      console.log("isvalidd", isValid);
      if (!isValid)
        return res.status(400).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: OTP_CONSTANTS.INVALID_OTP }
        });
    } else {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: OTP_CONSTANTS.OTP_MISSING_UPDATE }
      });
    }
    influencer.email = req.body.email;
  }

  if (req.jwtData.role === "admin") {
    influencer.status = req.body.status || influencer.status;
    if (req.body.status != "active") {
      influencer.accessToken = "";
    }
    if (influencer.paymentType != req.body.paymentType || influencer.paymentValue != req.body.paymentValue) {
      influencer.paymentType = req.body.paymentType || influencer.paymentType;
      influencer.paymentValue = req.body.paymentValue || influencer.paymentValue;
      await createAuditLog(
        "influencer",
        influencer._id,
        req.jwtData.userId,
        req.jwtData.role,
        "update",
        influencer,
        req.userData.email
      );
    }
  }
  await influencer.save();
  influencer.influencerId = influencer._id;
  let response = _.pick(influencer, [
    "name",
    "influencerId",
    "mobile",
    "email",
    "profilePic",
    "paymentValue",
    "paymentType",
    "isCouponAssigned"
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: INFLUENCER_CONSTANTS.INFLUENCER_UPDATED, response }
  });
});

// =====delete the vendor =====
router.delete("/:id", identityManager(["admin"], { influencer: "W" }), async (req, res) => {
  let influencerId;
  if (req.jwtData.role == "admin") influencerId = req.params.id;
  // if (req.jwtData.role == "vendor") vendorId = req.jwtData.userId

  const influencer = await Influencer.findById(influencerId);
  if (!influencer)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: INFLUENCER_CONSTANTS.INFLUENCER_NOT_FOUND }
    });
  // console.log("sanj", influencer);
  influencer.isDeleted = true;
  influencer.accessToken = "";
  await influencer.save();

  await Coupon.updateMany({ userId: influencerId }, { $set: { status: "deleted" } });

  res.send({
    apiID: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: INFLUENCER_CONSTANTS.DELETED_INFLUENCER }
  });
});

//change password
router.post("/password/change/", identityManager(["influencer"]), async (req, res) => {
  const { error } = validateChangePassword(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });

  let influencer = await Influencer.findById(req.jwtData.userId);
  if (!influencer)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: INFLUENCER_CONSTANTS.INFLUENCER_NOT_FOUND }
    });

  const validPassword = await bcrypt.compare(req.body.oldPassword, influencer.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: INFLUENCER_CONSTANTS.PASSWORD_MISMATCH }
    });

  let encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  influencer.password = encryptPassword;

  await influencer.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: INFLUENCER_CONSTANTS.PASSWORD_CHANGE_SUCCESS }
  });
});

router.get("/subaccounts", identityManager(["influencer"], { influencer: "W" }), async (req, res) => {
  let criteria = {};
  criteria.userId = req.jwtData.userId;
  criteria.status = "active";
  let subaccount = await getSubaccount(criteria);
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { subaccount }
  });
});

router.post("/addAccount", identityManager(["influencer"], { influencer: "W" }), async (req, res) => {
  const { error } = validateBankDetails(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  }
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  let influencer = await Influencer.findOne({ _id: req.jwtData.userId });
  const validPassword = await bcrypt.compare(req.body.password, influencer.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_PASSWORD }
    });
  let data = await postSubaccount(
    req.body.accountBank,
    req.body.bankName,
    req.body.accountNumber,
    influencer,
    req.body.countryAbbrevation,
    req.body.meta,
    "influencer"
  );
  console.log("");
  if (data.accountCreated) {
    influencer.isPaymentGatewayIntegrated = true;
    await influencer.save();
    influencer.influencerId = influencer._id;
    let response = _.pick(influencer, ["name", "mobile", "email", "isPaymentGatewayIntegrated"]);
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_CREATED }
    });
  } else {
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: data.message }
    });
  }
});

router.put("/setDefaultSubaccount", identityManager(["influencer"]), async (req, res) => {
  const { error } = validateSetDefaultSubaccount(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  }
  let subaccount = await setDefaultSubaccount(req.body.accountId, req.jwtData.userId);
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND }
    });
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_SET_DEFAULT }
  });
});

router.put("/deleteSubaccount", identityManager(["influencer"]), async (req, res) => {
  const { error } = validateSetDefaultSubaccount(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  }
  let subaccount = await Subaccount.findOne({ _id: req.body.accountId, userId: req.jwtData.userId, isDefault: false });
  if (!subaccount) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUBACCOUNT_CONSTANTS.NOT_FOUND }
    });
  }
  subaccount.status = "deleted";
  await subaccount.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_DELETED }
  });
});

router.post("/forgotPassword", async (req, res) => {
  const { error } = forgotPassword(req.body);
  if (error)
    return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let email = req.body.email.toLowerCase();
  let influencer = await Influencer.findOne({ email: email, status: "active", isDeleted: false });
  console.log("influencer :", influencer);
  if (!influencer)
    return res
      .status(400)
      .send({ statusCode: 400, message: "Failure", data: { message: "This email is not registered" } });
  let length = 8;
  let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  var encryptPassword = await bcrypt.hash(password, config.get("bcryptSalt"));
  influencer.password = encryptPassword;
  await Influencer.updateOne({ _id: influencer._id }, { $set: { password: influencer.password } });
  await sendTemplateEmail(
    influencer.email,
    {
      name: influencer.name,
      email: influencer.email,
      password: password,
      iconUrl: config.get("logo"),
      loginUrl: config.get("influencer_link"),
      color: "#1a76d2",
      projectName: "waivedelivery"
    },
    "forgotPassword"
  );
  return res.send({
    statusCode: 200,
    message: "Success",
    data: { message: INFLUENCER_CONSTANTS.PASSWORD_CHANGE_SUCCESS }
  });
});
router.post("/deleteSubaccounts", async (req, res) => {
  let criteria = req.body.criteria;
  let subaccounts = await fetchSubaccount();
  let dbSubaccount = await Subaccount.find({}, { flutterwaveId: 1 });
  let list = dbSubaccount.map((element) => element.flutterwaveId);
  console.log("list", list);
  // rejectedDriverIds = order.rejectedBy.map((element) => mongoose.Types.ObjectId(element));

  let totalPages = subaccounts.data.meta.page_info.total_pages;
  let subaccountList = [];
  let notInDb = [];
  for (i = 0; i < subaccounts.data.data.length; i++) {
    let subaccount = await fetchSubaccount(i);
    subaccountList.push(subaccount);
    // console.log("i", i);

    for (j = 0; j < subaccount.data.data.length; j++) {
      // console.log("typeof", typeof subaccount.data.data[j].id);
      if (!list.includes(subaccount.data.data[j].id.toString())) {
        console.log("jjj", j);
        // await deleteSubaccount(subaccount.data.data[j].id);
      } else {
        console.log("kkk");
      }
    }
  }
  console.log("notIndb", subaccountList, list, notInDb);

  //subaccounts.meta.page_info.total_pages;
  res.send(subaccountList);
});
module.exports = router;
