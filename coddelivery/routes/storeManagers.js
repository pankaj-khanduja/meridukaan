const express = require("express")
const config = require("config")
const router = express.Router()
const {
  StoreManager,
  validateStoreManagerRegister,
  validateStoreManagerLogin,
  validateStoreManagerPut,
} = require("../models/storeManager")
const service = require("../services/sendMail")
const bcrypt = require("bcrypt")
const { required } = require("joi")
// const { identityManager } = require("../middleware/auth");
const { identityManager } = require("../middleware/auth")
const { verifyAndDeleteToken } = require("../models/otp")
const mongoose = require("mongoose")
const { STORE_MANAGER_CONSTANTS } = require("../config/constant")
const _ = require("lodash")
const sgMail = require("@sendgrid/mail")
sgMail.setApiKey(config.get("sendGridApiKey"))
const twillio = require("../services/twilio")
const { sendEmailActivationLink } = require("../services/sendMail")
// const { Product, Variant } = require("../models/product");

router.post("/", identityManager(["vendor"]), async (req, res) => {
  if (!req.body.role) {
    req.body.role = "storeManager"
  }
  const { error } = validateStoreManagerRegister(req.body)
  if (error) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    })
  }
  console.log("email :", req.body)
  let email
  if (req.body.email) {
    email = req.body.email.toLowerCase()
  }
  let storeManager = await StoreManager.findOne({ email: email })

  if (storeManager) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: "400",
      message: "Failure",
      data: { message: STORE_MANAGER_CONSTANTS.EMAIL_ALREADY_EXISTS },
    })
  }

  storeManager = new StoreManager(_.pick(req.body, ["name", "mobile", "role", "storeId"]))
  storeManager.email = email
  console.log(req.body.password)
  console.log(config.get("bcryptSalt"))
  storeManager.password = await bcrypt.hash(req.body.password, config.get("bcryptSalt"))

  // const message = {
  //     to: `${req.body.email}`,
  //     from: {
  //       name: 'manjit singh',
  //       email: "xa4204@gmail.com",
  //     },
  //     subject: "email and password for store manager login",
  //     text: `Hello ${req.body.name}, your credentials  are Login id:${req.body.email} \n  password:${req.body.password}`,
  //   };

  //   sgMail
  //     .send(message)
  //     .then((response) => console.log("Email Sent..."))
  //     .catch((error) => console.log(error.message));
  await storeManager.save()
  let response = _.pick(storeManager, ["userId", "name", "mobile", "email", "storeId", "role"])

  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Store manager created successfully", storeManager },
  })
})

router.put("/", identityManager(["vendor", "storeManager"]), async (req, res) => {
  const { error } = validateStoreManagerPut(req.body)
  if (error)
    return res.status(400).send({
      apiId: req.apiID,
      statusCode: 400,
      message: "failure",
      data: { message: error.details[0].message },
    })
  let storeManagerId
  if (req.jwtData.role === "storeManager") {
    storeManagerId = req.jwtData.userId
  } else {
    if (req.body.storeManagerId) {
      storeManagerId = req.body.storeManagerId
    } else
      return res.status(400).send({
        apiId: req.apiID,
        statusCode: 400,
        message: "failure",
        data: { message: "Store Manager Id is required if editing as vendor or admin" },
      })
  }
  let storeManager = await StoreManager.findOne({
    _id: storeManagerId,
    role: "storeManager",
  })
  if (!storeManager)
    return res.status(400).send({
      apiId: req.apiID,
      statusCode: 400,
      message: "failure",
      data: { message: STORE_MANAGER_CONSTANTS.STORE_MANAGER_NOT_FOUND },
    })
  storeManager.name = req.body.name || storeManager.name
  storeManager.email = req.body.email || storeManager.email
  storeManager.mobile = req.body.mobile || storeManager.mobile
  if (req.body.storeId != storeManager.storeId) {
    if (req.jwtData.role === "vendor") {
      storeManager.storeId = req.body.storeId || storeManager.storeId
    } else
      res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Success",
        data: { message: "Only vendor can edit your store." },
      })
  }
  //  storeManager.storeId = req.body.storeId || storeManager.storeId;
  await storeManager.save()
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Store manager updated successfully.", storeManager },
  })
})

router.post("/login", async (req, res) => {
  const { error } = validateStoreManagerLogin(req.body)
  if (error)
    return res.status(400).send({
      apiId: req.apiID,
      statusCode: 400,
      message: "failure",
      data: { message: STORE_MANAGER_CONSTANTS.INVALID_FORMAT },
    })
  let storeManager = await StoreManager.findOne({ email: req.body.email })
  console.log("fsdsd", storeManager)
  if (!storeManager)
    return res.status(400).send({
      apiID: req.apiID,
      statusCode: 400,
      message: "Failure",
      data: { message: STORE_MANAGER_CONSTANTS.STORE_MANAGER_NOT_FOUND },
    })
  // if (storeManager) {
  const validPassword = await bcrypt.compare(req.body.password, storeManager.password)
  console.log(validPassword)
  if (!validPassword)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: STORE_MANAGER_CONSTANTS.INVALID_LOGIN_CREDENTIALS },
    })
  let token
  if (storeManager.role === "storeManager") {
    token = storeManager.generateManagerToken()

    storeManager.accessToken = token
    storeManager.isActive = true
    // storeManager.deviceToken =req.body.deviceToken;
  } else {
    token = storeManager.generateVendorToken()

    storeManager.accessToken = token
    storeManager.isActive = true
    // storeManager.deviceToken =req.body.deviceToken;
  }
  await storeManager.save()

  res.header("Authorization", token).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "You are logged in successfully ", storeManager },
  })
  // } else {
  //   return res.status(400).send({
  //     apiID: req.apiID,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: STORE_MANAGER_CONSTANTS.NOT_REGISTERED },
  //   });
  // }
})

router.get("/managerProfile", identityManager(["admin", "vendor", "storeManager"]), async (req, res) => {
  if (req.jwtData.role === "storeManager") {
    storeManagerId = req.jwtData.userId
  } else storeManagerId = req.query.storeManagerId

  let storeManager = await StoreManager.findOne({ _id: req.query.storeManagerId })
  if (!storeManager)
    return res.status(400).send({
      apiID: req.apiID,
      statusCode: 400,
      message: "Success",
      data: { message: STORE_MANAGER_CONSTANTS.STORE_MANAGER_NOT_FOUND },
    })
  res.send({
    apiID: req.apiID,
    statusCode: 200,
    message: "Success",
    data: { storeManager },
  })
})

router.get("/", identityManager(["admin", "vendor", "storeManager"]), async (req, res) => {
  let managers = await StoreManager.find({
    storeId: req.query.storeId,
    role: "storeManager",
  })
  // if(req.jwtData.role === "storeManager"){}
  res.send({
    apiID: req.apiID,
    statusCode: 200,
    message: "Success",
    data: { managers },
  })
})

//logout a manager
// router.put("/",identityManager(["admin", "vendor", "storeManager"]),async(req, res)=>{
//     let logoutManager = await StoreManager.findOneAndUpdate({_id:req.body.id},{isActive:false},{new:true});
//     return res.status(200).send({
//       apiID: req.apiID,
//       statusCode: 200,
//       message: "logged out successfully",
//       data: { logoutManager },
//     });

// })

router.delete("/:id", identityManager(["admin", "vendor"]), async (req, res) => {
  let criteria = {}
  criteria._id = req.params.id
  let storeManager = await StoreManager.findOne({ _id: req.params.id })
  if (!storeManager) {
    return res.status(400).send({
      apiID: req.apiID,
      statusCode: 400,
      message: "Failure",
      data: { message: STORE_MANAGER_CONSTANTS.STORE_MANAGER_NOT_FOUND },
    })
  }
  await StoreManager.deleteOne({ _id: req.params._id })
  res.send({
    apiID: req.apiID,
    statusCode: 200,
    message: "Success",
    data: { message: STORE_MANAGER_CONSTANTS.STORE_MANAGER_DELETED },
  })
})

module.exports = router
