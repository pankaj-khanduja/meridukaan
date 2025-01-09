const { USER_CONSTANTS, AUTH_CONSTANTS, OTP_CONSTANTS } = require("../config/constant.js");
const mongoose = require("mongoose");
const config = require("config");
const bcrypt = require("bcrypt");
const _ = require("lodash");
const express = require("express");
const router = express.Router();
const { User, validateUserPost, validateUserLogin, validateUserDeletionAuthenticate, validateUserPut, validateResetMobilePassword, validateChangePassword, validateUserSocialPost, userProjection, } = require("../models/user");
const { Referral } = require("../models/referral");
const { verifyAndDeleteToken } = require("../models/otp");
const { identityManager } = require("../middleware/auth");
const { Address } = require("../models/address.js");
const { Otp } = require("../models/otp.js");
const { createCart, CartItem } = require("../models/cart.js");
const { Store } = require("../models/vendor.js");
const { ZohoAuth } = require("../models/zohoAuth");
const { createLeads } = require("../services/zoho");
const { ApiLog } = require("../models/apiLog");
const { formatter } = require("../services/commonFunctions");
const { createCustomer } = require("../services/razorPayFunctions.js");
const { Driver } = require("../models/driver.js");
//const { sendFCM } = require("../services/fcmModule");
mongoose.set("debug", true);

// Create a new user
router.post("/", async (req, res) => {
  const { error } = validateUserPost(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message }, });
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
  let user = await User.findOne({ $or: [{ email: email }, { mobile: mobile }] });
  if (user) {
    if (email === user.email)
      return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.EMAIL_ALREADY_EXISTS }, });
    if (mobile === user.mobile)
      return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.MOBILE_ALREADY_EXISTS }, });
  }

  user = new User(_.pick(req.body, ["firstName", "lastName", "mobile", "email", "countryCode", "deviceToken", "profilePic", "authType"]));
  if (email != "NMB") {
    user.email = email;
    //user.emailVerified = false;
    // status(400).sendActivation mail
  }
  // user.password = await bcrypt.hash(req.body.password, config.get("bcryptSalt"));

  // Saving referral code.
  if (req.body.referralCode) {
    if (req.body.referralCode === config.get("companyReferralCode")) {
      let referral = new Referral({ userId: user._id, referredBy: "", usedReferralCode: req.body.referralCode, type: "signup", status: "active", referredByStatus: "active" });
      // await User.updateOne({ referralCode: req.body.referralCode.toLowerCase(), status: "active" }, { $inc: { totalReferral: 1 } });
      await referral.save();
    } else {
      let userTemp = await User.findOne({ referralCode: req.body.referralCode, status: "active" });
      if (!userTemp) {
        return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.INVALID_REFERRAL_CODE } });
      } else {
        let referral = new Referral({ userId: user._id, referredBy: userTemp._id, usedReferralCode: req.body.referralCode, type: "signup", status: "active", referredByStatus: "active" });
        await User.updateOne({ referralCode: req.body.referralCode.toLowerCase(), status: "active" }, { $inc: { totalReferral: 1 } });
        await referral.save();
        if (userTemp.deviceToken && userTemp.deviceToken != "") {
          // let data = {
          //   username: user.firstName
          // };
          // sendFCM(userTemp.deviceToken, data, "referralUsed");
        }
      }
    }
  }

  let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "UR");
  if (!isValid)
    return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: OTP_CONSTANTS.INVALID_OTP }, });

  user.status = "active";
  const token = user.generateAuthToken();
  user.accessToken = token;

  let referralCode = await user.createReferralCode();
  user.referralCode = referralCode;
  // to unset device token of other user from same handset.
  if (req.body.deviceToken) await User.updateMany({ deviceToken: req.body.deviceToken, mobile: { $ne: user.mobile } }, { $set: { deviceToken: "" } });

  ////add customer razorpay
  let razorpay = await createCustomer(user);
  console.log(razorpay, "razorpay");
  user.razorpayCustomerId = razorpay.data._id;


  await user.save();
  user.userId = user._id;
  user.role = "user";
  console.log("user.userId", user._id, "fdff", user.userId);
  let cartId = await createCart(user.deviceToken, user._id.toString());

  let response = _.pick(user, [
    "userId",
    "firstName",
    "lastName",
    "referralCode",
    "role",
    "authType",
    "countryCode",
    "mobile",
    "profilePic",
    "email",
    "status",
    "insertDate",
    "deviceToken",
    "defaultStore",
    "accessToken",
  ]);
  response.cartId = cartId;

  //   let data = {
  //     userName: response.name,
  //     userId: response.userId,
  //     image: response.profilePic,
  //     type: "register",
  //   };
  //   console.log("response ;", response);
  //   if (response.deviceToken && response.deviceToken != "") {
  //     status(400).sendFCM(response.deviceToken, data, "register");
  //   }

  // zoho Integration start
  //  let auth = await ZohoAuth.findOne();
  //  let userDataObj = {
  //    data: [
  //      {
  //        First_Name: response.firstName,
  //        Last_Name: response.lastName,
  //        Email: response.email,
  //        Phone: response.mobile,
  //        Lead_Source: response.authType,
  //        Lead_Status: "user",
  //      },
  //    ],
  //  };
  //  if (config.get("zohoIntegration") == "true") {
  //    let leads = await createLeads(userDataObj, auth.accessToken);
  //    console.log("leads :", leads);
  //    if (leads.data.data[0].status == "success") {
  //      await User.updateOne({ _id: response.userId }, { $set: { isZohoIntegration: true } });
  //    }
  //  }
  // zoho Integration end
  return res.header("Authorization", token).send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response, message: USER_CONSTANTS.REGISTERED_SUCCESSFULLY }, });
});

//login
router.post("/login", async (req, res) => {
  const { error } = validateUserLogin(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let criteria = {};
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.body.email && req.body.email != "") criteria.email = req.body.email.toLowerCase();
  if (mobile && mobile != "") criteria.mobile = mobile;

  let user = await User.findOne(criteria);
  if (!user)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_CREDENTIALS },
    });

  if (user.status != "active")
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INACTIVE_ACCOUNT },
      status: user.status,
    });

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_CREDENTIALS },
    });

  const token = user.generateAuthToken();
  user.accessToken = token;
  user.deviceToken = req.body.deviceToken;
  if (req.body.deviceToken) await User.updateMany({ deviceToken: req.body.deviceToken, mobile: { $ne: user.mobile } }, { $set: { deviceToken: "" } });

  await user.save();
  user.userId = user._id;
  user.role = "user";
  let address = await Address.findOne({ userId: user._id.toString(), isDefaultAddress: true });
  console.log("dhsd", address, user._id);
  let storeName;
  if (user.defaultStore != "") {
    storeName = await Store.findOne({ _id: user.defaultStore });
    storeName = storeName.storeName;
  }

  // if (!address) {
  //   address = user.address;
  // }
  let cartId = await createCart(user.deviceToken, user.userId);
  let response = _.pick(user, ["userId", "role", "name", "accessToken", "countryCode", "mobile", "email", "status", "profilePic", "defaultStore", "insertDate"]);
  response.address = address;
  response.storeName = storeName;
  response.cartId = cartId;

  return res.header("Authorization", token).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response, message: USER_CONSTANTS.LOGGED_IN },
  });
});

//getUserList
router.get("/userList", identityManager(["vendor", "storeManager", "user", "admin"], { users: "W" }), async (req, res) => {
  let criteria = {};
  let criteria1 = {};

  if (req.jwtData.role === "user") {
    criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);
  } else {
    if (req.query.userId) {
      criteria._id = mongoose.Types.ObjectId(req.query.userId);
    }
    if (req.query.status) {
      criteria.status = req.query.status;
    }
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  // if (req.query.text) criteria.name = new RegExp(req.query.name, "i");

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

  if (req.query.email) criteria.email = req.query.email;
  if (req.query.mobile) criteria.mobile = req.query.mobile;
  if (req.query.cityId) {
    criteria.cityId = req.query.cityId;
  }

  if (req.query.cityName) {
    var regexName = new RegExp(".*" + req.query.cityName + ".*", "i");
    criteria1.cityName = { $regex: regexName };
  }
  if (req.query.status) criteria.status = req.query.status;
  if (!req.query.status) criteria.status = { $ne: "deleted" };
  // if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };

  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  let userList = await User.aggregate([
    { $match: criteria },
    { $sort: { creationDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $addFields: {
        userId: { $toString: "$_id" },
      },
    },
    {
      $lookup: {
        from: "addresses",
        let: { userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$isDefaultAddress", true] }],
              },
            },
          },
        ],
        as: "addressData",
      },
    },
    {
      $addFields: {
        address: { $arrayElemAt: ["$addressData.address", 0] },
        location: { $arrayElemAt: ["$addressData.location", 0] },
        cityId: {
          $cond: [{ $ne: ["$cityId", null] }, { $toObjectId: "$cityId" }, "$cityId"],
        },
      },
    },
    {
      $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" },
    },
    { $addFields: { cityName: { $arrayElemAt: ["$cityData.cityName", 0] } } },
    { $match: criteria1 },
    { $project: { addressData: 0, _id: 0, cityData: 0 } },
  ]);
  let totalCount = await User.countDocuments(criteria);
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, userList } });
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
  let checkZero = mobile.charAt(0);
  if (checkZero == "0") {
    mobile = mobile.substring(1);
  }
  if (req.body.mobile) criteria.mobile = mobile;
  if (req.body.email && req.body.mobile) criteria = { $or: [{ email: email }, { mobile: mobile }] };

  let user = await User.findOne(criteria);
  if (user) {
    if (email == user.email && mobile == user.mobile)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: USER_CONSTANTS.MOBILE_EMAIL_ALREADY_EXISTS },
      });
    if (email === user.email)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: USER_CONSTANTS.EMAIL_ALREADY_EXISTS },
      });
    if (mobile === user.mobile)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: USER_CONSTANTS.MOBILE_ALREADY_EXISTS },
      });
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: USER_CONSTANTS.VERIFICATION_SUCCESS },
  });
});

// Fetch user profile
router.get("/profile", identityManager(["user", "admin", "vendor"], { users: "W" }), async (req, res) => {
  if (req.query.otherUserId && req.query.otherUserId != "") {
    userId = req.query.otherUserId;
  } else {
    userId = req.jwtData.userId;
  }
  let user = await User.findById(userId);
  if (!user) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.INVALID_USER } });
  user.userId = user._id;

  let response = _.pick(user, [
    "userId",
    "firstName",
    "lastName",
    "totalReferral",
    "email",
    "mobile",
    "deviceToken",
    "profilePic",
    "status",
    "referralCode",
    "insertDate",
    "countryCode",
  ]);
  response.referralCodeAmount = config.get("referralCodeAmount");
  let data = {
    code: response.referralCode,
    referralCodeAmount: config.get("referralCodeAmount"),
    iosLink: config.get("iosLink"),
    androidLink: config.get("androidLink"),
  };
  let referralMsg = formatter(config.get("referral_link"), data);
  response.referralLink = referralMsg;
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: response });
});

// Update existing user
router.put("/", identityManager(["user", "admin"], { users: "W" }), async (req, res) => {
  const { error } = validateUserPut(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  if (req.jwtData.role === "admin") {
    if (req.body.userId) userId = req.body.userId;
    else
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "UserId required if viewing as admin" },
      });
  }
  if (req.jwtData.role === "user") userId = req.jwtData.userId;

  user = await User.findOne({ _id: userId });
  if (!user) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.INVALID_USER } });

  user.firstName = req.body.firstName || user.firstName;
  user.lastName = req.body.lastName || user.lastName;
  // if (user.defaultStore != req.body.defaultStore) {
  //   let cleanCart = await CartItem.deleteMany({ cartId: req.body.cartId });
  // }
  user.defaultStore = req.body.defaultStore || user.defaultStore;
  user.profilePic = req.body.profilePic || user.profilePic;
  user.countryCode = req.body.countryCode || user.countryCode;
  if (req.body.email == "") {
    user.email = req.body.email;
  }
  user.countryCode = req.body.countryCode || user.countryCode;
  if (req.body.email && req.body.email != user.email) {
    console.log("check 11:");
    tempUser = await User.findOne({ email: req.body.email });
    if (tempUser)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: USER_CONSTANTS.EMAIL_ALREADY_EXISTS },
      });
    // if (req.body.otpToken) {
    //   let isValid = await verifyAndDeleteToken(email, req.body.otpToken, "UU");
    //   if (!isValid) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: OTP_CONSTANTS.INVALID_OTP } });
    // }else {
    //   return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: OTP_CONSTANTS.INVALID_OTP}});
    // }
    user.email = req.body.email;

    //user.emailVerified = false;
    //sendActivationEmail
  }

  // Saving referral code.
  if (req.body.referralCode) {
    let userTemp = await User.findOne({ referralCode: req.body.referralCode, status: "active" });
    if (!userTemp) {
      return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: USER_CONSTANTS.INVALID_REFERRAL_CODE } });
    } else {
      let referral = new Referral({ userId: user._id, referredBy: userTemp._id, type: "signup", status: "active" });
      await User.updateOne({ referralCode: req.body.referralCode, status: "active" }, { $inc: { totalReferral: 1 } });
      await referral.save();
      if (userTemp.deviceToken && userTemp.deviceToken != "") {
        // let data = {
        //   username: user.firstName
        // };
        // sendFCM(userTemp.deviceToken, data, "referralUsed");
      }
    }
  }
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.body.mobile && mobile != user.mobile) {
    let tempUser = await User.findOne({ mobile: mobile });
    if (tempUser)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: USER_CONSTANTS.MOBILE_ALREADY_EXISTS },
      });

    if (req.body.otpToken) {
      let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "UU");
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
    user.mobile = mobile;
  }
  if (req.jwtData.role == "admin") {
    user.status = req.body.status || user.status;
    if (req.body.status != "active") {
      user.accessToken = "";
    }
  }
  await user.save();
  user.userId = user._id;
  user.role = "user";
  let response = _.pick(user, [
    "userId",
    "role",
    "firstName",
    "totalReferral",
    "lastName",
    "mobile",
    "countryCode",
    "email",
    "profilePic",
    "status",
    "referralCode",
    "defaultStore",
    "insertDate",
  ]);

  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: response });
});

//change password
// router.post("/password/change/", identityManager(["user"]), async (req, res) => {
// const { error } = validateChangePassword(req.body);
//   if (error)
//     return res.status(400).send({
//       apiId: req.apiId,
//       statusCode: 400,
//       message: "Failure",
//       data: { message: error.details[0].message }
//     });

//   let user = await User.findById(req.jwtData.userId);
//   if (!user)
//     return res.status(400).send({
//       apiId: req.apiId,
//       statusCode: 400,
//       message: "Failure",
//       data: { message: USER_CONSTANTS.INVALID_USER }
//     });

//   const validPassword = await bcrypt.compare(req.body.oldPassword, user.password);
//   if (!validPassword)
//     return res.status(400).send({
//       apiId: req.apiId,
//       statusCode: 400,
//       message: "Failure",
//       data: { message: USER_CONSTANTS.INVALID_PASSWORD }
//     });

//   let encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
//   user.password = encryptPassword;

//   await user.save();
//   res.send({
//     apiId: req.apiId,
//     statusCode: 200,
//     message: "Success",
//     data: { message: USER_CONSTANTS.PASSWORD_CHANGE_SUCCESS }
//   });
// });

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
  let user = await User.findOne({ mobile: mobile });
  if (!user)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: USER_CONSTANTS.USER_NOT_FOUND },
    });

  let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "UFP");
  if (!isValid)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: OTP_CONSTANTS.INVALID_OTP },
    });

  var encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  user.password = encryptPassword;

  await User.updateOne({ _id: user._id }, { $set: { password: user.password } });
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: AUTH_CONSTANTS.PASSWORD_CHANGE_SUCCESS },
  });
});

router.delete("/", identityManager(["user"]), async (req, res) => {
  let user = await User.findOne({ _id: req.jwtData.userId });
  if (!user)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: USER_CONSTANTS.INVALID_USER },
    });
  await User.deleteOne({ _id: req.jwtData.userId });
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Failure",
    data: { message: USER_CONSTANTS.DELETED_USER },
  });
});

router.post("/logout", identityManager(["user"]), async (req, res) => {
  userId = req.jwtData.userId;
  let user = await User.findById(userId);
  if (!user) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: USER_CONSTANTS.USER_NOT_FOUND },
    });
  }
  // await unsubscribeFromTopic(user.deviceToken, "subscribedUser");

  user.accessToken = "";
  user.deviceToken = "";
  await user.save();
  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Logged out successfully" },
  });
});

//getUserList
router.get("/checkList", identityManager(["public"]), async (req, res) => {
  let criteria = {};
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  // if (req.query.email) criteria.email = req.query.email;
  criteria = { "body.type": "UR" };
  criteria.url = "/api/otp/verifyOtp";
  criteria.statusCode = 400;
  let list = await ApiLog.aggregate([
    { $match: criteria },
    { $skip: skipVal },
    { $limit: limitVal },
    { $addFields: { mobile: "$body.mobile" } },
    {
      $lookup: { from: "users", localField: "mobile", foreignField: "mobile", as: "userData" },
    },
    { $addFields: { isFound: { $anyElementTrue: ["$userData"] } } },
    {
      $match: { isFound: false },
    },
    { $project: { body: 1, url: 1, mobile: 1, statusCode: 1, _id: 0 } },
  ]);
  return res.send({ statusCode: 200, message: "Success", data: { list } });
});

router.post("/delete/account", async (req, res) => {
  const { error } = validateUserDeletionAuthenticate(req.body);
  if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });

  let role = "";
  let user;
  user = await User.findOne({ mobile: req.body.mobile });
  role = "user";
  if (!user) {
    user = await Driver.findOne({ mobile: req.body.mobile });
    role = "driver";
    if (!user) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: `No ${role} found with given phone number.` } });
  }

  let otp = await Otp.findOne({ mobile: req.body.mobile, type: req.body.type });
  if (!otp || req.body.otp !== 1111) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: "otp is incorrect" } });

  if (role === "user") await User.updateOne({ _id: user._id }, { $set: { mobile: "", deletedMobile: user.mobile, email: "", deletedEmail: user.email, accessToken: "", status: "deleted" } });
  if (role === "driver") await Driver.updateOne({ _id: user._id }, { $set: { mobile: "", deletedMobile: user.mobile, email: "", deletedEmail: user.email, accessToken: "", status: "deleted", isOnline: false } });

  return res.status(200).send({ statusCode: 200, message: "Success" });
});

module.exports = router;
