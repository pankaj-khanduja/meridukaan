// const config = require("config");
// let { Order } = require("../models/order");
// const mongoose = require("mongoose");
// let { Driver } = require("../models/driver");
// const { sendFCM, sendMultipleFCM } = require("../services/fcmModule");
// const { Vendor } = require("../models/vendor");
// const moment = require("moment-timezone");
// const { getWeekDayHoursMinutes } = require("../services/commonFunctions");
// const { sendTemplateEmail } = require("../services/amazonSes");

// const FLUTTER_SECRET_KEY = config.get("secretKey");
// const { DriverAdminLogs } = require("../models/transactionLog");
// const { OrderNo } = require("../models/orderNo");
// const { autoPayout, manualPayout } = require("../services/flutterWave");
// const { PayoutEntry } = require("../models/payoutEntry");

// mongoose.set("debug", true);

// var isVendorPayoutEntriesDone = true;
// async function payoutEntriesVendor() {
//   if (isVendorPayoutEntriesDone) {
//     isVendorPayoutEntriesDone = false;
//     let currentTime = Math.round(new Date() / 1000);
//     let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));

//     if (data.weekDay === 0 && data.hours <= 2) {
//       let criteria = {};
//       let epoch = +new Date() - 86400000;
//       let previousDate = moment.tz(epoch, config.get("timeZone")).format("YYYY-MM-DD");

//       // criteria.deliveredAt = { $lt: currentTime };
//       criteria.orderStatus = "DELIVERED";
//       criteria.vendorCategory = { $ne: "pickUpAndDrop" };
//       // let timeZone = config.get("timeZone");
//       // let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
//       // let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
//       // let sevenDaysBack = saturdayEndTime - 7 * 86400;

//       let timeZone = config.get("timeZone");
//       let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
//       let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
//       if (saturdayEndTime > Math.round(new Date() / 1000)) {
//         saturdayEndTime -= 7 * 86400;
//       }
//       let sevenDaysBack = saturdayEndTime - 7 * 86400;

//       criteria.deliveredAt = { $gt: sevenDaysBack, $lte: saturdayEndTime };
//       criteria.isOrderAmtPaidToVendor = false;
//       criteria.vendorId = { $ne: "" };
//       let orders = await Order.aggregate([
//         {
//           $match: criteria
//         },
//         {
//           $project: {
//             vendorId: 1,
//             orderId: "$_id",
//             orderNo: 1,
//             vendorAmount: 1,
//             totalAmount: 1,
//             driverAmount: 1
//           }
//         },
//         {
//           $group: {
//             _id: "$vendorId",
//             total: {
//               $sum: "$vendorAmount"
//             },
//             orderData: {
//               $push: "$$ROOT"
//             },
//             orderNos: {
//               $push: "$$ROOT.orderNo"
//             }
//           }
//         },
//         { $addFields: { vendorId: { $toObjectId: "$_id" } } },
//         { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },

//         {
//           $lookup: {
//             from: "subaccounts",
//             let: { userId: { $toString: "$vendorId" } },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$isDefault", true] }]
//                   }
//                 }
//               }
//             ],
//             as: "subaccountData"
//           }
//         },
//         {
//           $addFields: {
//             userDetails: {
//               userId: "$_id",
//               firstName: { $arrayElemAt: ["$vendorData.name", 0] },
//               lastName: { $arrayElemAt: ["$vendorData.name", 0] },
//               email: { $arrayElemAt: ["$vendorData.email", 0] },
//               mobile: { $arrayElemAt: ["$vendorData.mobile", 0] },
//               address: { $arrayElemAt: ["$vendorData.address", 0] },
//               accountNumber: { $arrayElemAt: ["$subaccountData.accountNumber", 0] },
//               accountBank: { $arrayElemAt: ["$subaccountData.accountBank", 0] },
//               orderNos: "$orderNos"
//             }
//           }
//         }
//       ]);

//       let orderData = [];
//       for (let order of orders) {
//         let orderObj = {};

//         // let deferredPayout = await PayoutEntry.findOne({ "userDetails.userId": order.userDetails.userId, status: "deferred" });

//         // if (deferredPayout && deferredPayout.accumulatedSum) {
//         //   order.total = order.total + deferredPayout.accumulatedSum;
//         //   order.orderData = [...order.orderData, ...deferredPayout.orderDetails];
//         //   order.userDetails.deferredPayoutId = deferredPayout._id.toString();
//         //   deferredPayout.status = "undeferred";
//         //   await deferredPayout.save();
//         // }
//         orderObj.accumulatedSum = order.total;
//         orderObj.userId = order.userId;
//         orderObj.userDetails = order.userDetails;
//         orderObj.type = "vendor";
//         orderObj.orderDetails = order.userDetails.orderNos;
//         orderData.push(orderObj);
//         orderObj.payoutDay = previousDate;
//         let payout = new PayoutEntry(orderObj);
//         await Order.updateMany(
//           { orderNo: { $in: order.userDetails.orderNos } },
//           { $set: { isOrderAmtPaidToVendor: true, vendorPayoutId: payout._id.toString() } }
//         );
//         let result = await OrderNo.findOneAndUpdate({}, { $inc: { payoutNo: 1 } }, { new: true });
//         console.log(result);
//         payout.payoutNo = result.payoutNo;
//         await payout.save();
//       }
//     }
//     isVendorPayoutEntriesDone = true;
//   }
// }

// var isDriverPayoutEntriesDone = true;
// async function payoutEntriesDriver() {
//   if (isDriverPayoutEntriesDone) {
//     isDriverPayoutEntriesDone = false;

//     let currentTime = Math.round(new Date() / 1000);
//     let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));
//     // console.log("data", data);
//     if (data.hours <= 2) {
//       // console.log("payoutEntriesDriver");
//       let criteria = {};
//       let epoch = +new Date() - 86400000;
//       let previousDate = moment.tz(epoch, config.get("timeZone")).format("YYYY-MM-DD");
//       if (config.get("environment") == "prod") {
//         criteria.deliveryDate = previousDate;
//       }
//       // criteria.deliveredAt = { $lt: currentTime };
//       criteria.orderStatus = { $in: ["DELIVERED", "RETURNED"] };
//       // criteria.paymentType = { $ne: "POD" };
//       // criteria.vendorCategory = { $ne: "pickUpAndDrop" };
//       criteria.isOrderAmtPaidToDriver = false;
//       // criteria.isOrderAmtPaidToAdmin = false;

//       criteria.driverId = { $ne: "" };
//       let orders = await Order.aggregate([
//         {
//           $match: criteria
//         },
//         {
//           $project: {
//             driverId: 1,
//             orderId: "$_id",
//             orderNo: 1,
//             vendorAmount: 1,
//             totalAmount: 1,
//             codAmountToPay: 1,
//             driverAmount: 1
//           }
//         },
//         {
//           $group: {
//             _id: "$driverId",
//             codAmount: {
//               $sum: "$codAmountToPay"
//             },
//             total: {
//               $sum: "$driverAmount"
//             },

//             orderData: {
//               $push: "$$ROOT"
//             },
//             orderNos: {
//               $push: "$$ROOT.orderNo"
//             }
//           }
//         },
//         { $addFields: { driverId: { $toObjectId: "$_id" } } },
//         { $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" } },

//         {
//           $lookup: {
//             from: "subaccounts",
//             let: { userId: { $toString: "$driverId" } },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$isDefault", true] }]
//                   }
//                 }
//               }
//             ],
//             as: "subaccountData"
//           }
//         },
//         {
//           $addFields: {
//             userDetails: {
//               userId: "$_id",
//               firstName: { $arrayElemAt: ["$driverData.firstName", 0] },
//               lastName: { $arrayElemAt: ["$driverData.lastName", 0] },
//               email: { $arrayElemAt: ["$driverData.email", 0] },
//               mobile: { $arrayElemAt: ["$driverData.mobile", 0] },
//               address: { $arrayElemAt: ["$driverData.address", 0] },
//               accountNumber: { $arrayElemAt: ["$subaccountData.accountNumber", 0] },
//               accountBank: { $arrayElemAt: ["$subaccountData.accountBank", 0] },
//               orderNos: "$orderNos"
//             }
//           }
//         }
//       ]);

//       for (let order of orders) {
//         let payoutObj = new PayoutEntry({});
//         // let payoutObj = {};
//         payoutObj.codAmount = order.codAmount;
//         payoutObj.userAmount = order.total;
//         payoutObj.userId = order.userId;
//         payoutObj.userDetails = order.userDetails;
//         if (order.codAmount > order.total) {
//           payoutObj.accumulatedSum = order.codAmount - order.total;
//           payoutObj.initialSum = order.codAmount - order.total;
//           payoutObj.type = "codByDriver";
//         } else {
//           if (order.codAmount === order.total) {
//             payoutObj.status = "settled";
//             // payoutObj.initialSum = order.total;

//             payoutObj.accumulatedSum = (order.total - order.codAmount).toFixed(2);
//             payoutObj.initialSum = (order.total - order.codAmount).toFixed(2);

//             payoutObj.type = "driver";
//           } else {
//             console.log("lessCod", order.codAmount, order.total);
//             // payoutObj.initialSum = order.total;
//             payoutObj.initialSum = (order.total - order.codAmount).toFixed(2);

//             payoutObj.accumulatedSum = (order.total - order.codAmount).toFixed(2);
//             payoutObj.type = "driver";
//             let codPayouts = await PayoutEntry.aggregate([
//               {
//                 $match: { status: "pending", type: "codByDriver", "userDetails.userId": payoutObj.userDetails.userId }
//               },
//               { $sort: { _id: 1 } },
//               {
//                 $group: {
//                   _id: "$userDetails.userId",
//                   total: { $sum: "$accumulatedSum" },
//                   payoutData: {
//                     $push: {
//                       payoutId: "$$ROOT._id",
//                       accumulatedSum: "$$ROOT.accumulatedSum"
//                     }
//                   }
//                 }
//               },
//               { $sort: { _id: 1 } }
//             ]);
//             let payoutIds = [];
//             if (codPayouts.length > 0) {
//               codPayouts = codPayouts[0];
//               let diff = payoutObj.accumulatedSum - codPayouts.total;
//               for (j = 0; j < codPayouts.payoutData.length; j++) {
//                 payoutIds.push(mongoose.Types.ObjectId(codPayouts.payoutData[j].payoutId));
//               }
//               if (diff >= 0) {
//                 //       $push: { blockedBy: req.jwtData.userId },
//                 await PayoutEntry.updateMany(
//                   { _id: { $in: payoutIds } },
//                   { $set: { status: "completed", accumulatedSum: 0 }, $push: { settledWith: payoutObj._id } }
//                 );
//                 if (diff > 0) {
//                   payoutObj.accumulatedSum -= codPayouts.total;
//                   payoutObj.status = "partiallySettled";
//                   payoutObj.isSettled = true;
//                 } else {
//                   payoutObj.status = "settled";
//                   payoutObj.accumulatedSum = 0;

//                   payoutObj.isSettled = true;
//                 }
//               }
//               //case 2: when toPay is greater than toBePaid
//               //then check how many codPayment entries got exhausted with toBePaid
//               else {
//                 let data = checkForPayments(
//                   codPayouts.payoutData,
//                   0,
//                   codPayouts.payoutData[0].accumulatedSum,
//                   payoutObj.accumulatedSum
//                 );
//                 //above function will return two arrays... Ist one is the list of cod payouts which exhausted completely
//                 //and second one is the list of unexhausted payouts
//                 if (data.array.length > 0) {
//                   payoutIds = payoutIds.slice(0, data.array.length);
//                   console.log("payoutObj._id", payoutObj._id, payoutIds);
//                   await PayoutEntry.updateMany(
//                     { _id: { $in: payoutIds } },
//                     { $set: { status: "completed", accumulatedSum: 0 }, $push: { settledWith: payoutObj._id } }
//                   );
//                 }
//                 if (data.newArray.length > 0) {
//                   console.log("payoutObj._id1", payoutObj._id, payoutIds);

//                   await PayoutEntry.updateOne(
//                     { _id: data.newArray[0].payoutId },
//                     { $inc: { accumulatedSum: data.toBeMinus }, $push: { settledWith: payoutObj._id } }
//                   );

//                   // { $inc: { repliesCount: 1 }, $set: { lastActivtyOn: Math.round(new Date() / 1000) } }
//                 }
//                 payoutObj.status = "settled";
//                 payoutObj.accumulatedSum = 0;

//                 payoutObj.isSettled = true;
//               }
//             }
//           }
//         }
//         await Order.updateMany(
//           { orderNo: { $in: order.userDetails.orderNos } },
//           {
//             $set: {
//               isOrderAmtPaidToDriver: true,
//               isOrderAmtPaidToAdmin: true,
//               driverPayoutId: payoutObj._id.toString(),
//               codAmountToPay: 0
//             }
//           }
//         );
//         payoutObj.payoutDay = previousDate;
//         let result = await OrderNo.findOneAndUpdate({}, { $inc: { payoutNo: 1 } }, { new: true });
//         console.log(result);
//         payoutObj.payoutNo = result.payoutNo;
//         await payoutObj.save();
//       }
//     }
//     isDriverPayoutEntriesDone = true;
//   }
// }

// var isInfluencerPayoutEntriesDone = true;
// async function payoutEntriesInfluencer() {
//   if (isInfluencerPayoutEntriesDone) {
//     isInfluencerPayoutEntriesDone = false;

//     let currentTime = Math.round(new Date() / 1000);
//     let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));

//     if (data.weekDay === 0 && data.hours <= 2) {
//       let epoch = +new Date() - 86400000;
//       let previousDate = moment.tz(epoch, config.get("timeZone")).format("YYYY-MM-DD");
//       let criteria = {};
//       criteria.orderStatus = "DELIVERED";
//       criteria.influencerId = { $ne: "" };
//       // let timeZone = config.get("timeZone");
//       // let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
//       // let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
//       // let sevenDaysBack = saturdayEndTime - 7 * 86400;

//       let timeZone = config.get("timeZone");
//       let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
//       let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
//       if (saturdayEndTime > Math.round(new Date() / 1000)) {
//         saturdayEndTime -= 7 * 86400;
//       }
//       let sevenDaysBack = saturdayEndTime - 7 * 86400;
//       criteria.deliveredAt = { $gt: sevenDaysBack, $lte: saturdayEndTime };
//       // criteria.vendorCategory = { $ne: "pickUpAndDrop" };
//       criteria.isInfluencerSharePaid = false;
//       let orders = await Order.aggregate([
//         {
//           $match: criteria
//         },
//         {
//           $project: {
//             influencerId: 1,
//             orderId: "$_id",
//             orderNo: 1,
//             influencerAmount: 1,
//             totalAmount: 1
//             // driverAmount: 1,
//           }
//         },
//         {
//           $group: {
//             _id: "$influencerId",
//             total: {
//               $sum: "$influencerAmount"
//             },
//             orderData: {
//               $push: "$$ROOT"
//             },
//             orderNos: {
//               $push: "$$ROOT.orderNo"
//             }
//           }
//         },
//         { $addFields: { influencerId: { $toObjectId: "$_id" } } },
//         { $lookup: { from: "influencers", localField: "influencerId", foreignField: "_id", as: "influencerData" } },

//         {
//           $lookup: {
//             from: "subaccounts",
//             let: { userId: { $toString: "$influencerId" } },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$isDefault", true] }]
//                   }
//                 }
//               }
//             ],
//             as: "subaccountData"
//           }
//         },
//         {
//           $addFields: {
//             userDetails: {
//               userId: "$_id",
//               firstName: { $arrayElemAt: ["$influencerData.name", 0] },
//               lastName: { $arrayElemAt: ["$influencerData.name", 0] },
//               email: { $arrayElemAt: ["$influencerData.email", 0] },
//               mobile: { $arrayElemAt: ["$influencerData.mobile", 0] },
//               address: { $arrayElemAt: ["$influencerData.address", 0] },
//               accountNumber: { $arrayElemAt: ["$subaccountData.accountNumber", 0] },
//               accountBank: { $arrayElemAt: ["$subaccountData.accountBank", 0] },
//               orderNos: "$orderNos"
//             }
//           }
//         }
//       ]);
//       let orderData = [];
//       for (let order of orders) {
//         let orderObj = {};

//         // let deferredPayout = await PayoutEntry.findOne({ "userDetails.userId": order.userDetails.userId, status: "deferred" });

//         // if (deferredPayout && deferredPayout.accumulatedSum) {
//         //   // order.total = order.total + deferredPayout.accumulatedSum;
//         //   // order.orderData = [...order.orderData, ...deferredPayout.orderData];
//         //   order.total = order.total + deferredPayout.accumulatedSum;
//         //   order.orderData = [...order.orderData, ...deferredPayout.orderDetails];
//         //   order.userDetails.deferredPayoutId = deferredPayout._id.toString();
//         //   deferredPayout.status = "undeferred";
//         //   await deferredPayout.save();
//         // }
//         orderObj.accumulatedSum = order.total;
//         orderObj.userId = order.userId;
//         orderObj.userDetails = order.userDetails;
//         orderObj.type = "influencer";
//         orderObj.payoutDay = previousDate;
//         // orderObj.orderDetails = order.orderData;
//         orderData.push(orderObj);
//         let payout = new PayoutEntry(orderObj);
//         await Order.updateMany(
//           { orderNo: { $in: order.userDetails.orderNos } },
//           { $set: { isInfluencerSharePaid: true, influencerPayoutId: payout._id.toString() } }
//         );
//         let result = await OrderNo.findOneAndUpdate({}, { $inc: { payoutNo: 1 } }, { new: true });
//         console.log(result);
//         payout.payoutNo = result.payoutNo;
//         await payout.save();
//       }
//     }
//     isInfluencerPayoutEntriesDone = true;
//   }
// }

// function checkForPayments(array, index, sum, toBePaidAmt) {
//   console.log("sum", sum, "toBePaidAmt", toBePaidAmt);
//   if (sum > toBePaidAmt) {
//     let newArray = array.splice(index);
//     let toBeMinus = Math.round(sum - newArray[0].accumulatedSum - toBePaidAmt);

//     return { array, newArray, toBeMinus };
//   } else {
//     if (index == array.length) return array;
//     sum += array[index + 1].accumulatedSum;
//     index++;

//     return checkForPayments(array, index, sum, toBePaidAmt);
//   }
// }
// var isWeeklyPayoutComplete = true;
// async function weeklyPayout() {
//   if (isWeeklyPayoutComplete) {
//     console.log("isWeeklyPayoutComplete", isWeeklyPayoutComplete);

//     isWeeklyPayoutComplete = false;
//     let currentTime = Math.round(new Date() / 1000);

//     let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));

//     if (data.weekDay === 0 && data.hours > 2) {
//       let haltedPayout = await PayoutEntry.findOne({ status: "halted" });
//       if (!haltedPayout) {
//         // let payouts = await PayoutEntry.find({ status: { $in: ["pending", "queued", "partiallySettled"] }, type: { $in: ["vendor", "influencer","driver"] } }).limit(10);
//         let criteria = {};
//         criteria.status = { $in: ["pending", "queued", "partiallySettled", "deferred"] };
//         criteria.type = { $in: ["vendor", "influencer"] };
//         let payouts = await payoutTransferData(criteria);

//         // console.log("dataaaa", payouts[0]);
//         let deferredPayoutList = payouts.filter((x) => x.accumulatedSum < 100);
//         let deferredPayouts = [];
//         // for (let payout of deferredPayouts) {
//         //   deferredPayouts = payout.payoutData.map((x) => mongoose.Types.ObjectId(x.payoutId));
//         // }
//         for (let payout of deferredPayoutList) {
//           deferredPayouts = deferredPayouts.concat(payout.payoutData.map((x) => mongoose.Types.ObjectId(x.payoutId)));
//         }
//         payouts = payouts.filter((x) => x.accumulatedSum >= 100);

//         //   let founded = await PayoutEntry.find({ _id: { $in: deferredPayouts } });

//         await PayoutEntry.updateMany({ _id: { $in: deferredPayouts } }, { $set: { status: "deferred" } });
//         console.log("payouts", payouts);
//         let payoutIds = [];
//         if (payouts.length > 0) {
//           // for (payout of payouts) {
//           //   payoutIds.push(payout._id);
//           // }
//           for (let payout of payouts) {
//             // payoutIds = payout.payoutData.map((x) => mongoose.Types.ObjectId(x.payoutId));
//             payoutIds = payoutIds.concat(payout.payoutData.map((x) => mongoose.Types.ObjectId(x.payoutId)));
//           }
//           let logData = [];
//           await PayoutEntry.updateMany({ _id: { $in: payoutIds } }, { $set: { status: "queued" } });
//           console.log("payout.length", payouts.length);
//           for (let i = 0; i < payouts.length; i++) {
//             let bulkDataObj = {};
//             let parentPayoutId = mongoose.Types.ObjectId();

//             bulkDataObj.meta = [{}];
//             bulkDataObj.account_bank = payouts[i].userDetails.accountBank;
//             bulkDataObj.account_number = payouts[i].userDetails.accountNumber;
//             bulkDataObj.amount = payouts[i].accumulatedSum;
//             bulkDataObj.reference = parentPayoutId;

//             bulkDataObj.narration = `${payouts[i].type} payout for ${payouts[i].userDetails.orderNos.toString()}`;
//             bulkDataObj.callback_url = config.get("redirectBaseUrl") + "/api/webhook/payout";
//             bulkDataObj.currency = config.get("currency");
//             bulkDataObj.meta[0].FirstName = payouts[i].userDetails.firstName;
//             bulkDataObj.meta[0].LastName = payouts[i].userDetails.lastName;
//             bulkDataObj.meta[0].EmailAddress = payouts[i].userDetails.email || config.get("dummyEmail");
//             bulkDataObj.meta[0].MobileNumber = payouts[i].userDetails.mobile;
//             bulkDataObj.meta[0].Address = payouts[i].userDetails.address;
//             bulkDataObj.meta[0].orders = payouts[i].userDetails.orderNos;

//             bulkDataObj.meta[0].userId = payouts[i].userDetails.userId;
//             // console.log("bulkDataObj.reference", bulkDataObj.reference);
//             let response = await autoPayout(bulkDataObj);
//             let iteratedIds = payoutIds.splice(0, payouts[i].payoutData.length);
//             // console.log("iterateIds", iteratedIds);

//             if ((response.data && response.data.status == "FAILED") || (response.data && response.data.status == "error") || response.statusCode == 400) {
//               // bulkDataArray.push(bulkDataObj);
//               let transferId;
//               if (
//                 response.data && response.data.data.message == "Transfer creation failed" && response.data.data.data.complete_message == "Account resolve failed"
//               ) {
//                 transferId = response.data.data.data.id;
//                 sendTemplateEmail(bulkDataObj.meta[0].EmailAddress, {}, "invalidAccount");
//               }
//               await PayoutEntry.updateMany(
//                 { _id: { $in: iteratedIds } },
//                 {
//                   $set: {
//                     status: "failure",
//                     failureType: "permanent",
//                     transferId: transferId,
//                     parentPayoutId: parentPayoutId
//                   }
//                 }
//               );
//             } else {
//               await PayoutEntry.updateMany(
//                 { _id: { $in: iteratedIds } },
//                 {
//                   $set: { status: "awaitingWebhook", transferId: response.data.data.id, parentPayoutId: parentPayoutId }
//                 }
//               );
//             }
//           }
//           // await DriverAdminLogs.insertMany(logData);
//         }
//         // }
//       }
//     }
//     // }
//     isWeeklyPayoutComplete = true;
//   }
// }

// var isDriverPayoutComplete = true;
// async function driverDailyPayout() {
//   if (isDriverPayoutComplete) {
//     isDriverPayoutComplete = false;
//     let currentTime = Math.round(new Date() / 1000);

//     let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));

//     if (data.hours > 2) {
//       let haltedPayout = await PayoutEntry.findOne({ status: "halted" });
//       if (!haltedPayout) {
//         let criteria = {};
//         criteria.status = { $in: ["pending", "queued", "partiallySettled", "deferred"] };
//         criteria.type = "driver";
//         let payouts = await payoutTransferData(criteria);

//         let deferredPayoutList = payouts.filter((x) => x.accumulatedSum < 100);
//         let deferredPayouts = [];
//         // .map((x) => mongoose.Types.ObjectId(x._id));
//         for (let payout of deferredPayoutList) {
//           deferredPayouts = deferredPayouts.concat(payout.payoutData.map((x) => mongoose.Types.ObjectId(x.payoutId)));
//         }
//         // console.log("deferredPayouts1", deferredPayouts);
//         payouts = payouts.filter((x) => x.accumulatedSum >= 100);
//         await PayoutEntry.updateMany({ _id: { $in: deferredPayouts } }, { $set: { status: "deferred" } });
//         console.log("payouts", payouts);
//         let payoutIds = [];
//         if (payouts.length > 0) {
//           for (let payout of payouts) {
//             payoutIds = payoutIds.concat(payout.payoutData.map((x) => mongoose.Types.ObjectId(x.payoutId)));
//           }
//           let logData = [];
//           await PayoutEntry.updateMany({ _id: { $in: payoutIds } }, { $set: { status: "queued" } });
//           console.log("payout.length", payouts.length);
//           for (let i = 0; i < payouts.length; i++) {
//             let bulkDataObj = {};
//             let parentPayoutId = mongoose.Types.ObjectId();
//             bulkDataObj.meta = [{}];
//             bulkDataObj.account_bank = payouts[i].userDetails.accountBank;
//             bulkDataObj.account_number = payouts[i].userDetails.accountNumber;
//             bulkDataObj.amount = payouts[i].accumulatedSum;
//             // bulkDataObj.reference = "payout123456789177779";
//             bulkDataObj.reference = parentPayoutId;

//             bulkDataObj.narration = `${payouts[i].type} payout for ${payouts[i].userDetails.orderNos.toString()}`;
//             bulkDataObj.callback_url = config.get("redirectBaseUrl") + "/api/webhook/payout";
//             bulkDataObj.currency = config.get("currency");
//             bulkDataObj.meta[0].FirstName = payouts[i].userDetails.firstName;
//             bulkDataObj.meta[0].LastName = payouts[i].userDetails.lastName;
//             bulkDataObj.meta[0].EmailAddress = payouts[i].userDetails.email || config.get("dummyEmail");
//             bulkDataObj.meta[0].MobileNumber = payouts[i].userDetails.mobile;
//             bulkDataObj.meta[0].Address = payouts[i].userDetails.address;
//             bulkDataObj.meta[0].orders = payouts[i].userDetails.orderNos;
//             bulkDataObj.meta[0].userId = payouts[i].userDetails.userId;
//             let response = await autoPayout(bulkDataObj);
//             // console.log("response11*********************", response.data.data);

//             if (response.data.status == "error") continue;
//             let iteratedIds = payoutIds.splice(0, payouts[i].payoutData.length);
//             if (response.data.status == "error" || response.statusCode == 400) {
//               // bulkDataArray.push(bulkDataObj);
//               let transferId;

//               if (
//                 response.data.data.message == "Transfer creation failed" &&
//                 response.data.data.data.complete_message == "Account resolve failed"
//               ) {
//                 transferId = response.data.data.data.id;
//                 sendTemplateEmail(bulkDataObj.meta[0].EmailAddress, {}, "invalidAccount");
//               }
//               await PayoutEntry.updateMany(
//                 { _id: { $in: iteratedIds } },
//                 {
//                   $set: {
//                     status: "failure",
//                     failureType: "permanent",
//                     transferId: transferId,
//                     parentPayoutId: parentPayoutId
//                   }
//                 }
//               );
//             } else {
//               await PayoutEntry.updateMany(
//                 { _id: { $in: iteratedIds } },
//                 {
//                   $set: { status: "awaitingWebhook", transferId: response.data.data.id, parentPayoutId: parentPayoutId }
//                 }
//               );
//             }
//           }
//           // await DriverAdminLogs.insertMany(logData);
//         }
//         // }
//       }
//     }
//     isDriverPayoutComplete = true;
//   }
// }

// async function payoutTransferData(criteria) {
//   let payouts = await PayoutEntry.aggregate([
//     {
//       $match: criteria
//     },
//     {
//       $group: {
//         _id: "$userDetails.userId",
//         accumulatedSum: { $sum: "$accumulatedSum" },
//         payoutData: {
//           $push: {
//             payoutId: "$$ROOT._id",
//             accumulatedSum: "$$ROOT.accumulatedSum"
//           }
//         },
//         userDetails: {
//           $first: "$userDetails"
//         },
//         firstPayoutId: {
//           $first: "$_id"
//         },
//         type: {
//           $first: "$type"
//         }
//       }
//     },
//     {
//       $lookup: {
//         from: "subaccounts",
//         let: { userId: { $toString: "$userDetails.userId" } },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$isDefault", true] }]
//               }
//             }
//           }
//         ],
//         as: "subaccountData"
//       }
//     },
//     {
//       $addFields: {
//         "userDetails.accountBank": { $arrayElemAt: ["$subaccountData.accountBank", 0] },
//         "userDetails.accountNumber": { $arrayElemAt: ["$subaccountData.accountNumber", 0] }
//       }
//     },
//     { $limit: 20 },
//     {
//       $project: { subaccountData: 0 }
//     }
//   ]);
//   return payouts;
// }

// module.exports.payoutEntriesDriver = payoutEntriesDriver;
// module.exports.weeklyPayout = weeklyPayout;
// module.exports.payoutEntriesVendor = payoutEntriesVendor;
// module.exports.driverDailyPayout = driverDailyPayout;
// module.exports.payoutEntriesInfluencer = payoutEntriesInfluencer;

// // module.exports.settlementCod = settlementCod;
// // module.exports.payoutEntriesForDriverCod = payoutEntriesForDriverCod;

// // async function deferredPayout() {
// //   let currentTime = Math.round(new Date() / 1000);

// //   let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));

// //   // if (data.weekDay === 6 && data.hours === 23 && data.minutes >= 57) {
// //   let haltedPayout = await PayoutEntry.findOne({ status: "halted" });
// //   if (!haltedPayout) {
// //     let payouts = await PayoutEntry.aggregate([
// //       {
// //         $match: { status: "deferred" },
// //       },
// //       {
// //         $group: {
// //           _id: "$userDetails.userId",
// //           accumulatedSum: {
// //             $sum: "$accumulatedSum",
// //           },
// //           userDetails: {
// //             $first: "$userDetails",
// //           },
// //           payoutIds: {
// //             $push: "$$ROOT._id",
// //           },
// //         },
// //       },
// //     ]);
// //     // console.log("payouts1", payouts);

// //     // let deferredPayouts = payouts.filter((x) => x.accumulatedSum < 100);
// //     payouts = payouts.filter((x) => x.accumulatedSum >= 100);
// //     let payoutIds = [];
// //     if (payouts.length > 0) {
// //       for (payout of payouts) {
// //         payoutIds.push(payout._id);
// //       }
// //       let logData = [];
// //       await PayoutEntry.updateMany({ _id: { $in: payoutIds } }, { $set: { status: "queued" } });
// //       for (let i = 0; i < payouts.length; i++) {
// //         let bulkDataObj = {};
// //         bulkDataObj.meta = [{}];
// //         bulkDataObj.account_bank = payouts[i].userDetails.accountBank;
// //         bulkDataObj.account_number = payouts[i].userDetails.accountNumber;
// //         bulkDataObj.amount = payouts[i].accumulatedSum;
// //         bulkDataObj.reference = payouts[i]._id.toString();
// //         bulkDataObj.narration = `${payouts[i].type} payout for ${payouts[i].userDetails.orderNos.toString()}`;
// //         bulkDataObj.callback_url = config.get("redirectBaseUrl") + "/api/webhook/payout";
// //         // bulkDataObj.reference = "RS_305C5C62FDF812A83DEC5E67261F3DEB";
// //         bulkDataObj.currency = config.get("currency");
// //         bulkDataObj.meta[0].FirstName = payouts[i].userDetails.firstName;
// //         bulkDataObj.meta[0].LastName = payouts[i].userDetails.lastName;
// //         bulkDataObj.meta[0].EmailAddress = payouts[i].userDetails.email || config.get("dummyEmail");
// //         bulkDataObj.meta[0].MobileNumber = payouts[i].userDetails.mobile;
// //         bulkDataObj.meta[0].Address = payouts[i].userDetails.address;
// //         bulkDataObj.meta[0].orders = payouts[i].userDetails.orderNos;

// //         bulkDataObj.meta[0].userId = payouts[i].userDetails.userId;

// //         let response = await autoPayout(bulkDataObj);
// //         // console.log("response1", response);

// //         if (response.data.status == "FAILED") {
// //           // bulkDataArray.push(bulkDataObj);
// //           await PayoutEntry.updateOne({ _id: payouts[i]._id }, { $set: { status: "failure", failureType: "permanent", otherDetails: response.data } });
// //         } else {
// //           await PayoutEntry.updateOne({ _id: payouts[i]._id }, { $set: { status: "awaitingWebhook", otherDetails: response.data } });
// //         }
// //       }
// //       // await DriverAdminLogs.insertMany(logData);
// //     }
// //     // }
// //   }
// // }
// // async function settlementCod(userId) {
// //   //get codPayments for all the driver
// //   let codPayouts = await PayoutEntry.aggregate([
// //     {
// //       $match: { status: "pending", type: "codByDriver", "userDetails.userId": userId },
// //     },
// //     { $sort: { _id: 1 } },
// //     {
// //       $group: {
// //         _id: "$userDetails.userId",
// //         total: { $sum: "$accumulatedSum" },
// //         payoutData: {
// //           $push: {
// //             payoutId: "$$ROOT._id",
// //             accumulatedSum: "$$ROOT.accumulatedSum",
// //           },
// //         },
// //       },
// //     },
// //     { $sort: { _id: 1 } },
// //   ]);

// //   for (i = 0; i < codPayouts.length; i++) {
// //     let payoutIds = [];
// //     for (j = 0; j < codPayouts[i].payoutData.length; j++) {
// //       payoutIds.push(mongoose.Types.ObjectId(codPayouts[i].payoutData[j].payoutId));
// //     }
// //     // find the entry of that particular driver
// //     let toBePaid = await PayoutEntry.findOne({ status: { $in: ["pending", "queued", "partiallySettled"] }, type: "driver", "userDetails.userId": codPayouts[i]._id });
// //     if (!toBePaid) continue;

// //     let diff = toBePaid.accumulatedSum - codPayouts[i].total;
// //     //case 1: when toPay is less than  toBePaid
// //     //then update all the entries of codPayments of that driver as completed and also update toBePaid amount.
// //     if (diff >= 0) {
// //       //       $push: { blockedBy: req.jwtData.userId },
// //       await PayoutEntry.updateMany({ _id: { $in: payoutIds } }, { $set: { status: "completed" }, $push: { settledWith: toBePaid._id } });
// //       if (diff > 0) {
// //         toBePaid.accumulatedSum -= diff;
// //         toBePaid.status = "partiallySettled";
// //       } else {
// //         toBePaid.status = "settled";
// //       }
// //     }
// //     //case 2: when toPay is greater than toBePaid
// //     //then check how many codPayment entries got exhausted with toBePaid
// //     else {
// //       let data = checkForPayments(codPayouts[i].payoutData, 0, codPayouts[i].payoutData[0].accumulatedSum, toBePaid.accumulatedSum);
// //       //above function will return two arrays... Ist one is the list of cod payouts which exhausted completely
// //       //and second one is the list of unexhausted payouts
// //       if (data.array.length > 0) {
// //         payoutIds = payoutIds.slice(0, data.array.length - 1);
// //         await PayoutEntry.updateMany({ _id: { $in: payoutIds } }, { $set: { status: "completed" }, $push: { settledWith: toBePaid._id } });
// //       }
// //       if (data.newArray.length > 0) {
// //         await PayoutEntry.updateOne({ _id: data.newArray[0].payoutId }, { $inc: { accumulatedSum: data.toBeMinus } }, { $push: { settledWith: toBePaid._id } });
// //       }
// //       toBePaid.status = "settled";
// //     }
// //     await toBePaid.save();
// //   }
// // }

// // async function payoutEntriesForDriverCod() {
// //   let currentTime = Math.round(new Date() / 1000);
// //   let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));
// //   // if (data.weekDay === 6 && data.hours === 23 && data.minutes >= 54) {
// //   let criteria = {};
// //   // criteria.deliveredAt = { $lt: currentTime };
// //   // criteria.orderStatus = "DELIVERED";
// //   // criteria.paymentType = "POD";
// //   // criteria.vendorCategory = { $ne: "pickUpAndDrop" };
// //   criteria.isOrderAmtPaidToAdmin = false;

// //   criteria.driverId = { $ne: "" };
// //   let orders = await Order.aggregate([
// //     {
// //       $match: criteria,
// //     },
// //     {
// //       $project: {
// //         driverId: 1,
// //         orderId: "$_id",
// //         orderNo: 1,
// //         vendorAmount: 1,
// //         totalAmount: 1,
// //         driverAmount: 1,
// //       },
// //     },
// //     {
// //       $group: {
// //         _id: "$driverId",
// //         total: {
// //           $sum: "$totalAmount",
// //         },
// //         orderData: {
// //           $push: "$$ROOT",
// //         },
// //         orderNos: {
// //           $push: "$$ROOT.orderNo",
// //         },
// //       },
// //     },
// //     { $addFields: { driverId: { $toObjectId: "$_id" } } },
// //     { $lookup: { from: "drivers", localField: "driverId", foreignField: "_id", as: "driverData" } },

// //     {
// //       $addFields: {
// //         userDetails: {
// //           userId: "$_id",
// //           firstName: { $arrayElemAt: ["$driverData.firstName", 0] },
// //           lastName: { $arrayElemAt: ["$driverData.lastName", 0] },
// //           email: { $arrayElemAt: ["$driverData.email", 0] },
// //           mobile: { $arrayElemAt: ["$driverData.mobile", 0] },
// //           address: { $arrayElemAt: ["$driverData.address", 0] },
// //           // accountNumber: { $arrayElemAt: ["$subaccountData.accountNumber", 0] },
// //           // accountBank: { $arrayElemAt: ["$subaccountData.accountBank", 0] },
// //           orderNos: "$orderNos",
// //         },
// //       },
// //     },
// //   ]);

// //   let orderData = [];
// //   for (order of orders) {
// //     let orderObj = {};
// //     // let pendingCodPayout = await PayoutEntry.findOne({ "userDetails.userId": order.userDetails.userId, status: "codByDriver" });
// //     // console.log("deferredPayout", pendingCodPayout);
// //     // if (pendingCodPayout) {
// //     //   order.total = order.total + pendingCodPayout.accumulatedSum;
// //     //   order.orderData = [...order.orderData, ...pendingCodPayout.orderDetails];
// //     //   order.userDetails.pendingCodPayoutId = pendingCodPayout._id.toString();
// //     //   pendingCodPayout.status = "completed";
// //     //   await pendingCodPayout.save();
// //     //   console.log("order.total", order.total);
// //     // }

// //     orderObj.accumulatedSum = order.total;
// //     orderObj.initialSum = order.total;

// //     orderObj.userId = order.userId;
// //     orderObj.userDetails = order.userDetails;
// //     orderObj.type = "codByDriver";
// //     orderObj.orderDetails = order.orderData;
// //     orderObj.status = "pending";
// //     orderData.push(orderObj);
// //     let newPayout = await PayoutEntry.create(orderObj);
// //     // await Order.updateMany(criteria, { $set: { isOrderAmtPaidToAdmin: true } });
// //     await Order.updateMany({ orderNo: { $in: order.userDetails.orderNos } }, { $set: { isOrderAmtPaidToAdmin: true, payoutId: newPayout._id.toString() } });
// //   }
// //   // console.log("orderData", orderData);
// //   // await PayoutEntry.insertMany(orderData);
// // }

// // async function driverDailyPayout() {
// //   let currentTime = Math.round(new Date() / 1000);
// //   let data = await getWeekDayHoursMinutes(currentTime, config.get("timeZone"));
// //   // console.log("data,", data);

// //   // if (data.hours === 23 && data.minutes > 30) {
// //   let haltedPayout = await PayoutEntry.findOne({ status: "halted" });
// //   if (!haltedPayout) {
// //     let payouts = await PayoutEntry.find({ status: { $in: ["pending", "queued", "partiallySettled"] }, type: "driver" }).limit(5);

// //     let deferredPayouts = payouts.filter((x) => x.accumulatedSum < 100).map((x) => mongoose.Types.ObjectId(x._id));
// //     payouts = payouts.filter((x) => x.accumulatedSum >= 100);

// //     let founded = await PayoutEntry.find({ _id: { $in: deferredPayouts } });

// //     await PayoutEntry.updateMany({ _id: { $in: deferredPayouts } }, { $set: { status: "deferred" } });

// //     let payoutIds = [];
// //     if (payouts.length > 0) {
// //       for (payout of payouts) {
// //         payoutIds.push(payout._id);
// //       }
// //       let logData = [];
// //       await PayoutEntry.updateMany({ _id: { $in: payoutIds } }, { $set: { status: "queued" } });
// //       for (let i = 0; i < payouts.length; i++) {
// //         let bulkDataObj = {};
// //         bulkDataObj.meta = [{}];
// //         bulkDataObj.account_bank = payouts[i].userDetails.accountBank;
// //         bulkDataObj.account_number = payouts[i].userDetails.accountNumber;
// //         bulkDataObj.amount = payouts[i].accumulatedSum;
// //         bulkDataObj.reference = payouts[i]._id.toString();
// //         bulkDataObj.narration = `${payouts[i].type} payout for ${payouts[i].userDetails.orderNos.toString()}`;
// //         bulkDataObj.callback_url = config.get("redirectBaseUrl") + "/api/webhook/payout";
// //         // bulkDataObj.reference = "RS_305C5C62FDF812A83DEC5E67261F3DEB";
// //         bulkDataObj.currency = config.get("currency");
// //         bulkDataObj.meta[0].FirstName = payouts[i].userDetails.firstName;
// //         bulkDataObj.meta[0].LastName = payouts[i].userDetails.lastName;
// //         bulkDataObj.meta[0].EmailAddress = payouts[i].userDetails.email || config.get("dummyEmail");
// //         bulkDataObj.meta[0].MobileNumber = payouts[i].userDetails.mobile;
// //         bulkDataObj.meta[0].Address = payouts[i].userDetails.address;
// //         bulkDataObj.meta[0].orders = payouts[i].userDetails.orderNos;

// //         bulkDataObj.meta[0].userId = payouts[i].userDetails.userId;

// //         let response = await autoPayout(bulkDataObj);
// //         // console.log("response1", response);

// //         if (response.data.status == "FAILED" || response.status == 400) {
// //           // bulkDataArray.push(bulkDataObj);
// //           await PayoutEntry.updateOne({ _id: payouts[i]._id }, { $set: { status: "failure", failureType: "permanent", otherDetails: { message: response.data.message } } });
// //         } else {
// //           await PayoutEntry.updateOne({ _id: payouts[i]._id }, { $set: { status: "awaitingWebhook" } });
// //         }
// //       }
// //       // await DriverAdminLogs.insertMany(logData);
// //     }
// //     // }
// //   }
// //   // }
// // }
