// const mongoose = require("mongoose");
// const config = require("config");
// const moment = require("moment-timezone");
// const { getWeekDayHoursMinutes } = require("../services/commonFunctions");
// let currentTime = 1649569189;
// let data = getWeekDayHoursMinutes(currentTime, config.get("timeZone"));
// if (data.weekDay === 0 && data.hours > 2) {
//   console.log("data", data);
// } else {
//   console.log("dfdd");
// }

// const { getDistance } = require("geolib");
// const geolib = require("geolib");
// let timeZone = config.get("timeZone");
// let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
// let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
// if (saturdayEndTime > Math.round(new Date() / 1000)) {
//   saturdayEndTime -= 7 * 86400;
//   console.log("saturdayEndTime", saturdayEndTime);
// }
// let sevenDaysBack = saturdayEndTime - 7 * 86400;
// console.log("sevenDaysBack", sevenDaysBack);
// let currentTime = 1649032425;
// let data = getWeekDayHoursMinutes(currentTime, config.get("timeZone"));
// console.log("data", data);
//let array =
//   {
//     payoutId: "620f3f03357602e531a1d1ee",
//     accumulatedSum: 50,
//   },
//   {
//     payoutId: "620f3f1b357602e531a1d1ef",
//     accumulatedSum: 10,
//   },
//   {
//     payoutId: "620f3f3f357602e531a1d1f0",
//     accumulatedSum: 20,
//   },
// ];

// let toBePaid = 50;
// function test(array, index, sum, toBePaid) {
//   //console.log("sum", sum, "toBePaid", toBePaid);
//   if (sum > toBePaid) {
//     console.log("In 1st", sum, array[index].accumulatedSum, index);

//     let newArray = array.splice(index);
//     // sum - newArray[0].accumulatedSum - toBePaidAmt;
//     // console.log("new", newArray, array);
//     let toBeMinus = Math.round((sum - newArray[0].accumulatedSum - toBePaid) * 10) / 10;

//     return { array, newArray, toBeMinus };
//   } else {
//     console.log(sum, array[index].accumulatedSum, index);
//     if (index == array.length - 1) return array;
//     index++;
//     sum += array[index].accumulatedSum;

//     return test(array, index, sum, toBePaid);
//   }
// }

// let array = [34, 24, 26, 57];
// index = 0;
// console.log("final", test(array, index, array[index].accumulatedSum, toBePaid));
//console.log("arraylength", array);

// const { Coupon } = require("../models/coupon");
// async function test() {
//   let coupons = await Coupon.find({}).lean();

//   for (i = 0; i < coupons.length; i++) {
//     let newArray = coupons[i].vendorType.map((x) => {
//       return typeof x == "string" ? x : x.name;
//     });
//     console.log("i", i);
//     console.log("newArray", newArray);
//     await Coupon.updateOne({ _id: coupons[i]._id }, { $set: { vendorType: newArray } });

//   }
// }
// exports.test = test;
// const moment = require("moment-timezone");
// let currentDate = moment.tz(config.get("timeZone")).format("YYYY-MM-DD");
// let epoch = +new Date() - 86400000;
// let previousDate = moment.tz(epoch, config.get("timeZone")).format("YYYY-MM-DD");

// console.log("currentDate", previousDate, currentDate);

// let result = await OrderNo.findOneAndUpdate({}, { $inc: { payoutNo: 1 } }, { new: true });
// console.log(result);
// payout.payoutNo = result.payoutNo;
// let ids = ["6226fcfad74b7300161b4911", "6226fcf8d74b7300161b490d"];
// let objIds = ids.map((x) => mongoose.Types.ObjectId(x));
// console.log("objIds", objIds);
// db.users.updateMany({}, [{ $set: { status: { $cond: { if: "active", then: "inactive" }, else: { if: "inactive", then: "active" } } } }]);
// db.users.updateMany({}, [{ $set: { $cond: { if: { status: "active" }, then: { status: "inactive" } }, else: { if: { status: "inactive" }, then: { status: "active" } } } }]);
// db.users.updateMany({}, [{ $set:{status: {$switch: {branches: [{ case: { $eq: ["$status", "active"] }, then: "inactive" },{ case: { $eq: ["$status", "inactive"] }, then: "active" },], default: "",},},},},]);
// let timeZone = config.get("timeZone");
// let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
// let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
// let sevenDaysBack = saturdayEndTime - 7 * 86400;
// criteria.insertDate = { $gt: sevenDaysBack, $lte: saturdayEndTime };
// nextMatchTimeNotification;

// if (nextMatchTimeNotification < currentEpoch) {
//   nextMatchTimeNotification += 604800;
// }
// let rev = 0;
// let num = 123456;
// let lastDigit;

// while (num != 0) {
//   lastDigit = num % 10;
//   console.log("rev", rev, lastDigit);
//   rev = rev * 10 + lastDigit;
//   num = Math.floor(num / 10);
// }
// console.log("Reverse number : ", rev);
// let currentTime = Math.round(new Date() / 1000);
// const { getWeekDayHoursMinutes } = require("../services/commonFunctions");

// let data = getWeekDayHoursMinutes(1646505080, config.get("timeZone"));
// console.log("data", data);
// let timeZone = config.get("timeZone");
// let saturdayDate = moment.tz(moment().day(6).valueOf(), timeZone).format("YYYY-MM-DD");
// let saturdayEndTime = Math.round(moment.tz(saturdayDate + "T23:59", timeZone).valueOf() / 1000);
// if (saturdayEndTime > Math.round(new Date() / 1000)) {
//   saturdayEndTime -= 7 * 86400;
//   console.log("saturdayEndTime", saturdayEndTime);
// }
// ("$(curl -s --location --request GET 'https://api.telegram.org/bot5093456275:AAEs-8YMXL54WhQCefN30bt9S-LSO2U3f-c/sendMessage?chat_id=@Waive_app&parse_mode=HTML&text= Server Stopped ')");
// let distance = getDistance({ latitude: 30.7128626, longitude: 76.6895462 }, { latitude: 30.7142858, longitude: 76.688975 }, (accuracy = 1));
// console.log("distance", distance);
// let dayStartTime = Math.round(new Date().setUTCHours(0, 0, 0, 0) / 1000) + parseInt(config.get("inOffset"));
// console.log("dayStartTime", dayStartTime);
// let prevDayStartTime = dayStartTime - 86400;
// console.log("prevDayStartTime", prevDayStartTime);
// const process = require("process");
// var promise = new Promise(function (resolve, reject) {
//   resolve();
// });
// promise
//   .then(function (resolve) {
//     console.log("Message no. 3: 1st Promise");
//   })
//   .then(function (resolve) {
//     console.log("Message no. 4: 2nd Promise");
//   });
// process.nextTick(() => {
//   console.log("Executed in the ist iteration");
// });
// process.nextTick(() => {
//   console.log("Executed in the next iteration");
// });
// console.log("Message no. 1: Sync");
// setImmediate(() => {
//   console.log("set immidiatte 1st iteration");
// });
// setTimeout(function () {
//   console.log("Message no. 2: setTimeout");
// }, 50);

// setImmediate(() => {
//   console.log("set immidiatte 1st iteration");
// });

// console.log("Message no. 5: Sync");
// const { EventEmitter, errorMonitor } = require("events");

// class MyEmitter extends EventEmitter {}
// const myEmitter = new MyEmitter();
// myEmitter.on("event", function (a, b) {
//   console.log(a, b, this, this === myEmitter);
//   // Prints:
//   //   a b MyEmitter {
//   //     domain: null,
//   //     _events: { event: [Function] },
//   //     _eventsCount: 1,
//   //     _maxListeners: undefined } true
// });

// myEmitter.on("newEvent", function (c, d) {
//   setImmediate(() => {
//     console.log(c, d, this, this === myEmitter);

//     console.log("this happens asynchronously");
//   });
// });
// myEmitter.emit("event", "a", "b");
// myEmitter.emit("newEvent", "c", "d");

console.log("xy");
// myEmitter.on("error", (err) => {
//   console.error("whoops! there was an error");
// });
// myEmitter.emit("error", new Error("whoops!"));

// const ee = new EventEmitter();
// ee.on("something", async (value) => {
//   throw new Error("kaboom");
// });

// db.payoutentries.find({ parentPayoutId: { $exists: false }, type: { $ne: "codByDriver" } }).forEach(function (x) {
//   db.payoutentries.updateOne({ _id: x._id }, { $set: { parentPayoutId: x._id.toString().split('"')[1] } });
// });
// const config = require("config");
// const { ApiLog } = require("../models/apiLog");
// let { PayoutEntry } = require("../models/payoutEntry");
// async function test() {
//   let apilogs = await ApiLog.find({ url: "/api/webhook/payout" }, { body: 1, _id: 0 }).sort({ insertDate: -1 }).lean();
//   let toBeChangedPayouts = [];

//   for (let i = 0; i < apilogs.length; i++) {
//     let bodyObject = {};
//     if (config.get("environment") == "prod") {
//       bodyObject = apilogs[i].body.data;
//     } else {
//       bodyObject = apilogs[i].body.transfer;
//     }
//     let payout = await PayoutEntry.findOne({ parentPayoutId: bodyObject.reference });

//     if (bodyObject.status == "SUCCESSFUL") {
//       await PayoutEntry.updateMany({ parentPayoutId: bodyObject.reference }, { $set: { status: "success", transferId: bodyObject.id } });
//     } else if (bodyObject.status == "FAILED") {
//       if (bodyObject.complete_message == "DISBURSE FAILED: Insufficient funds in customer balance") {
//         await PayoutEntry.updateMany({ parentPayoutId: bodyObject.reference }, { $set: { failureType: "temporary", status: "failure", transferId: bodyObject.id } });
//         let haltedPayout = await PayoutEntry.findOne({ status: "halted" });
//         if (!haltedPayout) {
//           await PayoutEntry.updateMany({ status: "pending", type: { $ne: "codByDriver" } }, { $set: { status: "halted" } });
//         }
//       } else {
//         if (bodyObject.complete_message == "Account resolve failed") {
//           await PayoutEntry.updateMany({ parentPayoutId: bodyObject.reference }, { $set: { failureType: "permanent", transferId: bodyObject.id, status: "failure" } });
//         }
//       }
//     }
//   }
// }
// module.exports.test = test;
