const config = require("config");
const mongoose = require("mongoose");
const { Coupon } = require("../models/coupon");
const { ApiLog } = require("../models/apiLog");
const { formatter, changeDateFormat } = require("../services/commonFunctions");
const { responseTimeTemp, fiveHundredErrorTemp, sendLogEmail, orderDetailsLog } = require("../services/htmlTemplateFile");
const { sendLogMail, sendOrderDetailLogsMail } = require("../services/amazonSes");
const { Order } = require("../models/order");
const { PayoutEntry } = require("../models/payoutEntry");

mongoose.set("debug", true);

async function sendEmail(startTime, endTime) {
  let logs = await ApiLog.find({ statusCode: 400, insertDate: { $gte: startTime, $lt: endTime } }).count();
  let responseTime = await ApiLog.find({ statusCode: 200, insertDate: { $gte: startTime, $lt: endTime } }, { url: 1, responseTimeMilli: 1 })
    .sort({ responseTimeMilli: -1 })
    .limit(10);
  let fiveHundredError = await ApiLog.aggregate([
    { $match: { statusCode: 500, insertDate: { $gte: startTime, $lt: endTime } } },
    {
      $group: {
        _id: "$completeUrl",
        url: { $last: "$completeUrl" },
        count: { $sum: 1 },
      },
    },
  ]);
  let logData = {
    error: logs,
    responseTime: responseTime,
    fiveHundredError: fiveHundredError,
  };
  let responseData = [];
  for (var index = 0; index < logData.responseTime.length; index++) {
    let responseTimeMilli = logData.responseTime[index].responseTimeMilli;
    let url = logData.responseTime[index].url;
    let temData = {
      responseTimeMilli: responseTimeMilli.toString(),
      url: url,
    };
    const temp = formatter(responseTimeTemp, temData);
    responseData.push(temp);
  }

  let fiveHundredData = [];
  for (var index = 0; index < logData.fiveHundredError.length; index++) {
    let url = logData.fiveHundredError[index].url;
    let count = logData.fiveHundredError[index].count;
    let temData = {
      url: url,
      count: count.toString(),
    };
    const temp = formatter(fiveHundredErrorTemp, temData);
    fiveHundredData.push(temp);
  }

  let email = [
    "sahil.zimble@gmail.com",
  ];
  await sendLogMail(email, responseData, fiveHundredData, logData.error);
}
//Payments script and send total driver assign order , cancel oder details , delivered order details and payout details logs and send emails
async function sendOrderDetailLogs() {
  let dayStartTime = Math.round(new Date().setUTCHours(0, 0, 0, 0) / 1000) + parseInt(config.get("inOffset"));
  let prevDayStartTime = dayStartTime - 86400;
  // let criteria = {};
  // criteria.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };

  let criteria1 = {};
  let criteria2 = {};
  let criteria3 = {};
  let criteria4 = {};
  let criteria5 = {};
  let criteria6 = {};
  let criteria7 = {};
  let criteria8 = {};
  let criteria9 = {};

  criteria1.cancelledAt = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria2.driverAssignedAt = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria3.deliveredAt = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria4.deliveredAt = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria5.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria6.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria7.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria8.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria9.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria4.orderStatus = "RETURNED";
  criteria5.paymentType = "POD";
  criteria6.paymentType != "POD";
  criteria7.orderStatus = "PENDING";
  criteria8.vendorCategory != "pickUpAndDrop";
  criteria9.vendorCategory = "pickUpAndDrop";

  let orders = await Order.aggregate([
    {
      $facet: {
        cancelledOrders: [
          { $match: criteria1 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        driverAssignedOrders: [
          { $match: criteria2 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        deliveredOrders: [
          { $match: criteria3 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        returnedOrders: [
          { $match: criteria4 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        codOrders: [
          { $match: criteria5 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        onlineOrders: [
          { $match: criteria6 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        paymentFailureOrders: [
          { $match: criteria7 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        storeOrders: [
          { $match: criteria8 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
        pickUpAndDropOrders: [
          { $match: criteria9 },

          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
            },
          },
        ],
      },
    },
    {
      $project: {
        cancelledOrders: { $arrayElemAt: ["$cancelledOrders.totalOrders", 0] },
        driverAssignedOrders: { $arrayElemAt: ["$driverAssignedOrders.totalOrders", 0] },
        deliveredOrders: { $arrayElemAt: ["$deliveredOrders.totalOrders", 0] },
        returnedOrders: { $arrayElemAt: ["$returnedOrders.totalOrders", 0] },
        codOrders: { $arrayElemAt: ["$codOrders.totalOrders", 0] },
        onlineOrders: { $arrayElemAt: ["$onlineOrders.totalOrders", 0] },
        paymentFailureOrders: { $arrayElemAt: ["$paymentFailureOrders.totalOrders", 0] },
        storeOrders: { $arrayElemAt: ["$storeOrders.totalOrders", 0] },
        pickUpAndDropOrders: { $arrayElemAt: ["$pickUpAndDropOrders.totalOrders", 0] },
      },
    },
  ]);

  let temData = {
    cancelledOrders: orders[0].cancelledOrders || 0,
    driverAssignedOrders: orders[0].driverAssignedOrders || 0,
    deliveredOrders: orders[0].deliveredOrders || 0,
    returnedOrders: orders[0].returnedOrders || 0,
    codOrders: orders[0].codOrders || 0,
    onlineOrders: orders[0].onlineOrders || 0,
    paymentFailureOrders: orders[0].paymentFailureOrders || 0,
    storeOrders: orders[0].storeOrders || 0,
    pickUpAndDropOrders: orders[0].pickUpAndDropOrders || 0,
  };
  const temp = formatter(orderDetailsLog, temData);
  let email = ["manjit@zimblecode.com", "atul@zimblecode.com", "chahat@zimblecode.com", "damanpreet@zimblecode.com", "ramanpreet.zimble@gmail.com", "inder@zimblecode.com"];
  let subject = config.get("environment") + " " + config.get("email_sendgrid.logs");
  await sendOrderDetailLogsMail(email, temp, subject);
  //   }
}

async function sendPayoutDetailLogs() {
  let dayStartTime = Math.round(new Date().setUTCHours(0, 0, 0, 0) / 1000) + parseInt(config.get("inOffset"));
  let prevDayStartTime = dayStartTime - 86400;
  let criteria = {};
  criteria.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };

  let criteria1 = {};
  let criteria2 = {};
  let criteria3 = {};
  let criteria4 = {};
  let criteria5 = {};
  let criteria6 = {};
  let criteria7 = {};
  let criteria8 = {};

  // criteria.insertDate = { $gte: prevDayStartTime, $lte: dayStartTime };
  criteria1.type = "driver";
  criteria2.status = { $ne: "failure" };
  criteria6.status = { $nin: ["failure", "settled", "deferred"] };
  criteria7.status = "deferred";
  criteria8.status = "settled";

  criteria3.status = "failure";
  criteria4.type = "vendor";
  criteria5.type = "influencer";

  let orders = await PayoutEntry.aggregate([
    { $match: criteria },
    {
      $facet: {
        driverCodTotal: [
          { $match: { type: "codByDriver" } },

          {
            $group: {
              _id: null,
              accumulatedSum: { $sum: "$initialSum" },
            },
          },
        ],
        driverCodPayouts: [
          { $match: { type: "codByDriver" } },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
        driverPayoutsTotal: [
          { $match: criteria1 },

          {
            $group: {
              _id: null,
              accumulatedSum: { $sum: "$accumulatedSum" },
            },
          },
        ],
        driverSuccessPayouts: [
          { $match: criteria1 },
          { $match: criteria6 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
        driverDeferredPayouts: [
          { $match: criteria1 },
          { $match: criteria7 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
        driverSettledPayouts: [
          { $match: criteria1 },
          { $match: criteria8 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
        driverFailurePayouts: [
          { $match: criteria1 },
          { $match: criteria3 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              name: { $first: "$userDetails.firstName" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],

        vendorPayoutsTotal: [
          { $match: criteria4 },

          {
            $group: {
              _id: null,
              accumulatedSum: { $sum: "$accumulatedSum" },
            },
          },
        ],
        vendorSuccessPayouts: [
          { $match: criteria4 },
          { $match: criteria2 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
        vendorFailurePayouts: [
          { $match: criteria4 },
          { $match: criteria3 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              initialSum: { $sum: "$initialSum" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],

        influencerPayoutsTotal: [
          { $match: criteria4 },

          {
            $group: {
              _id: null,
              accumulatedSum: { $sum: "$accumulatedSum" },
            },
          },
        ],
        influencerSuccessPayouts: [
          { $match: criteria5 },
          { $match: criteria2 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              initialSum: { $sum: "$initialSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
        influencerFailurePayouts: [
          { $match: criteria5 },
          { $match: criteria3 },

          {
            $group: {
              _id: "$userDetails.userId",
              accumulatedSum: { $sum: "$accumulatedSum" },
              type: { $first: "$type" },
              name: { $first: "$userDetails.firstName" },
              initialSum: { $sum: "$initialSum" },
              email: { $first: "$userDetails.email" },
              status: { $first: "$status" },
              payoutDay: { $first: "$payoutDay" },
              // failureType:{$first:""}
            },
          },
        ],
      },
    },
  ]);

  let driverPayoutsTotal = orders[0].driverPayoutsTotal.length > 0 ? orders[0].driverPayoutsTotal[0].accumulatedSum.toFixed(2) : 0;
  let driverSuccessPayouts = orders[0].driverSuccessPayouts.length > 0 ? orders[0].driverSuccessPayouts : [];
  let driverFailurePayouts = orders[0].driverFailurePayouts.length > 0 ? orders[0].driverFailurePayouts : [];
  let driverSettledPayouts = orders[0].driverSettledPayouts.length > 0 ? orders[0].driverSettledPayouts : [];
  let driverDeferredPayouts = orders[0].driverDeferredPayouts.length > 0 ? orders[0].driverDeferredPayouts : [];

  let driverCodTotal = orders[0].driverCodTotal.length > 0 ? orders[0].driverCodTotal[0].accumulatedSum.toFixed(2) : 0;
  let driverCodPayouts = orders[0].driverCodPayouts.length > 0 ? orders[0].driverCodPayouts : [];

  let vendorPayoutsTotal = orders[0].vendorPayoutsTotal.length > 0 ? orders[0].vendorPayoutsTotal[0].accumulatedSum.toFixed(2) : 0;
  let vendorSuccessPayouts = orders[0].vendorSuccessPayouts.length > 0 ? orders[0].vendorSuccessPayouts : [];
  let vendorFailurePayouts = orders[0].vendorFailurePayouts.length > 0 ? orders[0].vendorFailurePayouts : [];
  let influencerPayoutsTotal = orders[0].influencerPayoutsTotal.length > 0 ? orders[0].influencerPayoutsTotal[0].accumulatedSum.toFixed(2) : 0;
  let influencerSuccessPayouts = orders[0].influencerSuccessPayouts.length > 0 ? orders[0].influencerSuccessPayouts : [];
  let influencerFailurePayouts = orders[0].influencerFailurePayouts.length > 0 ? orders[0].influencerFailurePayouts : [];

  let driverData = [...driverSuccessPayouts, ...driverSettledPayouts, ...driverDeferredPayouts, ...driverFailurePayouts, ...driverCodPayouts];
  let vendorData = [...vendorSuccessPayouts, ...vendorFailurePayouts];
  let influencerData = [...influencerSuccessPayouts, ...influencerFailurePayouts];
  let data = payoutMailTemplate(driverData, vendorData, influencerData, driverPayoutsTotal, driverCodTotal, vendorPayoutsTotal, influencerPayoutsTotal);

  let email = ["manjit@zimblecode.com", "atul@zimblecode.com", "chahat@zimblecode.com", "damanpreet@zimblecode.com", "ramanpreet.zimble@gmail.com", "inder@zimblecode.com"];

  let subject = config.get("environment") + " " + config.get("email_sendgrid.payoutLogs");

  await sendOrderDetailLogsMail(email, data, subject);
  //   }
}

async function sendLogsEmail() {
  let currentDate = new Date();
  let dateFormate = changeDateFormat(currentDate);
  let offsetHour = ":00.000+05:30";

  let dateString = dateFormate + "T" + "00:00" + offsetHour;

  let startDate = Math.round(new Date(dateString).getTime() / 1000) - 86400;
  let endDate = startDate + 86400;
  await sendOrderDetailLogs();
  await sendPayoutDetailLogs();
  await sendEmail(startDate, endDate);
}

module.exports.sendLogsEmail = sendLogsEmail;
module.exports.sendOrderDetailLogs = sendOrderDetailLogs;
module.exports.sendPayoutDetailLogs = sendPayoutDetailLogs;
// sendPayoutDetailLogs;

function payoutMailTemplate(driverData, vendorData, influencerData, driverPayoutsTotal, driverCodTotal, vendorPayoutsTotal, influencerPayoutsTotal) {
  let str = `<!DOCTYPE html> <html> <head> <title>Page Title</title><style>.modal-body {line-height: 1.5;} table { border-collapse: collapse; width: 100%; margin-bottom: 5px;font-size: 10px; } th, td { text-align: left; padding: 8px; } tr:nth-child(even){background-color: #f2f2f2} th { background-color: #000; color: white; } .font { font-size: 10px } .w-100 { width: 100%; margin-bottom: 15px; font-size: 10px; }.wf-100 { width: 100%;font-size: 10px; } .w-30 { width: 30%; display: inline-block; } .w-70 { width: 68%;display: inline-block; color: #8c8e91;  } .wb-30 { width: 73%; display: inline-block; text-align: right; } .wb-70 { width: 25%;display: inline-block; text-align: right; } .align-right {text-align: right;} .rm { padding-right: 20px } .border-bottom {border-bottom: 1px solid #5c5d5e;} .footer { background: #cbc5c5; color: #077a11f2; padding-bottom: 5px; padding-top: 5px; } </style></head> <body> <div class="modal-body waive-share">
     <div class="cat"> <h3 class="modal-title" id="modal-basic-title"> <span class="text-left">Waive Payout Details</span></h3> 
     <div> Total Driver Payout Amount : N ${driverPayoutsTotal}</div> <div> Total COD Amount : N ${driverCodTotal}</div><div> Total Vendor Payout Amount : N ${vendorPayoutsTotal}</div> <div> Total Influencer Payout Amount : N ${influencerPayoutsTotal}</div><div class="table-responsive">`;
  if (driverData.length > 0) {
    str = str.concat(`<table class="table text-center border-bottom" id="table_app"><thead><h3>Driver Payout Details</h3> <tr>
    <th>Name</th>
    <th>Email</th>
    <th>Net Amount</th>
    <th>Initial Amount</th>
    <th>Status</th>
    <th>Payout Day</th>
    <th>Type</th>
    
  </tr> </thead> <tbody>`);
    for (let i = 0; i < driverData.length; i++) {
      str = str.concat("<tr>");
      // for (const key in data[i]) {
      //   str = str.concat("i");
      // }
      let driverDynamic = `
        <td>${driverData[i].name}</td>
         <td>${driverData[i].email}</td>
         <td>${driverData[i].accumulatedSum}</td>
         <td>${driverData[i].initialSum}</td>
         <td>${driverData[i].status}</td>
         <td>${driverData[i].payoutDay}</td>
         <td>${driverData[i].type}</td>

 
         `;

      str = str.concat(driverDynamic + "</tr>");
    }
    str = str.concat("</tbody></table>");
  }

  if (vendorData.length > 0) {
    str = str.concat(`<table class="table text-center border-bottom" id="table_app"><thead><h3>Vendor Payout Details</h3> <tr>
    <th>Name</th>
    <th>Email</th>
    <th>Net Amount</th>
    <th>Initial Amount</th>
    <th>Status</th>
    <th>Payout Day</th>
    <th>Type</th>
    
  </tr> </thead> <tbody>`);
    for (let i = 0; i < vendorData.length; i++) {
      str = str.concat("<tr>");
      // for (const key in data[i]) {
      //   str = str.concat("i");
      // }
      let vendorDynamic = `
        <td>${vendorData[i].name}</td>
         <td>${vendorData[i].email}</td>
         <td>${vendorData[i].accumulatedSum}</td>
         <td>${vendorData[i].initialSum}</td>
         <td>${vendorData[i].status}</td>
         <td>${vendorData[i].payoutDay}</td>
         <td>${vendorData[i].type}</td>

 
         `;

      str = str.concat(vendorDynamic + "</tr>");
    }

    str = str.concat("</tbody></table>");
  }
  if (influencerData.length > 0) {
    str = str.concat(`<table class="table text-center border-bottom" id="table_app"><thead><h3>Influencer Payout Details</h3> <tr>
    <th>Name</th>
    <th>Email</th>
    <th>Net Amount</th>
    <th>Initial Amount</th>
    <th>Status</th>
    <th>Payout Day</th>
    <th>Type</th>
    
  </tr> </thead> <tbody>`);

    for (let i = 0; i < influencerData.length; i++) {
      str = str.concat("<tr>");
      // for (const key in data[i]) {
      //   str = str.concat("i");
      // }
      let influencerDynamic = `
        
           <td>${influencerData[i].name}</td>
         <td>${influencerData[i].email}</td>
         <td>${influencerData[i].accumulatedSum}</td>
         <td>${influencerData[i].initialSum}</td>
         <td>${influencerData[i].status}</td>
         <td>${influencerData[i].payoutDay}</td>
         <td>${influencerData[i].type}</td>


         `;

      str = str.concat(influencerDynamic + "</tr>");
    }
    str = str.concat("</tbody></table>");
  }
  return str;
}
