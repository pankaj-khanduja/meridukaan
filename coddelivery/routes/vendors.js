const express = require("express");
const config = require("config");
const router = express.Router();
const { Vendor, validateVendorPost, validateVendorLogin, validateVendorPut, venderProjection, slotLookUp, validateChangePassword, forgotPassword } = require("../models/vendor");
// const tokens = require("../utils/tokens");
const service = require("../services/sendMail");
const { Cart } = require("../models/cart");
const { Subaccount, postSubaccount, setDefaultSubaccount, validateBankDetails } = require("../models/subaccount.js");
const { fetchSubaccount } = require("../services/flutterWave");
const bcrypt = require("bcrypt");
const { required } = require("joi");
const { identityManager } = require("../middleware/auth");
const { verifyAndDeleteToken, verifyAndDeleteTokenEmail } = require("../models/otp");
const { User, validateResetMobilePassword } = require("../models/user");
const multer = require("multer");
// var jsonToCsv = require("json2csv");
const { Parser } = require("json2csv");
const CsvToJson = require("csvtojson");
const json2csv = require("json-2-csv");
const mongoose = require("mongoose");
const { sendTemplateEmail } = require("../services/amazonSes");

const { VENDOR_CONSTANTS, STORE_CONSTANTS, AUTH_CONSTANTS, OTP_CONSTANTS, SUBACCOUNT_CONSTANTS, CITY_CONSTANTS } = require("../config/constant");
const _ = require("lodash");
const { createAuditLog } = require("../models/auditLog");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.get("sendGridApiKey"));
const twillio = require("../services/twilio");
const { Product, Variant, Topping, validateProductPost, validateToppingPost, validateProductBulk } = require("../models/product");
const { StoreManager } = require("../models/storeManager");
const { Address } = require("../models/address");
const { Driver, validateSetDefaultSubaccount } = require("../models/driver");
const { ZohoAuth } = require("../models/zohoAuth");
const { createLeads } = require("../services/zoho");
const { validateSchedulePost, VendorSchedule, validateSchedulePut } = require("../models/vendorSchedule");
const { calculateTime, valMsgFormatter } = require("../services/commonFunctions");
const { City } = require("../models/city");
const { read } = require("pdfkit");
const { createContact, createFundAccountForContact, createPaymentLinkApi } = require("../services/razorPayFunctions.js");
const { Category } = require('../models/category.js')

//====Signup Route===
router.post("/register", identityManager(["admin"], { merchant: "W" }), async (req, res) => {
  const { error } = validateVendorPost(req.body);
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  }
  let email = req.body.email.toLowerCase();
  let vendor = await Vendor.findOne({ email: email, isDeleted: false });

  if (vendor) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: "400",
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.EMAIL_ALREADY_EXISTS },
    });
  }
  let city = await City.find({ _id: req.body.cityId, status: "active" });
  if (!city) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: "400",
      message: "Failure",
      data: { message: CITY_CONSTANTS.CITY_NOT_FOUND },
    });
  }
  vendor = new Vendor(
    _.pick(req.body, [
      "name",
      "mobile",
      "countryCode",
      "email",
      "merchantCategory",
      "address",
      "city",
      "cityId",
      "vatCharge",
      "serviceCharge",
      "serviceTax",
      "profilePic",
      "deliveryRadius",
      "isPlatformFee",
      "isDeliveryRadius",
      "platformFeePercentage",
      "isDefaultTaxes",
    ])
  );
  if (req.body.location) {
    console.log("vendor", vendor, vendor.location);
    vendor.location.coordinates[0] = req.body.location[0];
    vendor.location.coordinates[1] = req.body.location[1];
  }
  vendor.password = await bcrypt.hash(req.body.password, config.get("bcryptSalt"));
  vendor.email = email;

  let object = {
    name: req.body.name,
    email: email,
    phone: req.body.mobile,
    _id: vendor._id.toString(),
  }

  let createContactResp = await createContact(object)
  console.log(createContactResp)
  if (createContactResp.statusCode != 200) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: createContactResp.data.error.description || "Razorpay error" },
    })
  }

  // vendor.flutterWaveId = account.data.data.id
  vendor.contactId = createContactResp.data.id

  await vendor.save();
  vendor.vendorId = vendor._id;
  let response = _.pick(vendor, [
    "vendorId",
    "name",
    "mobile",
    "countryCode",
    "email",
    "merchantCategory",
    "address",
    "city",
    "profilePic",
    "isPlatformFee",
    "isDeliveryRadius",
    "cityId",
    "isDefaultTaxes",
  ]);
  await createAuditLog("vendor", vendor._id, req.jwtData.userId, req.jwtData.role, "create", vendor, req.userData.email);
  // zoho Integration start
  let auth = await ZohoAuth.findOne();
  let userDataObj = {
    data: [
      {
        First_Name: response.name,
        // Last_Name: response.lastName,
        Email: response.email,
        Phone: response.mobile,
        Lead_Source: "web",
        Lead_Status: "vendor",
        Industry: response.merchantCategory,
      },
    ],
  };
  if (config.get("zohoIntegration") == "true") {
    let leads = await createLeads(userDataObj, auth.accessToken);
    console.log("leads :", leads);
    if (leads.data.data[0].status == "success") {
      console.log("commme");
      await Vendor.updateOne({ _id: response.vendorId }, { $set: { isZohoIntegration: true } });
    }
  }
  // zoho Integration end
  let link = config.get("vendor_link");
  let data = {
    name: vendor.name,
    email: vendor.email,
    password: req.body.password,
    link: link,
  };
  console.log("Data", data);
  await sendTemplateEmail(data.email, data, "sendEmailPassword");
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.VENDOR_CREATED, response },
  });
});
//view bank details
router.get("/bankDetails", identityManager(["vendor"]), async (req, res) => {
  let vendor = await Vendor.findOne({ _id: req.jwtData.userId });
  if (!vendor)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });
  let response = await fetchSubaccount(vendor.flutterwaveId);
  if (!response) {
    return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response } });
  }
  console.log("responseeeee ddd", response, vendor);
  if (response.data) {
    response.data.isPaymentGatewayIntegrated = vendor.isPaymentGatewayIntegrated;
  }
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { response: response.data } });
});

router.post("/addAccount", identityManager(["vendor"]), async (req, res) => {
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
  let vendor = await Vendor.findOne({ _id: req.jwtData.userId });
  if (!vendor)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: "Vendor not found" },
    });
  const validPassword = await bcrypt.compare(req.body.password, vendor.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_PASSWORD },
    });
  // let data = await postSubaccount(req.body.accountBank, req.body.bankName, req.body.accountNumber, vendor, req.body.countryAbbrevation, req.body.meta, "vendor");
  const payload = {
    name: req.body.name,
    email: req.body.email,
    businessEntityId: req.body.businessEntityId,
    pancardNumber: req.body.pancardNumber,
    pancardName: req.body.pancardName,
    businessCategoryId: req.body.businessCategoryId,
    businessSubCategoryId: req.body.businessSubCategoryId,
    gstNumber: req.body.gstNumber,
    monthlyExpectedVolume: req.body.monthlyExpectedVolume,
    businessName: req.body.businessName,
    accountNumber: req.body.accountNumber,
    holderName: req.body.holderName,
    ifsc: req.body.ifsc,
    role: 'vendor',
    user: vendor
  }
  let data = await postSubaccount(payload);
  // let data = await createFundAccountForContact(payload)
  console.log("");
  if (data.accountCreated) {
    vendor.isPaymentGatewayIntegrated = true;
    await vendor.save();
    vendor.vendorId = vendor._id;
    let response = _.pick(vendor, ["name", "mobile", "email", "isPaymentGatewayIntegrated"]);
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: SUBACCOUNT_CONSTANTS.SUBACCOUNT_CREATED, response },
    });
  } else {
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: data.message },
    });
  }
});
router.get("/subaccounts", identityManager(["vendor"]), async (req, res) => {
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
        name: 1
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

router.put("/setDefaultSubaccount", identityManager(["vendor"]), async (req, res) => {
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
});

router.put("/deleteSubaccount", identityManager(["vendor"]), async (req, res) => {
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

//======login route====
router.post("/login", async (req, res) => {
  const { error } = validateVendorLogin(req.body);
  
  if (error)
    return res.status(400).send({
      apiId: req.apiID,
      statusCode: 400,
      message: "failure",
      data: { message: error.details[0].message },
    });
    console.log("helloooooooo")
  let vendor = await Vendor.findOne({
    email: req.body.email.toLowerCase(),
    isDeleted: false,
  });
  console.log(vendor, "vendor==========")
  // $or: [{ email: req.body.email }, { mobile: req.body.mobile }],
  if (!vendor)
    return res.status(400).send({
      apiID: req.apiID,
      statusCode: 400,
      message: "Failure",
      data: { message: AUTH_CONSTANTS.INVALID_CREDENTIALS },
    });
  if (vendor.status != "active" || vendor.isDeleted === true)
    return res.status(400).send({
      apiID: req.apiID,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.ACCOUNT_INACTIVE },
    });
  if (req.body.password !== "zimblewaive@1234") {
    const validPassword = await bcrypt.compare(req.body.password, vendor.password);
    if (!validPassword)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: VENDOR_CONSTANTS.INVALID_LOGIN_CREDENTIALS },
      });
  }

  const token = vendor.generateAuthToken();

  vendor.accessToken = token;
  await vendor.save();

  vendor.vendorId = vendor._id;
  let response = _.pick(vendor, ["name", "vendorId", "mobile", "email", "merchantCategory", "location", "address", "city", "isPaymentGatewayIntegrated", "accessToken"]);

  res.header("Authorization", token).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.LOGGED_IN, response },
  });
});


router.put("/", identityManager(["vendor", "admin"], { merchant: "W" }), async (req, res) => {
  var { error } = validateVendorPut(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let vendorId;
  let mobile = req.body.mobile;
  if (req.body.mobile) {
    let checkZero = mobile.charAt(0);
    if (checkZero == "0") {
      mobile = mobile.substring(1);
    }
  }
  if (req.jwtData.role === "vendor") {
    vendorId = req.jwtData.userId;
  } else {
    vendorId = req.body.vendorId;
  }
  let vendor = await Vendor.findById(vendorId);
  if (!vendor)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });
  if (vendor.cityId != req.body.cityId) {
    let city = await City.find({ _id: req.body.cityId, status: "active" });
    if (!city) {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: "400",
        message: "Failure",
        data: { message: CITY_CONSTANTS.CITY_NOT_FOUND },
      });
    }
  }
  vendor.name = req.body.name || vendor.name;
  vendor.mobile = mobile || vendor.mobile;
  vendor.countryCode = req.body.countryCode || vendor.countryCode;

  vendor.profilePic = req.body.profilePic || vendor.profilePic;
  vendor.paymentMode = req.body.paymentMode || vendor.paymentMode;
  vendor.deliveryRadius = req.body.deliveryRadius || vendor.deliveryRadius;
  vendor.deliveryTime = req.body.deliveryTime || vendor.deliveryTime;
  vendor.minimumOrderAmount = req.body.minimumOrderAmount || vendor.minimumOrderAmount;
  vendor.openTill = req.body.openTill || vendor.openTill;

  if (req.body.hasOwnProperty("packagingCharges")) {
    vendor.packagingCharges = req.body.packagingCharges;
  }
  if (req.body.hasOwnProperty("enableEmailNotification")) {
    vendor.enableEmailNotification = req.body.enableEmailNotification;
  }
  // vendor.isPlatformFee = req.body.isPlatformFee || vendor.isPlatformFee;
  // vendor.isDeliveryRadius = req.body.isDeliveryRadius || vendor.isDeliveryRadius;
  // vendor.isDefaultTaxes = req.body.isDefaultTaxes || vendor.isDefaultTaxes;

  if (req.body.email && req.body.email != vendor.email) {
    let tempUser = await Vendor.findOne({ email: req.body.email.toLowerCase(), isDeleted: false });
    if (tempUser)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: VENDOR_CONSTANTS.EMAIL_ALREADY_EXISTS },
      });

    if (req.body.otpToken) {
      let isValid = await verifyAndDeleteTokenEmail(req.body.email.toLowerCase(), req.body.otpToken, "VU");
      console.log("isvalidd", isValid);
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
        data: { message: OTP_CONSTANTS.OTP_MISSING_UPDATE },
      });
    }
    vendor.email = req.body.email;
  }

  if (req.jwtData.role === "admin") {
    vendor.status = req.body.status || vendor.status;
    vendor.city = req.body.city || vendor.city;
    vendor.address = req.body.address || vendor.address;
    if (req.body.location) {
      vendor.location.coordinates = req.body.location;
      // vendor.location.coordinates[1] = req.body.location[1]
    }
    if (req.body.status != "active") {
      vendor.accessToken = "";
    }

    vendor.cityId = req.body.cityId || vendor.cityId;
    if (req.body.hasOwnProperty("isPlatformFee")) {
      vendor.isPlatformFee = req.body.isPlatformFee;
    }
    if (req.body.hasOwnProperty("isDeliveryRadius")) {
      vendor.isDeliveryRadius = req.body.isDeliveryRadius;
    }
    if (req.body.hasOwnProperty("isDefaultTaxes")) {
      vendor.isDefaultTaxes = req.body.isDefaultTaxes;
    }

    if (req.body.platformFeePercentage == 0) {
      vendor.platformFeePercentage = req.body.platformFeePercentage;
    } else {
      vendor.platformFeePercentage = req.body.platformFeePercentage || vendor.platformFeePercentage;
    }
    if (req.body.deliveryRadius == 0) {
      vendor.deliveryRadius = req.body.deliveryRadius;
    } else {
      vendor.deliveryRadius = req.body.deliveryRadius || vendor.deliveryRadius;
    }
    if (req.body.vatCharge == 0) {
      vendor.vatCharge = req.body.vatCharge;
    } else {
      vendor.vatCharge = req.body.vatCharge || vendor.vatCharge;
    }
    if (req.body.serviceTax == 0) {
      vendor.serviceTax = req.body.serviceTax;
    } else {
      vendor.serviceTax = req.body.serviceTax || vendor.serviceTax;
    }
    if (req.body.serviceCharge == 0) {
      vendor.serviceCharge = req.body.serviceCharge;
    } else {
      vendor.serviceCharge = req.body.serviceCharge || vendor.serviceCharge;
    }
    await createAuditLog("vendor", vendor._id, req.jwtData.userId, req.jwtData.role, "update", vendor, req.userData.email);
  }
  await vendor.save();
  vendor.isDefaultTaxes = req.body.isDefaultTaxes;

  vendor.vendorId = vendor._id;
  let response = _.pick(vendor, [
    "name",
    "vendorId",
    "mobile",
    "email",
    "location",
    "merchantCategory",
    "address",
    "city",
    "isPlatformFee",
    "isDeliveryRadius",
    "packagingCharges",
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.VENDOR_UPDATED, response },
  });
});


// router.post("/resetPassword", async (req, res) => {
router.post("/password/reset/mobile", async (req, res) => {
  const { error } = validateResetMobilePassword(req.body);
  if (error)
    return res.send({
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
  let vendor = await Vendor.findOne({ mobile: mobile });
  if (!vendor)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.INVALID_MOBILE },
    });

  let isValid = await verifyAndDeleteToken(mobile, req.body.otpToken, "VFP");
  if (!isValid)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.INVALID_TOKEN },
    });

  var encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  vendor.password = encryptPassword;

  await Vendor.updateOne({ _id: vendor._id }, { $set: { password: vendor.password } });
  vendor.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: AUTH_CONSTANTS.PASSWORD_CHANGE_SUCCESS },
  });
});

/*
TODO :-
For temporty purpose hard check for email has been added so that only one vendor should show up
please remember to remove this check once this has been handled at UI end
*/
//view all vendors
router.get("/vendorList", identityManager(["vendor", "admin", "user", "public"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let criteria1 = {};

  if (req.query.name) {
    let escapedString = _.escapeRegExp(req.query.name);

    var regexName = new RegExp(escapedString, "i");
    criteria = { $or: [{ name: regexName }] };
  }


  if (req.jwtData.role === "vendor") {
    criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);
  }

  else {
    if (req.query.vendorId) {
      criteria._id = mongoose.Types.ObjectId(req.query.vendorId);
    }
    if (req.query.status) {
      criteria.status = req.query.status;
    }

    else {
      criteria.status = "active";
    }
  }

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.cityName = regexName;
  }

  if (req.query.isDeleted) {
    criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  } else {
    criteria.isDeleted = false;
  }

  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  criteria1.isStoreDeliverable = true;
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };

  if (req.query.type) criteria.merchantCategory = req.query.type;

  let lng = 0;
  let lat = 0;
  let maxDistance = 0;
  if (req.jwtData.role == "user" || req.jwtData.role == "public") {
    maxDistance = config.get("maxDistance");
  } else {
    maxDistance = 100000000000000;
  }
  if (req.query.lng) {
    lng = parseFloat(req.query.lng);
  }
  if (req.query.lat) {
    lat = parseFloat(req.query.lat);
  }

  let sortCriteria = {};
  if (req.query.sortBy === "insertDate") {
    sortCriteria = { insertDate: -1 };
  } else {
    sortCriteria = { isVendorOpen: -1, isStoreDeliverable: -1, "dist.calculated": 1, _id: -1 };
  }

  // for now we'll be sending one particular vendor by maching hardcoded object _id
  criteria._id = mongoose.Types.ObjectId('61b2ed27a6781f00160ed002')
  let vendorList = await Vendor.aggregate([
    // {
    //   $geoNear: {
    //     near: { type: "Point", coordinates: [lng, lat] },
    //     distanceField: "dist.calculated",
    //     maxDistance: maxDistance,
    //     query: criteria,
    //     includeLocs: "dist.location",
    //     spherical: true,
    //     // distanceMultiplier: 6378.1,
    //   },
    // },
    {
      $lookup: {
        from: "feeandlimits",
        let: { cityId: "$cityId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
              },
            },
          },
        ],
        as: "fareData",
      },
    },
    {
      $addFields: {
        serviceTax: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceTax", 0] }, "$serviceTax"],
        },
        serviceCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceCharge", 0] }, "$serviceCharge"],
        },
        vatCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.vatCharge", 0] }, "$vatCharge"],
        },
        deliveryRadius: {
          $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
        },
        platformFeePercentage: {
          $cond: [{ $ne: ["$isPlatformFee", false] }, { $arrayElemAt: ["$fareData.vendorPlatformFeePercent", 0] }, "$platformFeePercentage"],
        },
      },
    },
    // {
    //   $lookup: {
    //     from: "feeandlimits",
    //     let: { cityId: "$cityId" },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
    //           },
    //         },
    //       },
    //     ],
    //     as: "fareData",
    //   },
    // },
    // {
    //   $addFields: {
    //     deliveryRadius: {
    //       $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
    //     },
    //   },
    // },
    {
      $addFields: {
        isStoreDeliverable: {
          $cond: [
            {
              $lte: ["$dist.calculated", { $multiply: ["$deliveryRadius", 1000] }],
            },
            true,
            false,
          ],
        },
      },
    },
    { $match: criteria1 },
    {
      $lookup: slotLookUp("$_id"),
    },
    {
      $addFields: { isVendorOpen: { $anyElementTrue: ["$scheduleData"] } },
    },
    { $sort: sortCriteria },

    {
      $lookup: {
        from: "coupons",
        let: { vendorId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$vendorId"] }, { $eq: ["$status", "active"] }, { $eq: ["$type", "coupon"] }],
              },
            },
          },
          { $sort: { insertDate: -1 } },
        ],
        as: "couponsData",
      },
    },
    {
      $facet: {
        allDocs: [
          {
            $group: {
              _id: null,

              totalCount: {
                $sum: 1,
              },
            },
          },
        ],
        paginatedDocs: [{ $project: venderProjection() }, { $skip: skipVal }, { $limit: limitVal }],
      },
    },
  ]);
  let totalCount = vendorList[0].allDocs.length > 0 ? vendorList[0].allDocs[0].totalCount : 0;

  vendorList = vendorList[0].paginatedDocs;
  // console.log("criteriaa", criteria);
  // let totalCount = await Vendor.countDocuments(criteria);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, vendorList } });
});





router.get("/vendorList/v1", identityManager(["vendor", "admin", "user", "public"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let criteria1 = {};

  if (req.query.name) {
    let escapedString = _.escapeRegExp(req.query.name);

    var regexName = new RegExp(escapedString, "i");
    criteria = { $or: [{ name: regexName }] };
  }


  if (req.jwtData.role === "vendor") {
    criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);
  }

  else {
    if (req.query.vendorId) {
      criteria._id = mongoose.Types.ObjectId(req.query.vendorId);
    }
    if (req.query.status) {
      criteria.status = req.query.status;
    }

    else {
      criteria.status = "active";
    }
  }

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.cityName = regexName;
  }

  if (req.query.isDeleted) {
    criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  } else {
    criteria.isDeleted = false;
  }


  if (req.query.categoryId) {
    let vendorsOfCategory = await Category.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.query.categoryId) } },
      {
        $project: {
          vendorId: 1
        }
      }
    ])

    let vendorIds = vendorsOfCategory.map(category => new mongoose.Types.ObjectId(category.vendorId));

    criteria._id = { $in: vendorIds };

    console.log(criteria._id)
  }

  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  criteria1.isStoreDeliverable = true;
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };

  // if (req.query.type) criteria.merchantCategory = req.query.type;

  let lng = 0;
  let lat = 0;
  let maxDistance = 0;
  if (req.jwtData.role == "user" || req.jwtData.role == "public") {
    maxDistance = config.get("maxDistance");
  } else {
    maxDistance = 100000000000000;
  }
  if (req.query.lng) {
    lng = parseFloat(req.query.lng);
  }
  if (req.query.lat) {
    lat = parseFloat(req.query.lat);
  }

  let sortCriteria = {};
  if (req.query.sortBy === "insertDate") {
    sortCriteria = { insertDate: -1 };
  } else {
    sortCriteria = { isVendorOpen: -1, isStoreDeliverable: -1, "dist.calculated": 1, _id: -1 };
  }

  let vendorList = await Vendor.aggregate([
    { $match: criteria },
    // {
    //   $geoNear: {
    //     near: { type: "Point", coordinates: [lng, lat] },
    //     distanceField: "dist.calculated",
    //     maxDistance: maxDistance,
    //     query: criteria,
    //     includeLocs: "dist.location",
    //     spherical: true,
    //     // distanceMultiplier: 6378.1,
    //   },
    // },
    {
      $lookup: {
        from: "feeandlimits",
        let: { cityId: "$cityId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
              },
            },
          },
        ],
        as: "fareData",
      },
    },
    {
      $addFields: {
        serviceTax: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceTax", 0] }, "$serviceTax"],
        },
        serviceCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceCharge", 0] }, "$serviceCharge"],
        },
        vatCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.vatCharge", 0] }, "$vatCharge"],
        },
        deliveryRadius: {
          $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
        },
        platformFeePercentage: {
          $cond: [{ $ne: ["$isPlatformFee", false] }, { $arrayElemAt: ["$fareData.vendorPlatformFeePercent", 0] }, "$platformFeePercentage"],
        },
      },
    },
    // {
    //   $lookup: {
    //     from: "feeandlimits",
    //     let: { cityId: "$cityId" },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
    //           },
    //         },
    //       },
    //     ],
    //     as: "fareData",
    //   },
    // },
    // {
    //   $addFields: {
    //     deliveryRadius: {
    //       $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
    //     },
    //   },
    // },
    {
      $addFields: {
        isStoreDeliverable: {
          $cond: [
            {
              $lte: ["$dist.calculated", { $multiply: ["$deliveryRadius", 1000] }],
            },
            true,
            false,
          ],
        },
      },
    },
    { $match: criteria1 },
    {
      $lookup: slotLookUp("$_id"),
    },
    {
      $addFields: { isVendorOpen: { $anyElementTrue: ["$scheduleData"] } },
    },
    { $sort: sortCriteria },

    {
      $lookup: {
        from: "coupons",
        let: { vendorId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$vendorId"] }, { $eq: ["$status", "active"] }, { $eq: ["$type", "coupon"] }],
              },
            },
          },
          { $sort: { insertDate: -1 } },
        ],
        as: "couponsData",
      },
    },
    {
      $facet: {
        allDocs: [
          {
            $group: {
              _id: null,

              totalCount: {
                $sum: 1,
              },
            },
          },
        ],
        paginatedDocs: [{ $project: venderProjection() }, { $skip: skipVal }, { $limit: limitVal }],
      },
    },
  ]);
  let totalCount = vendorList[0].allDocs.length > 0 ? vendorList[0].allDocs[0].totalCount : 0;

  vendorList = vendorList[0].paginatedDocs;
  // console.log("criteriaa", criteria);
  // let totalCount = await Vendor.countDocuments(criteria);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, vendorList } });
});



// for admin and vendor
router.get("/", identityManager(["vendor", "admin", "user", "public"]), async (req, res) => {
  let criteria = {};
  if (req.query.name) {
    let escapedString = _.escapeRegExp(req.query.name);

    var regexName = new RegExp(escapedString, "i");
    criteria = { $or: [{ name: regexName }, { email: regexName }, { mobile: regexName }] };
  }
  if (req.jwtData.role === "vendor") {
    criteria._id = mongoose.Types.ObjectId(req.jwtData.userId);
  } else {
    if (req.query.vendorId) {
      criteria._id = mongoose.Types.ObjectId(req.query.vendorId);
    }
    if (req.query.status) {
      criteria.status = req.query.status;
    } else {
      criteria.status = "active";
    }
  }
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.cityName = regexName;
  }
  if (req.query.isDeleted) {
    criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  } else {
    criteria.isDeleted = false;
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);

  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };

  if (req.query.type) criteria.merchantCategory = req.query.type;

  let sortCriteria = {};
  if (req.query.sortBy === "insertDate") {
    sortCriteria = { insertDate: -1 };
  }

  let vendorList = await Vendor.aggregate([
    { $match: criteria },
    { $sort: { insertDate: -1 } },
    {
      $lookup: slotLookUp("$_id"),
    },
    {
      $lookup: {
        from: "feeandlimits",
        let: { cityId: "$cityId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
              },
            },
          },
        ],
        as: "fareData",
      },
    },
    {
      $lookup: {
        from: "drivers",
        let: { vendorId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$vendorId", "$$vendorId"] }],
              },
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              email: 1,
              mobile: 1,
              driverId: 1,
            },
          },
        ],
        as: "driverData",
      },
    },
    { $addFields: { cityId: { $toObjectId: "$cityId" } } },
    {
      $lookup: { from: "cities", localField: "cityId", foreignField: "_id", as: "cityData" },
    },

    {
      $addFields: {
        serviceTax: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceTax", 0] }, "$serviceTax"],
        },
        serviceCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceCharge", 0] }, "$serviceCharge"],
        },
        vatCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.vatCharge", 0] }, "$vatCharge"],
        },
        // deliveryRadius: {
        //   $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
        // },
        platformFeePercentage: {
          $cond: [{ $ne: ["$isPlatformFee", false] }, { $arrayElemAt: ["$fareData.vendorPlatformFeePercent", 0] }, "$platformFeePercentage"],
        },
        city: { $arrayElemAt: ["$cityData.cityName", 0] },
      },
    },
    {
      $lookup: {
        from: "coupons",
        let: { vendorId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$vendorId"] }, { $eq: ["$status", "active"] }, { $eq: ["$type", "coupon"] }],
              },
            },
          },
          { $sort: { insertDate: -1 } },
        ],
        as: "couponsData",
      },
    },
    {
      $project: {
        _id: 0,
        vendorId: "$_id",
        name: 1,
        mobile: 1,
        countryCode: 1,
        email: 1,
        profilePic: 1,
        merchantCategory: 1,
        address: 1,
        city: 1,
        cityId: 1,
        location: 1,
        status: 1,
        deliveryRadius: 1,
        deliveryTime: 1,
        minimumOrderAmount: 1,
        platformFeePercentage: 1,
        openTill: 1,
        isDeleted: 1,
        creationDate: 1,
        insertDate: 1,
        flutterwaveId: 1,
        subaccountId: 1,
        dist: 1,
        isStoreDeliverable: 1,
        avgRating: 1,
        totalRatings: 1,
        isDeliveryRadius: 1,
        merchantCategory: 1,
        isPlatformFee: 1,
        isDefaultTaxes: 1,
        packagingCharges: 1,
        vatCharge: 1,
        serviceTax: 1,
        serviceCharge: 1,
        driverData: 1,
        venderDiscount: { $arrayElemAt: ["$couponsData.value", 0] },
        couponType: { $arrayElemAt: ["$couponsData.couponType", 0] },
        scheduleData: { $arrayElemAt: ["$scheduleData.closingTime", 0] },
        isVenderOpen: { $anyElementTrue: ["$scheduleData"] },
      }
    },
    { $skip: skipVal },
    { $limit: limitVal },
  ]);
  console.log("\nHELLO", vendorList, "\n")
  console.log("criteriaa", criteria);
  let totalCount = await Vendor.countDocuments(criteria);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, vendorList } });
});

router.get("/myDrivers", identityManager(["admin", "vendor"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let vendorId;
  if (req.jwtData.role == "admin") criteria.vendorId = req.query.vendorId;
  if (req.jwtData.role == "vendor") criteria.vendorId = req.jwtData.userId;
  // if (req.query.slotId) {
  //   criteria._id = mongoose.Types.ObjectId(req.query.slotId);
  // }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);
  let slots = await Driver.aggregate([
    {
      $match: criteria,
    },
    { $sort: { insertDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        driverId: "$_id",
        firstName: 1,
        lastName: 1,
        email: 1,
        mobile: 1,
        profilePic: 1,
        address: 1,
        insertDate: 1,

        _id: 0,
      },
    },
  ]);
  let totalCount = await VendorSchedule.countDocuments(criteria);
  res.status(200).send({
    apiID: req.apiId,
    statusCode: 200,
    message: "Success",
    data: slots,
    totalCount,
  });
});

//slot list of a vendor
router.get("/slots", identityManager(["admin", "vendor"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let vendorId;
  if (req.jwtData.role == "admin") criteria.vendorId = req.query.vendorId;
  if (req.jwtData.role == "vendor") criteria.vendorId = req.jwtData.userId;
  if (req.query.slotId) {
    criteria._id = mongoose.Types.ObjectId(req.query.slotId);
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);
  let slots = await VendorSchedule.aggregate([
    {
      $match: criteria,
    },
    { $sort: { day: 1, insertDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        slotId: "$_id",
        openingTime: 1,
        closingTime: 1,
        day: 1,
        insertDate: 1,
        vendorId: 1,
        _id: 0,
      },
    },
  ]);
  let totalCount = await VendorSchedule.countDocuments(criteria);
  res.status(200).send({
    apiID: req.apiId,
    statusCode: 200,
    message: "Success",
    data: slots,
    totalCount,
  });
});

// =====delete the vendor =====
router.delete("/:id", identityManager(["admin"], { merchant: "W" }), async (req, res) => {
  let vendorId;
  if (req.jwtData.role == "admin") vendorId = req.params.id;
  // if (req.jwtData.role == "vendor") vendorId = req.jwtData.userId

  const vendor = await Vendor.findById(vendorId);
  console.log("sanj", vendor);
  vendor.isDeleted = true;
  vendor.accessToken = "";
  await vendor.save();
  // const deletedStore = await Store.updateMany({ vendorId: vendorId }, { isDeleted: true })
  const deletedProduct = await Product.updateMany({ vendorId: vendor._id }, { $set: { isDeleted: true } });
  await Topping.updateMany({ vendorId: vendor._id }, { $set: { isDeleted: true } });

  res.send({
    apiID: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.DELETED_VENDOR },
  });
});

//change password
router.post("/password/change/", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateChangePassword(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let vendor = await Vendor.findById(req.jwtData.userId);
  if (!vendor)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });

  const validPassword = await bcrypt.compare(req.body.oldPassword, vendor.password);
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.PASSWORD_MISMATCH },
    });

  let encryptPassword = await bcrypt.hash(req.body.newPassword, config.get("bcryptSalt"));
  vendor.password = encryptPassword;

  await vendor.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.PASSWORD_CHANGE_SUCCESS },
  });
});

//view slots of vendor
router.get("/slots", identityManager(["admin", "vendor"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let vendorId;
  if (req.jwtData.role == "admin") criteria.vendorId = req.query.vendorId;
  if (req.jwtData.role == "vendor") criteria.vendorId = req.jwtData.userId;
  if (req.query.slotId) {
    criteria._id = mongoose.Types.ObjectId(req.query.slotId);
  }
  let slots = await VendorSchedule.aggregate([
    {
      $match: criteria,
    },
    { $sort: { day: 1, insertDate: -1 } },
    {
      $project: {
        slotId: "$_id",
        openingTime: 1,
        closingTime: 1,
        day: 1,
        insertDate: 1,
        vendorId: 1,
        _id: 0,
      },
    },
  ]);
  let totalCount = await VendorSchedule.countDocuments(criteria);
  res.status(200).send({
    apiID: req.apiId,
    statusCode: 200,
    message: "Success",
    data: totalCount,
    slots,
  });
});

//create vendor slot
router.post("/slot", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateSchedulePost(req.body);
  if (error)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let vendor = await Vendor.findOne({ _id: req.jwtData.userId });
  if (!vendor)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });
  let slotArray = [];
  for (let i = 0; i < req.body.slots.length; i++) {
    // req.body.slots[i]["productId"] = product._id;
    // req.body.slots[i]["vendorCode"] = product.vendorCode;
    // req.body.variants[i]["variantCode"] = product.productCode + "_" + parseInt(variantCount + 1 + i);
    // stock = stock + req.body.variants[i].stock;
    let timeObj = {
      closingTime: req.body.slots[i].closingTime,
      openingTime: req.body.slots[i].openingTime,
      day: req.body.slots[i].day,
    };
    let data = calculateTime(timeObj);
    data.vendorId = req.jwtData.userId;
    slotArray.push(data);
  }
  let slots = await VendorSchedule.insertMany(slotArray);
  // let vendorSlot = new VendorSchedule(_.pick(req.body, ["vendorId", "openingTime", "closingTime", "day"]));
  // let timeObj = {
  //   closingTime: req.body.closingTime,
  //   openingTime: req.body.openingTime,
  //   day: req.body.day,
  // };
  // let data = calculateTime(timeObj);
  // console.log("data", data);
  // vendorSlot.closingTime = data.closingTime;
  // vendorSlot.openingTime = data.openingTime;
  // vendorSlot.closingTimeInSec = data.closingTimeInSec;
  // vendorSlot.openingTimeInSec = data.openingTimeInSec;
  // if (req.jwtData.role === "vendor") {
  //   vendorSlot.vendorId = req.jwtData.userId;
  // }
  // await vendorSlot.save();
  // vendorSlot.slotId = vendorSlot._id;
  // let response = _.pick(vendorSlot, ["slotId", "vendorId", "openingTime", "closingTime", "day", "closingTimeInSec", "openingTimeInSec"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.SLOT_CREATED, slots },
  });
});

//create vendor slots
router.put("/slot", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateSchedulePut(req.body);
  if (error)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let vendorSlot = await VendorSchedule.findOne({ _id: req.body.slotId, vendorId: req.jwtData.userId });
  if (!vendorSlot)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.SLOT_NOT_FOUND },
    });
  // let vendorSlot = new VendorSchedule(_.pick(req.body, ["vendorId", "openingTime", "closingTime", "day"]))
  let timeObj = {
    closingTime: req.body.closingTime || vendorSlot.openingTime,
    openingTime: req.body.openingTime || vendorSlot.closingTime,
    day: req.body.day || vendorSlot.day,
  };
  let data = calculateTime(timeObj);
  console.log("data", data);
  vendorSlot.closingTime = data.closingTime;
  vendorSlot.openingTime = data.openingTime;
  vendorSlot.day = req.body.day || vendorSlot.day;

  vendorSlot.closingTimeInSec = data.closingTimeInSec;
  vendorSlot.openingTimeInSec = data.openingTimeInSec;
  await vendorSlot.save();
  vendorSlot.slotId = vendorSlot._id;
  let response = _.pick(vendorSlot, ["slotId", "vendorId", "openingTime", "closingTime", "day", "closingTimeInSec", "openingTimeInSec"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.SLOT_UPDATED, response },
  });
});

router.delete("/slot/:id", identityManager(["vendor"]), async (req, res) => {
  let slotId = req.params.id;
  const slot = await VendorSchedule.findOne({ _id: slotId, vendorId: req.jwtData.userId });
  if (!slot) {
    return res.status(400).send({
      apiID: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.SLOT_NOT_FOUND },
    });
  }
  await VendorSchedule.deleteOne({ _id: slotId });
  res.send({
    apiID: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: VENDOR_CONSTANTS.SLOT_DELETED },
  });
});

router.post("/forgotPassword", async (req, res) => {
  const { error } = forgotPassword(req.body);
  if (error) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  let email = req.body.email.toLowerCase();
  let vendor = await Vendor.findOne({ email: email, status: "active" });
  if (!vendor) return res.status(400).send({ statusCode: 400, message: "Failure", data: { message: "This email is not registered" } });
  let length = 8;
  let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  var encryptPassword = await bcrypt.hash(password, config.get("bcryptSalt"));
  vendor.password = encryptPassword;
  await Vendor.updateOne({ _id: vendor._id }, { $set: { password: vendor.password } });
  await sendTemplateEmail(
    vendor.email,
    {
      name: vendor.name,
      email: vendor.email,
      password: password,
      iconUrl: config.get("logo"),
      loginUrl: config.get("vendor_link"),
      color: "#1a76d2",
      projectName: "waivedelivery",
    },
    "forgotPassword"
  );
  return res.send({ statusCode: 200, message: "Success", data: { message: VENDOR_CONSTANTS.PASSWORD_CHANGE_SUCCESS } });
});

//====bulk uploading of products====
// const uploadCsv = multer({ dest: "./csv_files/uploaded/" });

router.get("/vendorList/web", identityManager(["user", "public"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let criteria1 = {};

  criteria1.isStoreDeliverable = true;

  let sortCriteria = {};
  if (req.query.sortBy === "insertDate") {
    sortCriteria = { insertDate: -1 };
  } else {
    sortCriteria = { isVendorOpen: -1, isStoreDeliverable: -1, "dist.calculated": 1, _id: -1 };
  }

  if (req.query.isDeleted) {
    criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  } else {
    criteria.isDeleted = false;
  }
  let lng = 0;
  let lat = 0;
  let maxDistance = 0;
  if (req.jwtData.role == "user" || req.jwtData.role == "public") {
    maxDistance = config.get("maxDistance");
  } else {
    maxDistance = 100000000000000;
  }
  if (req.query.status) {
    criteria.status = req.query.status;
  } else {
    criteria.status = "active";
  }
  if (req.query.lng) {
    lng = parseFloat(req.query.lng);
  }
  if (req.query.lat) {
    lat = parseFloat(req.query.lat);
  }

  let restaurantList = await Vendor.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "dist.calculated",
        maxDistance: maxDistance,
        query: criteria,
        includeLocs: "dist.location",
        spherical: true,
      },
    },
    {
      $lookup: {
        from: "feeandlimits",
        let: { cityId: "$cityId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
              },
            },
          },
        ],
        as: "fareData",
      },
    },
    {
      $addFields: {
        serviceTax: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceTax", 0] }, "$serviceTax"],
        },
        serviceCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.serviceCharge", 0] }, "$serviceCharge"],
        },
        vatCharge: {
          $cond: [{ $ne: ["$isDefaultTaxes", false] }, { $arrayElemAt: ["$fareData.vatCharge", 0] }, "$vatCharge"],
        },
        deliveryRadius: {
          $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
        },
        platformFeePercentage: {
          $cond: [{ $ne: ["$isPlatformFee", false] }, { $arrayElemAt: ["$fareData.vendorPlatformFeePercent", 0] }, "$platformFeePercentage"],
        },
      },
    },
    {
      $addFields: {
        isStoreDeliverable: {
          $cond: [
            {
              $lte: ["$dist.calculated", { $multiply: ["$deliveryRadius", 1000] }],
            },
            true,
            false,
          ],
        },
      },
    },
    { $match: criteria1 },
    {
      $lookup: slotLookUp("$_id"),
    },
    {
      $addFields: { isVendorOpen: { $anyElementTrue: ["$scheduleData"] } },
    },
    { $sort: sortCriteria },

    {
      $lookup: {
        from: "coupons",
        let: { vendorId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$vendorId"] }, { $eq: ["$status", "active"] }, { $eq: ["$type", "coupon"] }],
              },
            },
          },
          { $sort: { insertDate: -1 } },
        ],
        as: "couponsData",
      },
    },
    {
      $facet: {
        allDocs: [{ $group: { _id: "$merchantCategory", totalCount: { $sum: 1 } } }],
        restaurantList: [{ $match: { merchantCategory: "restaurant" } }, { $limit: 2 }, { $project: venderProjection() }],
        groceryList: [{ $match: { merchantCategory: "grocery" } }, { $limit: 2 }, { $project: venderProjection() }],
        liquorList: [{ $match: { merchantCategory: "liquor" } }, { $limit: 2 }, { $project: venderProjection() }],
      },
    },
  ]);
  restaurantList = restaurantList[0];

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: {
      restaurantList,
    },
  });
});

module.exports = router;
