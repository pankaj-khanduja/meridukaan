const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const config = require("config");
const { identityManager } = require("../middleware/auth");
const {
  PayoutEntry,
  validatePaymentHistory,
  validateDriverPayoutDetails,
  validatePayoutOrders
} = require("../models/payoutEntry");
const { validateRetryTransfer } = require("../models/payoutEntry");
const { PAYOUT_CONSTANTS } = require("../config/constant");
const { retryPayout, autoPayout } = require("../services/flutterWave");
const { settlementCod } = require("../jobs/payout");
const { Order } = require("../models/order");
const { Subaccount } = require("../models/subaccount");
const { DriverAdminLogs } = require("../models/transactionLog");

router.get("/", identityManager(["vendor", "admin", "influencer", "driver"], { payout: "W" }), async (req, res) => {
  const { error } = validatePaymentHistory(req.query);
  if (error)
    return res
      .status(400)
      .send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  var criteria = {};
  if (req.query.type == "bulkVendorPayout") {
    criteria.type = "vendor";
  } else if (req.query.type == "bulkDriverPayout") {
    criteria.type = { $in: ["driver", "codByDriver"] };
  } else {
    criteria.type = "influencer";
  }

  //   criteria.otherDetails.userId = req.jwtData.userId;
  if (req.jwtData.role == "influencer" || req.jwtData.role == "vendor" || req.jwtData.role == "driver") {
    criteria = { "userDetails.userId": req.jwtData.userId };
  }

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ "userDetails.firstName": regexName }, { "userDetails.email": regexName }];
  }
  if (req.query.status) {
    criteria.status = req.query.status;
  } else {
    criteria.status = { $ne: "queued" };
  }
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null)
    criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);

  let totalCount = await PayoutEntry.countDocuments(criteria);
  let driverAdminLogs = await PayoutEntry.aggregate([
    {
      $match: criteria
    },
    {
      $sort: { insertDate: -1 }
    },
    { $skip: skipVal },
    { $limit: limitVal },

    { $addFields: { userId: { $toObjectId: "$userDetails.userId" } } },
    { $lookup: { from: "influencers", localField: "userId", foreignField: "_id", as: "influencerData" } },
    { $lookup: { from: "vendors", localField: "userId", foreignField: "_id", as: "vendorData" } },
    { $lookup: { from: "drivers", localField: "userId", foreignField: "_id", as: "driverData" } },

    {
      $project: {
        payoutId: "$_id",
        status: 1,
        failureType: 1,
        paidBy: 1,
        amount: "$accumulatedSum",
        userId: "$userDetails.userId",
        paidTo: 1,
        codAmount: 1,
        userAmount: 1,
        initialSum: 1,
        isSettled: 1,
        payoutNo: 1,

        firstName: {
          $switch: {
            branches: [
              { case: { $eq: ["$type", "vendor"] }, then: { $arrayElemAt: ["$vendorData.name", 0] } },
              { case: { $eq: ["$type", "influencer"] }, then: { $arrayElemAt: ["$influencerData.name", 0] } }
            ],
            default: { $arrayElemAt: ["$driverData.firstName", 0] }
          }
        },

        // { $arrayElemAt: ["$otherDetails.data.meta.FirstName", 0] },
        lastName: {
          $switch: {
            branches: [
              { case: { $eq: ["$type", "vendor"] }, then: "" },
              { case: { $eq: ["$type", "influencer"] }, then: "" }
            ],
            default: { $arrayElemAt: ["$driverData.lastName", 0] }
          }
        },

        email: {
          $switch: {
            branches: [
              { case: { $eq: ["$type", "vendor"] }, then: { $arrayElemAt: ["$vendorData.email", 0] } },
              { case: { $eq: ["$type", "influencer"] }, then: { $arrayElemAt: ["$influencerData.email", 0] } }
            ],
            default: { $arrayElemAt: ["$driverData.email", 0] }
          }
        },
        type: 1,

        insertDate: 1,
        creationDate: 1,
        _id: 0
      }
    }
  ]);
  let payoutEntry = await PayoutEntry.findOne({ status: "halted" });
  let insufficientBalance = false;
  if (payoutEntry) {
    insufficientBalance = true;
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, driverAdminLogs, insufficientBalance }
  });
});

router.get("/driverPayouts", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  // const { error } = validateDriverDetails(req.query);
  // if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
  var criteria = {};
  criteria.type = { $in: ["codByDriver", "driver"] };

  // if (req.query.type == "driver") {
  //   criteria.settledWith = { $in: [req.query.payoutId] };
  // } else if (req.query.type == "codByDriver") {
  //   let payout = await PayoutEntry.findOne({ _id: req.query.payoutId });
  //   console.log("payout", payout);
  //   let payoutIds = payout.settledWith.map((x) => mongoose.Types.ObjectId(x));
  //   criteria._id = { $in: payoutIds };
  // }

  //   criteria.otherDetails.userId = req.jwtData.userId;
  // if (req.jwtData.role == "influencer" || req.jwtData.role == "vendor" || req.jwtData.role == "driver") {
  //   criteria = { "userDetails.userId": req.jwtData.userId };
  // }

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ "userDetails.firstName": regexName }, { "userDetails.email": regexName }];
  }
  // if (req.query.status) {
  //   criteria.status = req.query.status;
  // }else {
  //   criteria.status = { $ne: "queued" };
  // }
  // if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  // if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  // if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);

  // let totalCount = await PayoutEntry.countDocuments(criteria);
  let driverAdminLogs = await PayoutEntry.aggregate([
    {
      $match: criteria
    },
    {
      $sort: { insertDate: -1 }
    },
    //  {
    //   $facet:{
    //         allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],

    //     paginatedDocs:[{
    //       $group: {
    //         _id: "$userDetails.userId",
    //         codAmount: { $sum: "$codAmount" },
    //         userAmount: { $sum: "$userAmount" },
    //       },

    //     { $addFields: { userId: { $toObjectId: "$_id" } , netAmount: { $subtract: ["$codAmount", "$userAmount"] } }},
    //     { $lookup: { from: "drivers", localField: "userId", foreignField: "_id", as: "driverData" } },
    //     { $skip: skipVal },
    //     { $limit: limitVal },
    //     }],
    // },
    //  }
    {
      $group: {
        _id: "$userDetails.userId"
        // codAmount: { $sum: "$codAmount" },
        // userAmount: { $sum: "$userAmount" },
      }
    },
    {
      $facet: {
        allDocs: [{ $group: { _id: null, totalCount: { $sum: 1 } } }],
        paginatedDocs: [
          // {
          //   $group: {
          //     _id: "$userDetails.userId",
          //     codAmount: { $sum: "$codAmount" },
          //     userAmount: { $sum: "$userAmount" },
          //   },
          // },
          {
            $addFields: {
              userId: { $toObjectId: "$_id" }
              //  netAmount: { $round: [{ $subtract: ["$codAmount", "$userAmount"] }, 2] }
            }
          },
          { $lookup: { from: "drivers", localField: "userId", foreignField: "_id", as: "driverData" } },
          { $skip: skipVal },
          { $limit: limitVal },
          {
            $project: {
              // netAmount: {
              //   $cond: [{ $lte: ["$netAmount", 0] }, "$netAmount", "$netAmount"],
              // },
              firstName: { $arrayElemAt: ["$driverData.firstName", 0] },
              lastName: { $arrayElemAt: ["$driverData.lastName", 0] },
              email: { $arrayElemAt: ["$driverData.email", 0] },
              mobile: { $arrayElemAt: ["$driverData.mobile", 0] },
              insertDate: 1,
              creationDate: 1,
              driverId: "$_id",
              _id: 0
            }
          }
        ]
      }
    }
  ]);
  let totalCount = driverAdminLogs[0].allDocs[0].totalCount;
  driverAdminLogs = driverAdminLogs[0].paginatedDocs;
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, driverAdminLogs } });
});
router.get(
  "/driverPayoutDetails",
  identityManager(["vendor", "admin", "influencer", "driver"], { payout: "W" }),
  async (req, res) => {
    const { error } = validateDriverPayoutDetails(req.query);
    if (error)
      return res
        .status(400)
        .send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
    var criteria = {};

    criteria = { "userDetails.userId": req.query.userId };
    // if (req.query.type == "driver") {
    //   criteria.settledWith = { $in: [req.query.payoutId] };
    // } else if (req.query.type == "codByDriver") {
    //   let payout = await PayoutEntry.findOne({ _id: req.query.payoutId });
    //   console.log("payout", payout);
    //   let payoutIds = payout.settledWith.map((x) => mongoose.Types.ObjectId(x));
    //   criteria._id = { $in: payoutIds };
    // }

    //   criteria.otherDetails.userId = req.jwtData.userId;
    if (req.jwtData.role == "influencer" || req.jwtData.role == "vendor" || req.jwtData.role == "driver") {
      criteria = { "userDetails.userId": req.jwtData.userId };
    } else {
      criteria = { "userDetails.userId": req.query.userId };
    }
    // let criteria1 = {};
    // criteria1 = { "userDetails.userId": req.query.userId };
    if (req.query.text) {
      var regexName = new RegExp(req.query.text, "i");
      criteria.$or = [{ "userDetails.firstName": regexName }, { "userDetails.email": regexName }];
    }
    if (req.query.type) {
      criteria.type = req.query.type;
    }
    if (req.query.status) {
      criteria.status = req.query.status;
    }
    //else {
    //   criteria.status = { $ne: "queued" };
    // }
    if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
    if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
    if (req.query.startDate != null && req.query.endDate != null)
      criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
    var skipVal, limitVal;
    if (isNaN(parseInt(req.query.offset))) skipVal = 0;
    else skipVal = parseInt(req.query.offset);
    if (isNaN(parseInt(req.query.limit))) limitVal = 500;
    else limitVal = parseInt(req.query.limit);

    let totalCount = await PayoutEntry.countDocuments(criteria);
    let driverAdminLogs = await PayoutEntry.aggregate([
      {
        $facet: {
          // { $group: { _id: null, totalCount: { $sum: 1 } } }
          // stats: [
          //   { $match: criteria1 },
          //   {
          //     $group: {
          //       _id: "$userDetails.userId",
          //       codAmount: { $sum: "$codAmount" },
          //       userAmount: { $sum: "$userAmount" },
          //     },
          //   },
          // ],
          codAmount: [
            { $match: { type: "codByDriver", status: "pending", "userDetails.userId": req.query.userId } },
            {
              $group: {
                _id: "$userDetails.userId",
                codAmount: { $sum: "$accumulatedSum" }
              }
            }
          ],
          userAmount: [
            {
              $match: {
                type: "driver",
                "userDetails.userId": req.query.userId,
                status: { $nin: ["success", "retried", "failure"] }
              }
            },
            {
              $group: {
                _id: "$userDetails.userId",
                userAmount: { $sum: "$accumulatedSum" }
              }
            }
          ],
          failureAmount: [
            { $match: { type: "driver", "userDetails.userId": req.query.userId, status: "failure" } },
            {
              $group: {
                _id: "$userDetails.userId",
                userAmount: { $sum: "$accumulatedSum" }
              }
            }
          ],

          // {
          //   $project: {
          //     netAmount: { $round: [{ $subtract: ["$codAmount", "$userAmount"] }, 2] },
          //     codAmount: { $round: ["$codAmount", 2] },
          //     userAmount: { $round: ["$userAmount", 2] },
          //     _id: 0,
          //   },
          // },

          paginatedDocs: [
            {
              $match: criteria
            },
            {
              $sort: { insertDate: -1 }
            },
            { $skip: skipVal },
            { $limit: limitVal },

            { $addFields: { userId: { $toObjectId: "$userDetails.userId" } } },

            { $lookup: { from: "drivers", localField: "userId", foreignField: "_id", as: "driverData" } },

            {
              $project: {
                payoutId: "$_id",
                status: 1,
                failureType: 1,
                paidBy: 1,
                amount: "$accumulatedSum",
                userId: "$userDetails.userId",
                paidTo: 1,
                firstName: { $arrayElemAt: ["$driverData.firstName", 0] },
                lastName: { $arrayElemAt: ["$driverData.lastName", 0] },
                email: { $arrayElemAt: ["$driverData.email", 0] },
                codAmount: 1,
                userAmount: 1,
                initialSum: 1,
                payoutNo: 1,
                type: 1,
                transactionId: 1,
                insertDate: 1,
                creationDate: 1,
                payoutData: 1,
                _id: 0
              }
            }
          ]
        }
      }
    ]);
    let payoutEntry = await PayoutEntry.findOne({ status: "halted" });
    console.log("driverAdminLogs", driverAdminLogs);
    let insufficientBalance = false;
    if (payoutEntry) {
      insufficientBalance = true;
    }

    let codAmount = driverAdminLogs[0].codAmount.length > 0 ? driverAdminLogs[0].codAmount[0].codAmount : 0;
    let userAmount = driverAdminLogs[0].userAmount.length > 0 ? driverAdminLogs[0].userAmount[0].userAmount : 0;
    let failureAmount =
      driverAdminLogs[0].failureAmount.length > 0 ? driverAdminLogs[0].failureAmount[0].userAmount : 0;
    let netAmount = codAmount - userAmount;
    driverAdminLogs = driverAdminLogs[0].paginatedDocs;
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { totalCount, netAmount, failureAmount, driverAdminLogs, insufficientBalance }
    });
  }
);

router.get("/orders", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  let criteria = {};
  criteria._id = mongoose.Types.ObjectId(req.query.payoutId);
  let orders = await PayoutEntry.aggregate([
    { $match: criteria },

    {
      $lookup: {
        from: "orders",
        let: { payoutId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$$payoutId", "$vendorPayoutId"] },
                  { $eq: ["$$payoutId", "$driverPayoutId"] },
                  { $eq: ["$$payoutId", "$influencerPayoutId"] }

                  //  ex.
                  //$eq:["$$payoutId", "$vendorPayoutId"],
                ]
              }
            }
          },
          {
            $project: {
              orderId: "$_id",
              orderNo: 1,
              totalAmount: 1,
              driverAmount: 1,
              driverId: 1,
              vendorId: 1,
              influencerId: 1,
              vendorAmount: 1,
              influencerAmount: 1
            }
          }
        ],

        as: "orderData"
      }
    },

    {
      $project: {
        orderData: 1,
        payoutId: "$_id",
        payoutNo: "$payoutNo",
        _id: 0
      }
    }
  ]);
  // console.log(order);
  orders = orders[0];
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { orders }
  });
});

router.get("/codPayoutTransactionLogs", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  let criteria = {};
  let transactionIds = [];
  if (req.query.transactionIds) {
    transactionIds = req.query.transactionIds.split(",").map((x) => mongoose.Types.ObjectId(x));
  }
  criteria._id = { $in: transactionIds };
  let transactions = await DriverAdminLogs.aggregate([
    { $match: criteria },
    {
      $addFields: {
        payoutListObj: { $map: { input: "$metaData", as: "payoutId", in: { $toObjectId: "$$payoutId" } } }
      }
    },
    {
      $addFields: {
        payoutListObj: {
          $cond: {
            if: { $eq: ["$payoutListObj", null] },
            then: [],
            else: "$payoutListObj"
          }
        }
      }
    },
    {
      $lookup: {
        from: "payoutentries",
        let: { payoutList: "$payoutListObj" },
        pipeline: [
          {
            $match: {
              $and: [{ $expr: { $in: ["$_id", "$$payoutList"] } }]
            }
          },
          {
            $project: {
              payoutNo: 1,
              _id: 0
            }
          }
        ],
        as: "payoutData"
      }
    },
    {
      $project: {
        transactionId: "$_id",
        payoutData: 1,
        creationDate: 1,
        insertDate: 1,
        userId: 1,
        paidBy: 1,
        paidTo: 1,
        paymentAmount: 1,
        paymentType: 1,
        type: 1,
        status: 1,
        _id: 0
      }
    }
  ]);
  // console.log(order);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { transactions }
  });
});

router.get(
  "/payoutOrders",
  identityManager(["vendor", "admin", "influencer", "driver"], { payout: "W" }),
  async (req, res) => {
    const { error } = validatePayoutOrders(req.query);
    if (error)
      return res
        .status(400)
        .send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
    var criteria = {};
    let projection = {
      orderNo: 1,
      totalAmount: 1,
      paymentType: 1
    };

    if (req.query.type == "vendor") {
      criteria.vendorPayoutId = req.query.payoutId;
      projection.vendorAmount = 1;
    } else if (req.query.type == "driver" || req.query.type == "codByDriver") {
      criteria.driverPayoutId = req.query.payoutId;
      projection.driverAmount = 1;
    } else if (req.query.type == "influencer") {
      criteria.influencerPayoutId = req.query.payoutId;
      projection.influencerAmount = 1;
    }

    var skipVal, limitVal;
    if (isNaN(parseInt(req.query.offset))) skipVal = 0;
    else skipVal = parseInt(req.query.offset);
    if (isNaN(parseInt(req.query.limit))) limitVal = 500;
    else limitVal = parseInt(req.query.limit);

    // let totalCount = await PayoutEntry.countDocuments(criteria);
    let totalCount = await Order.countDocuments(criteria);
    let orders = await Order.find(criteria, projection).limit(limitVal).skip(skipVal);
    return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, orders } });
  }
);
router.post("/retryPayout", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  const { error } = validateRetryTransfer(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let payout = await PayoutEntry.findOne({ _id: req.body.payoutId, status: "failure" });
  if (!payout) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PAYOUT_CONSTANTS.PAYOUT_NOT_FOUND }
    });
  }
  let response;
  if (payout.failureType == "temporary") {
    response = await retryPayout(payout.transferId);
    if (response.statusCode !== 200 && response.data.status !== "success") {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: response.data.message }
      });
    }
    payout.status = "retried";
    payout.retryCount += 1;
  } else {
    console.log("permanent");
    let subaccount = await Subaccount.findOne({ userId: payout.userDetails.userId, isDefault: true });
    // console.log("subaccount", subaccount);
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    function generateString(length) {
      let result = " ";
      const charactersLength = characters.length;
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }

      return result;
    }
    let string = generateString(5);
    let bulkDataObj = {};

    bulkDataObj.meta = [{}];
    bulkDataObj.account_bank = subaccount.accountBank;
    bulkDataObj.account_number = subaccount.accountNumber;
    bulkDataObj.amount = payout.accumulatedSum;
    // bulkDataObj.reference = "payout123456789177779";
    bulkDataObj.reference = payout._id.toString() + string;

    bulkDataObj.narration = `${payout.type} payout for ${payout.userDetails.orderNos.toString()}`;
    bulkDataObj.callback_url = config.get("redirectBaseUrl") + "/api/webhook/payout";
    bulkDataObj.currency = config.get("currency");
    // bulkDataObj.meta[0].FirstName = payout.userDetails.firstName;
    // bulkDataObj.meta[0].LastName = payout.userDetails.lastName;
    // bulkDataObj.meta[0].EmailAddress = payout.userDetails.email || config.get("dummyEmail");
    // bulkDataObj.meta[0].MobileNumber = payout.userDetails.mobile;
    // bulkDataObj.meta[0].Address = payout.userDetails.address;
    // bulkDataObj.meta[0].orders = payout.userDetails.orderNos;
    // bulkDataObj.meta[0].userId = payout.userDetails.userId;
    console.log("bulkDataObj", bulkDataObj);
    response = await autoPayout(bulkDataObj);
    console.log("response", response.data);
    if (response.statusCode !== 200) {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYOUT_CONSTANTS.PAYOUT_FAILED }
      });
    }
    payout.status = "awaitingWebhook";
    payout.transferId = response.data.data.id;
    payout.retryCount += 1;

    // response = await autoPayout(bulkDataObj);
    // console.log("response", response);

    // if (response.data.status == "error" || response.statusCode == 400) {
    //   let transferId;
    //   if (response.data.data.message == "Transfer creation failed" && response.data.data.data.complete_message == "Account resolve failed") {
    //     transferId = response.data.data.data.id;
    //     sendTemplateEmail(bulkDataObj.meta[0].EmailAddress, {}, "invalidAccount");
    //   }
    //   // await PayoutEntry.updateMany({ _id: { $in: iteratedIds } }, { $set: { status: "failure", failureType: "permanent", transferId: transferId } });
    //   payout.status = "failure";
    //   payout.failureType = "permanent";
    //   payout.transferId = transferId;
    // } else {
    //   payout.status = "awaitingWebhook";
    //   payout.transferId = response.data.data.id;
    //   // await payout.updateMany({ _id: { $in: iteratedIds } }, { $set: { status: "awaitingWebhook", transferId: response.data.data.id } });
    // }
  }

  await payout.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: response.data.message }
  });
});

router.get("/retryPayoutWebhook", identityManager(["admin"], { payout: "W" }), async (req, res) => {
  const { error } = validateRetryTransfer(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message }
    });
  let payout = await PayoutEntry.findOne({ _id: req.body.payoutId, status: "retried" });
  if (!payout) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PAYOUT_CONSTANTS.PAYOUT_NOT_FOUND }
    });
  }
  let response;
  if (payout.failureType == "temporary") {
    response = await retryPayout(payout.transferId);
    if (response.statusCode !== 200 && response.data.status !== "success") {
      return res.send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: response.data.message }
      });
    }
    payout.status = "retried";
  } else {
    console.log("permanent");
    let subaccount = await Subaccount.findOne({ userId: userDetails.userId });
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    function generateString(length) {
      let result = " ";
      const charactersLength = characters.length;
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }

      return result;
    }
    let string = generateString(5);
    let bulkDataObj = {};

    bulkDataObj.meta = [{}];
    bulkDataObj.account_bank = subaccount.accountBank;
    bulkDataObj.account_number = subaccount.accountNumber;
    bulkDataObj.amount = payout.accumulatedSum;
    // bulkDataObj.reference = "payout123456789177779";
    bulkDataObj.reference = payout.firstPayoutId.toString() + string;

    bulkDataObj.narration = `${payout.type} payout for ${payout.userDetails.orderNos.toString()}`;
    bulkDataObj.callback_url = config.get("redirectBaseUrl") + "/api/webhook/payout";
    bulkDataObj.currency = config.get("currency");
    // bulkDataObj.meta[0].FirstName = payout.userDetails.firstName;
    // bulkDataObj.meta[0].LastName = payout.userDetails.lastName;
    // bulkDataObj.meta[0].EmailAddress = payout.userDetails.email || config.get("dummyEmail");
    // bulkDataObj.meta[0].MobileNumber = payout.userDetails.mobile;
    // bulkDataObj.meta[0].Address = payout.userDetails.address;
    // bulkDataObj.meta[0].orders = payout.userDetails.orderNos;
    // bulkDataObj.meta[0].userId = payout.userDetails.userId;
    response = await autoPayout(bulkDataObj);
    console.log("response", response);

    if (response.data.status == "error" || response.statusCode == 400) {
      let transferId;
      if (
        response.data.data.message == "Transfer creation failed" &&
        response.data.data.data.complete_message == "Account resolve failed"
      ) {
        transferId = response.data.data.data.id;
        sendTemplateEmail(bulkDataObj.meta[0].EmailAddress, {}, "invalidAccount");
      }
      await PayoutEntry.updateMany(
        { _id: { $in: iteratedIds } },
        { $set: { status: "failure", failureType: "permanent", transferId: transferId } }
      );
      payout.status = "failure";
      payout.failureType = "permanent";
      payout.transferId = transferId;
    } else {
      payout.status = "awaitingWebhook";
      payout.transferId = response.data.data.id;
      // await payout.updateMany({ _id: { $in: iteratedIds } }, { $set: { status: "awaitingWebhook", transferId: response.data.data.id } });
    }
  }

  await payout.save();
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: response.data.message }
  });
});
router.get("/test", async (req, res) => {
  let payout = await settlementCod();
  console.log("pay", payout);
  res.send({ data: { message: payout } });
});

// router.get("/payoutDetails", identityManager(["vendor", "admin", "influencer", "driver"], { payout: "W" }), async (req, res) => {
//   const { error } = validatePaymentHistoryDetails(req.query);
//   if (error) return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: error.details[0].message } });
//   var criteria = {};
//   if (req.query.type == "driver") {
//     criteria.settledWith = { $in: [req.query.payoutId] };
//   } else if (req.query.type == "codByDriver") {
//     let payout = await PayoutEntry.findOne({ _id: req.query.payoutId });
//     console.log("payout", payout);
//     let payoutIds = payout.settledWith.map((x) => mongoose.Types.ObjectId(x));
//     criteria._id = { $in: payoutIds };
//   }

//   //   criteria.otherDetails.userId = req.jwtData.userId;
//   if (req.jwtData.role == "influencer" || req.jwtData.role == "vendor" || req.jwtData.role == "driver") {
//     criteria = { "userDetails.userId": req.jwtData.userId };
//   }

//   if (req.query.text) {
//     var regexName = new RegExp(req.query.text, "i");
//     criteria.$or = [{ "userDetails.firstName": regexName }, { "userDetails.email": regexName }];
//   }
//   // if (req.query.status) {
//   //   criteria.status = req.query.status;
//   // } else {
//   //   criteria.status = { $ne: "queued" };
//   // }
//   // if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
//   // if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
//   // if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
//   var skipVal, limitVal;
//   if (isNaN(parseInt(req.query.offset))) skipVal = 0;
//   else skipVal = parseInt(req.query.offset);
//   if (isNaN(parseInt(req.query.limit))) limitVal = 500;
//   else limitVal = parseInt(req.query.limit);

//   let totalCount = await PayoutEntry.countDocuments(criteria);
//   let driverAdminLogs = await PayoutEntry.aggregate([
//     {
//       $match: criteria,
//     },
//     {
//       $sort: { insertDate: -1 },
//     },
//     { $skip: skipVal },
//     { $limit: limitVal },

//     { $addFields: { userId: { $toObjectId: "$userDetails.userId" } } },
//     {
//       $lookup: {
//         from: "payoutentries",
//         let: { payoutId: { $toString: "$_id" } },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [{ $in: ["$$payoutId", "$settledWith"] }],
//               },
//             },
//           },
//           {
//             $project: {
//               payoutId: "$_id",
//               status: 1,
//               failureType: 1,
//               paidBy: 1,
//               amount: "$accumulatedSum",
//               userId: "$userDetails.userId",
//               paidTo: 1,
//               codAmount: 1,
//               userAmount: 1,
//               initialSum: 1,
//               payoutNo: 1,
//               type: 1,

//               insertDate: 1,
//               creationDate: 1,
//               payoutData: 1,
//               _id: 0,
//             },
//           },

//           // { $match: { settledWith: { $in: ["621f58c67b0bee00160a7d47"] } } },
//         ],
//         as: "payoutData",
//       },
//     },
//     { $lookup: { from: "influencers", localField: "userId", foreignField: "_id", as: "influencerData" } },
//     { $lookup: { from: "vendors", localField: "userId", foreignField: "_id", as: "vendorData" } },
//     { $lookup: { from: "drivers", localField: "userId", foreignField: "_id", as: "driverData" } },

//     {
//       $project: {
//         payoutId: "$_id",
//         status: 1,
//         failureType: 1,
//         paidBy: 1,
//         amount: "$accumulatedSum",
//         userId: "$userDetails.userId",
//         paidTo: 1,

//         codAmount: 1,
//         userAmount: 1,
//         initialSum: 1,
//         payoutNo: 1,
//         type: 1,

//         insertDate: 1,
//         creationDate: 1,
//         payoutData: 1,
//         _id: 0,
//       },
//     },
//   ]);
//   let payoutEntry = await PayoutEntry.findOne({ status: "halted" });
//   let insufficientBalance = false;
//   if (payoutEntry) {
//     insufficientBalance = true;
//   }
//   return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, driverAdminLogs, insufficientBalance } });
// });

module.exports = router;
