const express = require("express");
const router = express.Router();
const { Card, validateCardPost, validateCardPut } = require("../models/card");
const { User } = require("../models/user");
const config = require("config");
const { identityManager } = require("../middleware/auth");
const _ = require("lodash");
const mongoose = require("mongoose");
const { verifyTransaction, refundTransaction } = require("../services/flutterWave");
const { accessTokenRequest } = require("../services/zoho");
const { Cart, CartItem } = require("../models/cart");
const { Order } = require("../models/order");
const { sendFCM } = require("../services/fcmModule");
const { DriverAdminLogs } = require("../models/transactionLog");
const { Activity } = require("../models/activity");
const { Driver } = require("../models/driver");
const { Coupon } = require("../models/coupon");
const { Redemption } = require("../models/redemption.js");
const { Referral } = require("../models/referral");
const { PayoutEntry } = require("../models/payoutEntry");
const { paymentLinkById } = require("../services/razorPayFunctions");
const { sendTemplateEmail } = require("../services/amazonSes");

const { ORDER_CONSTANTS, CART_CONSTANTS } = require("../config/constant");
const { Vendor } = require("../models/vendor");
const { Webhook } = require("../models/webhook");




router.post("/placeOrder/:appType", async (req, res) => {
  console.log(" req.query : ", req.query);
  const event = req.body.event
  console.log('event', event)
  console.log('body', req.body)
  let webhook = new Webhook({
    data: req.body,
    type: "paymentLink"
  });

  await webhook.save();

  res.sendStatus(200);
});

//// callback  api 
router.get("/placeOrder/:appType", async (req, res) => {
  // console.log('reqFromRazorPay', req)
  // console.log(" req.query : ", req.query);
  const event = req.body.event
  console.log('event', event)
  console.log('body', req.body)
  let redirectUrl;
  if (req.params.appType == "web") {
    redirectUrl = config.get("orderWebhookRedirectUrl");
  } else {
    redirectUrl = config.get("redirectBaseUrl") + "/";
  }
  if (req.query.razorpay_payment_link_status == "paid") {
    // let response = await paymentLinkById(req.query.razorpay_payment_link_id);
    // console.log("response.data 11111", response);

    // if (response.data.status == "success") {
    let order = await Order.findOne({ _id: req.query.orderId });
    if (!order) {
      return res.send({
        apiId: req.apiId,
        statusCode: 200,
        message: "Success",
        data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND, response }
      });
    }
    if (order.vendorCategory != "pickUpAndDrop") {
      let cart = await Cart.findOne({ userId: order.userId });
      if (!cart) {
        return res.send({
          apiId: req.apiId,
          statusCode: 200,
          message: "Success",
          data: { message: CART_CONSTANTS.CART_NOT_FOUND, response }
        });
      }
      if (order.details.referralDiscount > 0) {
        let referral = await Referral.findOne({ _id: order.referralId });
        if (referral.status != "redeemed") {
          referral.status = "redeemed";
        } else {
          referral.referredByStatus = "redeemed";
          await User.updateOne({ _id: order.userId }, { $inc: { totalReferral: -1 } })
        }

        await referral.save();
      }

      await CartItem.deleteMany({ cartId: cart._id });
      cart.subTotal = 0;
      cart.cartDiscount = 0;
      cart.totalAmount = 0;
      cart.referralDiscount = 0;
      cart.sendCartNotification = false;
      cart.distance = 0;
      cart.deliveryCharges = 0;
      cart.couponId = "";
      cart.couponCode = "";
      await cart.save();
      //let order = await Order.findOne({ _id: orderId });
      order.orderStatus = "ACTIVE";
      // let currentTime = Math.round(new Date() / 1000);

      let user = await User.findOne({ _id: order.userId });
      let data = {
        type: "orderPlaced"
      };
      if (user && user.deviceToken != "") {
        await sendFCM(user.deviceToken, data, "orderPlaced");
      }
      if (order.details.couponId != "") {
        await Coupon.updateOne({ _id: order.details.couponId }, { $inc: { redemptionCount: 1 } });
      }
    } else {
      let currentTime = Math.round(new Date() / 1000);
      if (order.details.deliveryTime <= currentTime) {
        order.orderStatus = "ACCEPTED";
      } else {
        order.orderStatus = "UPCOMING";
      }
    }
    console.log("hhhhhhhhhhhhsdgsdgsdgsd");
    order.isOrderAmtPaidToAdmin = true;
    order.isOrderSeen = false;
    order.razorpay_payment_id = req.query.razorpay_payment_id;
    order.paymentLinkStatus = req.query.razorpay_payment_link_status;
    order.razorpay_payment_link_reference_id = req.query.razorpay_payment_link_reference_id;
    order.razorpay_payment_link_id = req.query.razorpay_payment_link_id

    await order.save();
    let data = {};
    let vendor = await Vendor.findOne({ _id: order.vendorId });
    if (vendor) {
      await sendTemplateEmail(vendor.email, data, "vendorNewOrder");
    }
    if (order.details.couponId && order.details.couponId != "") {
      let redemption = await Redemption.insertMany([
        { userId: order.userId, couponId: order.details.couponId }
      ]);
    }
    if (order.details.couponId != "") {
      let redemption = await Redemption.insertMany([{ userId: order.userId, couponId: order.details.couponId }]);
    }
    console.log(redirectUrl + "?status=success&message=Successfully", "successCase");

    // return res.redirect(redirectUrl + "?status=success&message=Successfully");

    return res.status(200).send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { message: "Successfully" }, });

    // } else {
    //   return res.redirect(redirectUrl + "?status=failure&message=Failed");
    // }
  } else {
    console.log(redirectUrl + "?status=failure&message=Failed", "failedCase");
    // return res.redirect(redirectUrl + "?status=failure&message=Failed");
    return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: "Failed" }, });

  }
});

router.post("/payout", async (req, res) => {
  console.log(" req.body : ", req.body);
  let bodyObject = {};
  if (config.get("environment") == "dev" || config.get("environment") == "uat") {
    bodyObject = req.body.transfer;
  } else if (config.get("environment") == "prod") {
    bodyObject = req.body.data;
  }

  if (bodyObject.status == "SUCCESSFUL") {
    console.log("low balance", bodyObject.complete_message);
    await PayoutEntry.updateMany(
      { parentPayoutId: bodyObject.reference },
      { $set: { status: "success", transferId: bodyObject.id } }
    );
  } else if (bodyObject.status == "FAILED") {
    if (bodyObject.complete_message == "DISBURSE FAILED: Insufficient funds in customer balance") {
      await PayoutEntry.updateMany(
        { parentPayoutId: bodyObject.reference },
        { $set: { failureType: "temporary", status: "failure", transferId: bodyObject.id } }
      );
      let haltedPayout = await PayoutEntry.findOne({ status: "halted" });
      if (!haltedPayout) {
        await PayoutEntry.updateMany(
          { status: "pending", type: { $ne: "codByDriver" } },
          { $set: { status: "halted" } }
        );
      }
    } else {
      if ((bodyObject.complete_message = "Account resolve failed")) {
        await PayoutEntry.updateMany(
          { parentPayoutId: bodyObject.reference },
          { $set: { failureType: "permanent", transferId: bodyObject.id, status: "failure" } }
        );
      }
    }
    // payout.status = "failure";

    // log.status = "failure";
  }
  // payout.transferId = bodyObject.id;
  // await log.save();
  // await payout.save();
  return res.send("OK");
});

router.get("/createCard/:appType", async (req, res) => {
  let redirectUrl;
  if (req.params.appType == "test") {
    redirectUrl = config.get("herokuRedirectUrl");
  } else {
    if (req.params.appType == "web") {
      redirectUrl = config.get("cardWebhookRedirectUrl");
    } else {
      redirectUrl = config.get("redirectBaseUrl") + "/api/result";
    }
  }
  // console.log("reqqqqq", req.query);
  if (req.query.status == "successful") {
    let response = await verifyTransaction(req.query.transaction_id);
    if (response.data.data.meta.redirectUrl) {
      redirectUrl = response.data.data.meta.redirectUrl;
    } else {
      if (req.params.appType == "test") {
        redirectUrl = config.get("herokuRedirectUrl");
      } else {
        redirectUrl = config.get("redirectBaseUrl") + "/api/result";
      }
    }
    if (response.data.status == "success") {
      let token = response.data.data.card.token;
      let first_6digits = response.data.data.card.first_6digits;
      let last_4digits = response.data.data.card.last_4digits;
      let userId = response.data.data.meta.consumer_id;
      console.log("response.data", response.data.data);

      let email = response.data.data.customer.email;
      let orderId = response.data.data.tx_ref;
      let card = await Card.findOne({ userId: userId, first6Digits: first_6digits, last4Digits: last_4digits });
      console.log("card .", card);

      if (!card) {
        card = new Card({
          userId: userId,
          first6Digits: first_6digits,
          last4Digits: last_4digits,
          email: email,
          nameOnCard: response.data.data.customer.name,
          cardScheme: response.data.data.card.type,
          cardType: response.data.data.card.issuer,
          expiry: response.data.data.card.expiry,
          cardToken: token,
          status: "active"
        });
        await card.save();
      }
      let data = {
        amount: 1,
        id: response.data.data.id
      };
      let refund = await refundTransaction(data);
      console.log("refundddd", refund);
      // let redirectUrl;
      // if (response.data.data.meta.redirectUrl) {
      //   redirectUrl = response.data.data.meta.redirectUrl;
      // } else {
      //   redirectUrl = config.get("redirectBaseUrl");
      // }
      return res.redirect(redirectUrl + "?status=1&message=Successfully");
    } else {
      return res.redirect(redirectUrl + "?status=0&message=Failed");
    }
  } else {
    let response = await verifyTransaction(req.query.transaction_id);
    console.log("responseee", response);
    return res.redirect(redirectUrl + "?status=0&message=Failed");
  }
});

router.get("/codPaymentBydriver", async (req, res) => {
  if (req.query.status == "successful") {
    let criteria = {};
    console.log("req.queryyyyyyy", req.query);

    let response = await verifyTransaction(req.query.transaction_id);
    console.log("response", response);
    if (response.data.status == "success") {
      let token = response.data.data.card.token;
      let first_6digits = response.data.data.card.first_6digits;
      let last_4digits = response.data.data.card.last_4digits;
      let userId = response.data.data.meta.consumer_id;
      let logId = response.data.data.tx_ref;
      console.log("response.data");
      let email = response.data.data.customer.email;

      let card = await Card.findOne({ userId: userId, first6Digits: first_6digits, last4Digits: last_4digits });
      console.log("card .", card);

      if (!card) {
        card = new Card({
          userId: userId,
          first6Digits: first_6digits,
          last4Digits: last_4digits,
          nameOnCard: response.data.data.customer.name,
          cardScheme: response.data.data.card.type,
          cardType: response.data.data.card.issuer,
          expiry: response.data.data.card.expiry,
          cardToken: token,
          email: email,
          status: "active"
        });
        await card.save();
      }
      // console.log("log...MetaData", log.metaData);
      let log = await DriverAdminLogs.findOne({ _id: logId });
      console.log("log", log);
      log.status = "success";
      await log.save();

      let activity = new Activity({});
      activity.userId = log.userId;
      activity.data = { amount: log.paymentAmount };
      activity.type = "paidToAdmin";
      await activity.save();
      await Order.updateMany(
        { driverId: log.userId, orderStatus: "DELIVERED" },
        { $set: { isOrderAmtPaidToAdmin: true } }
      );
      let payoutIds = log.metaData.map((x) => mongoose.Types.ObjectId(x));

      await PayoutEntry.updateMany(
        { _id: { $in: payoutIds } },
        { $set: { status: "completed", accumulatedSum: 0 }, $push: { transactionId: log._id.toString() } }
      );
      await Driver.updateOne({ _id: log.userId }, { $set: { isFreezed: false, freezeDriverAt: 0 } });

      // let data = {
      //   type: "orderPlaced",
      // };
      // let user = await User.findOne({ _id: order.userId });
      // if (user && user.deviceToken != "") {
      //   await sendFCM(user.deviceToken, data, "orderPlaced");
      // }
      return res.redirect(config.get("redirectBaseUrl") + "/api/result?status=1&message=Successfully");
    } else {
      return res.redirect(config.get("redirectBaseUrl") + "/api/result?status=0&message=Failed");
    }
  } else {
    return res.redirect(config.get("redirectBaseUrl") + "/api/result?status=0&message=Failed");
  }
});

router.get("/deliveryTip/:appType", async (req, res) => {
  let redirectUrl = "";
  if (req.params.appType == "web") {
    redirectUrl = config.get("orderTipRedirectUrl");
  } else {
    redirectUrl = config.get("redirectBaseUrl") + "/api/result";
  }
  if (req.query.status == "successful") {
    let criteria = {};

    // let response = await verifyTransaction(req.query.transaction_id);
    if (req.query.razorpay_payment_link_status == "paid") {
      // let token = response.data.data.card.token;
      // let first_6digits = response.data.data.card.first_6digits;
      // let last_4digits = response.data.data.card.last_4digits;
      // let userId = response.data.data.meta.consumer_id;
      let logId = req.query.driverAdminLogId;
      let email = response.data.data.customer.email;

      // // logId = logId.split(".");
      // // logId = logId[1];
      // // let orderNo = logId[0];
      // let splitLogId = logId.split(".");
      // let orderNo = splitLogId[0];
      // logId = splitLogId[1];

      // console.log("logidddd", logId);
      // let card = await Card.findOne({ userId: userId, first6Digits: first_6digits, last4Digits: last_4digits });
      // console.log("card .", card);

      // if (!card) {
      //   card = new Card({
      //     userId: userId,
      //     first6Digits: first_6digits,
      //     last4Digits: last_4digits,
      //     nameOnCard: response.data.data.customer.name,
      //     cardScheme: response.data.data.card.type,
      //     cardType: response.data.data.card.issuer,
      //     expiry: response.data.data.card.expiry,
      //     cardToken: token,
      //     email: email,
      //     status: "active"
      //   });
      //   await card.save();
      // }
      let log = await DriverAdminLogs.findOne({ _id: logId });
      log.status = "success";
      await log.save();
      console.log('adminDrverLogData', log)
      let activity = new Activity({});
      activity.userId = log.otherDetails.userId;
      activity.data = { amount: log.paymentAmount, userId: log.otherDetails.userId, orderNo: log.otherDetails.orderNo };
      activity.type = "tipPaidByUser";
      await activity.save();
      let user = await User.findOne({ _id: log.userId });
      let driver = await Driver.findOne({ _id: log.otherDetails.userId });
      if (driver && driver.deviceToken != "") {
        let data = {
          type: "driverTip",
          userName: user.firstName,
          amount: log.paymentAmount.toString()
        };
        await sendFCM(driver.deviceToken, data, "driverTip");
      }
      await Order.updateMany({ orderNo: log.otherDetails.orderNo }, { $set: { deliveryTip: log.paymentAmount } });

      return res.redirect(redirectUrl + "?status=1&message=Successfully");
    } else {
      return res.redirect(redirectUrl + "?status=0&message=Failed");
    }
  } else {
    return res.redirect(redirectUrl + "?status=0&message=Failed");
  }
});

router.post('/payment/success', async (req, res) => {
  // udf1 -> userId
  // udf2 -> orderId 
  // udf3 -> devicetype
  // udf4 -> paymentType 
  // udf5 -> driverId
  let redirectUrl
  try {
    if (req.body.udf3 == "web") {
      redirectUrl = config.get("orderWebhookRedirectUrl");
    } else {
      redirectUrl = config.get("redirectBaseUrl") + "/api/result";
    }
    if (req.body.status === "success") {
      let token = req.body.card_token;
      const cardNumber = req.body.card_no;
      let email = req.body.email;
      let userId = req.body.udf1;
      let orderId = req.body.udf2;
      let paymentType = req.body.udf4;
      let driverId = req.body.udf5
      const txnId = req.body.txnid
      const { amount, txnid, } = req.body
      console.log('webhook details', {
        orderId,
        paymentType,
        driverId,
      })
      // let first_6digits = response.data.data.card.first_6digits;
      // let last_4digits = response.data.data.card.last_4digits;
      // let card = await Card.findOne({ userId: userId, first6Digits: first_6digits, last4Digits: last_4digits });
      // if (!card) {
      //   card = new Card({
      //     userId: userId,
      //     first6Digits: first_6digits,
      //     last4Digits: last_4digits,
      //     email: email,
      //     nameOnCard: response.data.data.customer.name,
      //     cardScheme: response.data.data.card.type,
      //     cardType: response.data.data.card.issuer,
      //     expiry: response.data.data.card.expiry,
      //     cardToken: token,
      //     status: "active"
      //   });
      //   await card.save();
      // }

      /* 
      SINCE PAYU PROVIDES ONLY ONE PAYMENT WEBHOOOK FOR SUCCESS, WE'LL HANDLE DIFFERENT CASES
      BASED ON VARIABLE, 'paymentType'
      */


      switch (paymentType) {
        case 'deliveryTip':
          // code to handle driver tip
          {
            let order = await Order.findOne({ _id: orderId });
            if (!order) {
              return res.send({
                apiId: req.apiId,
                statusCode: 200,
                message: "Success",
                data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND, data: req.body }
              });
            }
            let activity = new Activity({});
            activity.userId = userId;
            activity.data = { amount: amount, userId: driverId, orderNo: order.orderNo };
            activity.type = "tipPaidByUser";
            await activity.save();
            let user = await User.findOne({ _id: userId });
            let driver = await Driver.findOne({ _id: driverId });
            if (driver && driver.deviceToken != "") {
              let data = {
                type: "driverTip",
                userName: user.firstName,
                amount: amount.toString()
              };
              await sendFCM(driver.deviceToken, data, "driverTip");
            }
            await Order.updateMany({ orderNo: order.orderNo }, { $set: { deliveryTip: amount } });
            break
          }

        default:
          // handling order payment
          /* DEFAULT CASE ORDER PAYMENT START*/
          {
            let order = await Order.findOne({ _id: orderId });
            if (!order) {
              return res.send({
                apiId: req.apiId,
                statusCode: 200,
                message: "Success",
                data: { message: ORDER_CONSTANTS.ORDER_NOT_FOUND, data: req.body }
              });
            }
            if (order.vendorCategory != "pickUpAndDrop") {
              let cart = await Cart.findOne({ userId: userId });
              if (!cart) {
                return res.send({
                  apiId: req.apiId,
                  statusCode: 200,
                  message: "Success",
                  data: { message: CART_CONSTANTS.CART_NOT_FOUND, data: req.body }
                });
              }
              if (order.details.referralDiscount > 0) {
                let referral = await Referral.findOne({ _id: order.referralId });
                referral.status = "redeemed";
                await referral.save();
              }

              await CartItem.deleteMany({ cartId: cart._id });
              cart.subTotal = 0;
              cart.cartDiscount = 0;
              cart.totalAmount = 0;
              cart.referralDiscount = 0;
              cart.sendCartNotification = false;
              cart.distance = 0;
              cart.deliveryCharges = 0;
              cart.couponId = "";
              cart.couponCode = "";
              await cart.save();
              order.orderStatus = "ACTIVE";
              // let currentTime = Math.round(new Date() / 1000);
              let user = await User.findOne({ _id: order.userId });
              let data = {
                type: "orderPlaced"
              };
              if (user && user.deviceToken != "") {
                await sendFCM(user.deviceToken, data, "orderPlaced");
              }
              if (order.details.couponId != "") {
                await Coupon.updateOne({ _id: order.details.couponId }, { $inc: { redemptionCount: 1 } });
              }
            } else {
              let currentTime = Math.round(new Date() / 1000);
              if (order.details.deliveryTime <= currentTime) {
                order.orderStatus = "ACCEPTED";
              } else {
                order.orderStatus = "UPCOMING";
              }
            }
            order.isOrderAmtPaidToAdmin = true;
            order.isOrderSeen = false;
            // order.flutterwaveRef = response.data.data.flw_ref;
            order.transactionId = req.body.mihpayid;
            // order.cardDetails = response.data.data.card;
            // order.cardId = card._id;
            await order.save();
            let data = {};
            let vendor = await Vendor.findOne({ _id: order.vendorId });
            if (vendor) {
              await sendTemplateEmail(vendor.email, data, "vendorNewOrder");
            }
            if (order.details.couponId && order.details.couponId != "") {
              let redemption = await Redemption.insertMany([
                { userId: userId, couponId: order.details.couponId }
              ]);
            }
            if (order.details.couponId != "") {
              let redemption = await Redemption.insertMany([{ userId: order.userId, couponId: order.details.couponId }]);
            }
          }
        /* DEFAULT CASE ORDER PAYMENT END*/
      }

      console.log('webHookFlowComplete')
      return res.redirect(redirectUrl + "?status=1&message=Successfully");
    } else {
      return res.redirect(redirectUrl + "?status=0&message=Failed");
    }
  }
  catch (e) {
    console.log('webhookPaymentSuccessError')
    console.log(e)
  }
})

router.post('/payment/fail', async (req, res) => {
  try {
    let redirectUrl;
    if (req.body.udf3 == "web") {
      redirectUrl = config.get("orderWebhookRedirectUrl");
    } else {
      redirectUrl = config.get("redirectBaseUrl") + "/api/result";
    }
    return res.redirect(redirectUrl + "?status=0&message=Failed");

  }
  catch (e) {
    console.log('webhookPaymentFailError')
    console.log(e)
  }
})
module.exports = router;
