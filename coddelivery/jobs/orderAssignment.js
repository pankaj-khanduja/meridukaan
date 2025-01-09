const config = require("config");
let { Order } = require("../models/order");
const mongoose = require("mongoose");
let { OrderNotificationSent } = require("../models/orderNotificationSent");
let { Driver } = require("../models/driver");
const { sendFCM, sendMultipleFCM } = require("../services/fcmModule");
const { Store } = require("../models/vendor");
const { checkRefundTransaction, paymentLinkById } = require("../services/razorPayFunctions");

mongoose.set("debug", true);

const { RequestedDriver } = require("../models/driver");
const { Referral } = require("../models/referral");
const { User } = require("../models/user");

let flag = true;
async function orderAssignment() {
  let currentTime = Math.round(new Date() / 1000);
  await Order.updateMany({ orderStatus: "UPCOMING", "details.deliveryTime": { $lte: currentTime } }, { $set: { orderStatus: "ACCEPTED" } });
  if (flag) {
    // console.log("Inside order assignment: ")
    flag = false;
    while (true) {
      let currentTime = Math.round(new Date() / 1000);

      let order = await Order.findOne({ orderStatus: "ACCEPTED", switchDriverTime: { $lte: currentTime }});
      console.log(order,"orderorderorderorderorder===")
      if (!order) {
        break;
      }

      let drivers = [];
      // let currentDriver = "";

      // Case - Driver's not added --- find available drivers
      // if (order.requestedDrivers.length == 0) {
      // Get eligible drivers
      let requestedDrivers = await RequestedDriver.find({}, { driverId: 1, _id: 0 }).lean();
      console.log(requestedDrivers,"requestedDriversrequestedDriversrequestedDriversrequestedDrivers=======");
      
      let requestedDriverIds = [];
      for (let requestedDriver of requestedDrivers) {
        requestedDriverIds.push(mongoose.Types.ObjectId(requestedDriver.driverId));
      }
      // console.log("requestedDriverIds", requestedDriverIds);

      let criteria = {};
      let rejectedDriverIds = [];
      let location = order.vendorLocation.coordinates;
      if (order.rejectedBy.length > 0) {
        rejectedDriverIds = order.rejectedBy.map((element) => mongoose.Types.ObjectId(element));
      }
      criteria.$and = [{ _id: { $nin: rejectedDriverIds } }, { _id: { $nin: requestedDriverIds } }];

      criteria.isAcceptingOrders = true;
      criteria.isFreezed = false;
      criteria.pendingOrders = { $lt: config.get("maxOrders") };
      if (order.vendorDriverCount && order.loopCount == 0 && order.noDriverFoundLoopCount == 0) {
        criteria.vendorId = order.vendorId;
      }
      if ((order.loopCount > 0 || order.noDriverFoundLoopCount > 0) && order.vendorCategory != "pickUpAndDrop") {
        criteria.$or = [{ isVendorDriver: { $ne: true } }, { vendorId: { $eq: order.vendorId } }];
      }
      if (order.vendorCategory == "pickUpAndDrop") {
        criteria.isVendorDriver = { $ne: true };
        criteria.vehicleType = order.vehicleType;
        location = order.details.pickUpLocation;
      }
      // Not needed for now
      console.log("criteria==============", criteria);
      drivers = await Driver.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: location },
            distanceField: "dist.calculated",
            maxDistance: parseInt(config.get("driverMaxDistance")),
            query: criteria,
            includeLocs: "dist.location",
            spherical: true,
          },
        },
        { $sort: { dist: 1 } },
        // { $limit: config.get("driversLimit") },
        {
          $project: {
            _id: 0,
            driverId: "$_id",
            deviceToken: 1,
          },
        },
      ]);
      console.log("driverslenghtttt", drivers.length, drivers);
      if (drivers.length == 0) {
        order.switchDriverTime = currentTime + config.get("noDriverFoundTimer");
        order.noDriverFoundLoopCount += 1;
        if (order.noDriverFoundLoopCount > 5) {
          order.orderStatus = "UNASSIGNED";
          order.isUnassignedSoundNeedsToBeNotified = true;
        }
        await order.save();

        // Update order with no driver found. Retry timer to be configurable for this.
        continue;
      } else {
        order.switchDriverTime = currentTime + config.get("driverFoundTimer");
        order.loopCount += 1;
        if (order.loopCount > 2) {
          order.orderStatus = "UNASSIGNED";
          order.isUnassignedSoundNeedsToBeNotified = true;
        }
        await order.save();
      }
      if (order.loopCount > 2) {
        continue;
      }
      // 5 mins if group is done

      // order.requestedDrivers = drivers;

      //  else {
      //   order.switchDriverTime = currentTime + config.get("noDriverFoundTimer"); // 30 seconds
      // }
      // currentDriver = order.requestedDrivers.shift();
      // let alreadyRequested = await OrderNotificationSent.findOne({ driverId: currentDriver.driverId });
      // if (alreadyRequested) {
      //   order.switchDriverTime = currentTime;
      //   await order.save();
      //   break;
      // }
      // order.currentDriver = currentDriver;
      // order.loopCount += 1;
      // if (order.loopCount === 3) {
      //   order.orderStatus = "UNASSIGNED";
      // }
      // await order.save();

      // increment time for next check with driver interval if this is not the last driver
      // increment time with group interval if this is last driver
      // update order

      // Get driver data and check if he is still eligible
      // let driver = await Driver.findOne({
      //   _id: currentDriver.driverId,
      //   isAcceptingOrders: true,
      //   pendingOrders: { $lt: config.get("maxOrders") },
      // });

      // if (driver) {
      let data = {};
      if (order.vendorCategory != "pickUpAndDrop") {
        data = {
          orderId: order._id.toString(),
          orderNo: order.orderNo.toString(),
          vendorName: order.vendorName.toString(),
          vendorImage: order.vendorImage.toString(),
          vendorAddress: order.vendorAddress.toString(),
          totalAmount: order.totalAmount.toString(),
          deliveryCharges: order.deliveryCharges.toString(),
          // packagingCharges: order.packagingCharges.toString(),

          driverAmount: order.driverAmount.toString(),
          deliveryTip: order.deliveryTip.toString(),
          paymentType: order.paymentType.toString(),
          vendorLocation: order.vendorLocation.coordinates.toString(),
          vendorCategory: order.vendorCategory,
          currentTime: currentTime.toString(),
          type: "newOrder",
        };
      } else {
        let itemPicture = "";
        if (order.details.itemPicture) {
          itemPicture = order.details.itemPicture.toString();
        }
        data = {
          orderId: order._id.toString(),
          orderNo: order.orderNo.toString(),
          totalAmount: order.totalAmount.toString(),

          deliveryCharges: order.deliveryCharges.toString(),
          driverAmount: order.driverAmount.toString(),
          deliveryTip: order.deliveryTip.toString(),
          paymentType: order.paymentType.toString(),
          vendorCategory: order.vendorCategory.toString(),

          itemPicture: itemPicture,

          pickUpLocation: order.details.pickUpLocation.toString() || "",
          pickUpAddress: order.details.pickUpAddress.currentAddress || "",
          pickUpCompleteAddress: order.details.pickUpAddress.completeAddress || "",
          senderName: order.details.senderName.toString(),
          currentTime: currentTime.toString(),
          type: "newOrder",
        };
      }
      let deviceTokens = [];
      let driverIds = [];

      for (driver of drivers) {
        if (driver.deviceToken && driver.deviceToken != "") {
          deviceTokens.push(driver.deviceToken);
          driverIds.push(driver.driverId);
        }
      }

      console.log(deviceTokens,"deviceTokensdeviceTokensdeviceTokensdeviceTokens==========")
      await RequestedDriver.insertMany(drivers);
      await sendMultipleFCM(deviceTokens, data, "newOrder");
      await OrderNotificationSent.insertMany({
        driverIds: driverIds,
        notificationType: "newOrder",
        notificationData: data,
      });
      // }
    }
  }

  flag = true;
}

async function paymentFailureOrders() {
  // const currentTime = Math.round(new Date() / 1000);
  // const eightMinutesAgo = currentTime - (8 * 60);

  // let orders = await Order.find({ orderStatus: "PENDING", paymentType: "paidOnline", insertDate: { $lte: eightMinutesAgo } });
  let orders = await Order.find({ orderStatus: "PENDING", paymentType: "paidOnline" });

  if (orders.length > 0) {

    let orderPaymentCompleted = [];
    let orderPaymentFailed = [];

    for (let i = 0; i < orders.length; i++) {
      const element = orders[i];
      if (element.orderPaymentId && (element.orderPaymentId != "")) {
        let checkPaymentStatus = await paymentLinkById(element.orderPaymentId);
        if (checkPaymentStatus.statusCode === 200) {
          if (checkPaymentStatus.data.status === "paid") {
            orderPaymentCompleted.push(element);
          } else if (checkPaymentStatus.data.status === "expired" || checkPaymentStatus.data.status === "cancelled") {
            orderPaymentFailed.push(element);
            let referral;
            if (element.referralId && element.referralId != "") {
              referral = await Referral.findOne({ userId: element.userId });
              if (referral) {
                referral.status = "active";
                await referral.save();
              } else {
                referral = await Referral.findOne({ referredByStatus: element.userId });
                if (referral) {
                  referral.referredByStatus = "active";
                  await referral.save();
                  await User.updateOne({ _id: mongoose.Types.ObjectId(element.userId) }, { $inc: { totalReferral: 1 } })
                }
              }
            }
          }
        }
      } else {
        orderPaymentFailed.push(element);
      }
    }
    if (orderPaymentFailed.length > 0) {
      const orderIdsToUpdate = orderPaymentFailed.map(order => order._id);
      await Order.updateMany({ _id: { $in: orderIdsToUpdate } }, { $set: { orderStatus: "CANCELLED", paymentLinkStatus: "failed", "cancelledBy.role": "System" } });
    }

    if (orderPaymentCompleted.length > 0) {
      const orderIdsToComplete = orderPaymentCompleted.map(order => order._id);
      // await Order.updateMany({ _id: { $in: orderIdsToComplete } }, { $set: { orderStatus: "CANCELLED", isRefundPending: true, orderRefundStatus: "pending", paymentLinkStatus: "paid", "cancelledBy.role": "System" } })
      await Order.updateMany({ _id: { $in: orderIdsToComplete } }, { $set: { orderStatus: "ACTIVE", paymentLinkStatus: "paid", } });
    }


  }
}

async function checkRefundTransactionStatus() {
  const currentTime = Math.round(new Date() / 1000);
  const eightMinutesAgo = currentTime - (8 * 60);
  console.log(eightMinutesAgo, "eightMinutesAgo");

  let orders = await Order.find({ orderStatus: { $in: ["CANCELLED", "REJECTED"] }, paymentType: "paidOnline", refundId: { $ne: "" }, razorpay_payment_id: { $ne: "" } });
  if (orders.length > 0) {

    let updatedOrders = [];
    for (let i = 0; i < orders.length; i++) {
      const element = orders[i];

      let data = {};

      data.paymentId = element.razorpay_payment_id;
      data.refundId = element.refundId;


      let refundStatus = await checkRefundTransaction(data)
      if (refundStatus.statusCode === 200) {
        let status;
        status = refundStatus.data.status;
        if (refundStatus.data.status === "processed") {
          status = "Refunded"
        }
        element.orderRefundStatus = status;
        element.isRefundToVerified = true;
        element.isRefundPending = false;
      }





    }






    await Order.updateMany({ _id: { $in: orderIdsToUpdate } }, { $set: { orderStatus: "CANCELLED", paymentLinkStatus: "failed", "cancelledBy.role": "System" } })
  }


}





module.exports.paymentFailureOrders = paymentFailureOrders;
module.exports.orderAssignment = orderAssignment;
// const config = require("config");
// let { Order } = require("../models/order");
// const mongoose = require("mongoose");
// let { OrderNotificationSent } = require("../models/orderNotificationSent");
// let { Driver } = require("../models/driver");
// const { sendFCM, sendMultipleFCM } = require("../services/fcmModule");
// const { Store } = require("../models/vendor");

// mongoose.set("debug", true);

// const { RequestedDriver } = require("../models/driver");

// let flag = true;
// async function orderAssignment() {
//   let currentTime = Math.round(new Date() / 1000);
//   await Order.updateMany({ orderStatus: "UPCOMING", "details.deliveryTime": { $lte: currentTime } }, { $set: { orderStatus: "ACCEPTED" } });
//   if (flag) {
//     // console.log("Inside order assignment: ")
//     flag = false;
//     while (true) {
//       let currentTime = Math.round(new Date() / 1000);

//       let order = await Order.findOne({ orderStatus: "ACCEPTED", switchDriverTime: { $lte: currentTime } });
//       if (!order) {
//         break;
//       }

//       let drivers = [];
//       // let currentDriver = "";

//       // Case - Driver's not added --- find available drivers
//       // if (order.requestedDrivers.length == 0) {
//       // Get eligible drivers
//       let requestedDrivers = await RequestedDriver.find({}, { driverId: 1, _id: 0 }).lean();
//       let requestedDriverIds = [];
//       for (requestedDriver of requestedDrivers) {
//         requestedDriverIds.push(mongoose.Types.ObjectId(requestedDriver.driverId));
//       }
//       // console.log("requestedDriverIds", requestedDriverIds);

//       let criteria = {};

//       let rejectedDriverIds = [];
//       if (order.vendorDriverCount && order.loopCount == 0) {
//         criteria.vendorId = order.vendorId;
//       }
//       let location = order.vendorLocation.coordinates;
//       if (order.rejectedBy.length > 0) {
//         rejectedDriverIds = order.rejectedBy.map((element) => mongoose.Types.ObjectId(element));
//       }
//       criteria.$and = [{ _id: { $nin: rejectedDriverIds } }, { _id: { $nin: requestedDriverIds } }];

//       criteria.isAcceptingOrders = true;
//       criteria.isFreezed = false;
//       criteria.pendingOrders = { $lt: config.get("maxOrders") };
//       if (order.vendorCategory == "pickUpAndDrop") {
//         criteria.vehicleType = order.vehicleType;
//         location = order.details.pickUpLocation;
//       }
//       // Not needed for now

//       drivers = await Driver.aggregate([
//         {
//           $geoNear: {
//             near: { type: "Point", coordinates: location },
//             distanceField: "dist.calculated",
//             maxDistance: parseInt(config.get("driverMaxDistance")),
//             query: criteria,
//             includeLocs: "dist.location",
//             spherical: true,
//           },
//         },
//         { $sort: { dist: 1 } },
//         // { $limit: config.get("driversLimit") },
//         {
//           $project: {
//             _id: 0,
//             driverId: "$_id",
//             deviceToken: 1,
//           },
//         },
//       ]);
//       console.log("driver12", drivers);
//       // console.log("driverslenghtttt", drivers.length);
//       if (drivers.length == 0) {
//         order.switchDriverTime = currentTime + config.get("noDriverFoundTimer");
//         order.noDriverFoundLoopCount += 1;
//         if (order.noDriverFoundLoopCount > 5) {
//           order.orderStatus = "UNASSIGNED";
//           order.isUnassignedSoundNeedsToBeNotified = true;
//         }
//         await order.save();

//         // Update order with no driver found. Retry timer to be configurable for this.
//         continue;
//       } else {
//         order.switchDriverTime = currentTime + config.get("driverFoundTimer");
//         order.loopCount += 1;
//         if (order.loopCount > 2) {
//           order.orderStatus = "UNASSIGNED";
//           order.isUnassignedSoundNeedsToBeNotified = true;
//         }
//         await order.save();
//       }
//       if (order.loopCount > 2) {
//         continue;
//       }
//       // 5 mins if group is done

//       // order.requestedDrivers = drivers;

//       //  else {
//       //   order.switchDriverTime = currentTime + config.get("noDriverFoundTimer"); // 30 seconds
//       // }
//       // currentDriver = order.requestedDrivers.shift();
//       // let alreadyRequested = await OrderNotificationSent.findOne({ driverId: currentDriver.driverId });
//       // if (alreadyRequested) {
//       //   order.switchDriverTime = currentTime;
//       //   await order.save();
//       //   break;
//       // }
//       // order.currentDriver = currentDriver;
//       // order.loopCount += 1;
//       // if (order.loopCount === 3) {
//       //   order.orderStatus = "UNASSIGNED";
//       // }
//       // await order.save();

//       // increment time for next check with driver interval if this is not the last driver
//       // increment time with group interval if this is last driver
//       // update order

//       // Get driver data and check if he is still eligible
//       // let driver = await Driver.findOne({
//       //   _id: currentDriver.driverId,
//       //   isAcceptingOrders: true,
//       //   pendingOrders: { $lt: config.get("maxOrders") },
//       // });

//       // if (driver) {
//       let data = {};
//       if (order.vendorCategory != "pickUpAndDrop") {
//         data = {
//           orderId: order._id.toString(),
//           orderNo: order.orderNo.toString(),
//           vendorName: order.vendorName.toString(),
//           vendorImage: order.vendorImage.toString(),
//           vendorAddress: order.vendorAddress.toString(),
//           totalAmount: order.totalAmount.toString(),
//           deliveryCharges: order.deliveryCharges.toString(),
//           driverAmount: order.driverAmount.toString(),
//           deliveryTip: order.deliveryTip.toString(),
//           paymentType: order.paymentType.toString(),
//           vendorLocation: order.vendorLocation.coordinates.toString(),
//           vendorCategory: order.vendorCategory,
//           currentTime: currentTime.toString(),
//           type: "newOrder",
//         };
//       } else {
//         let itemPicture = "";
//         if (order.details.itemPicture) {
//           itemPicture = order.details.itemPicture.toString();
//         }
//         data = {
//           orderId: order._id.toString(),
//           orderNo: order.orderNo.toString(),
//           totalAmount: order.totalAmount.toString(),

//           deliveryCharges: order.deliveryCharges.toString(),
//           driverAmount: order.driverAmount.toString(),
//           deliveryTip: order.deliveryTip.toString(),
//           paymentType: order.paymentType.toString(),
//           vendorCategory: order.vendorCategory.toString(),

//           itemPicture: itemPicture,

//           pickUpLocation: order.details.pickUpLocation.toString() || "",
//           pickUpAddress: order.details.pickUpAddress.currentAddress || "",
//           pickUpCompleteAddress: order.details.pickUpAddress.completeAddress || "",
//           senderName: order.details.senderName.toString(),
//           currentTime: currentTime.toString(),
//           type: "newOrder",
//         };
//       }
//       let deviceTokens = [];
//       let driverIds = [];

//       for (driver of drivers) {
//         if (driver.deviceToken && driver.deviceToken != "") {
//           deviceTokens.push(driver.deviceToken);
//           driverIds.push(driver.driverId);
//         }
//       }
//       await RequestedDriver.insertMany(drivers);
//       await sendMultipleFCM(deviceTokens, data, "newOrder");
//       await OrderNotificationSent.insertMany({
//         driverIds: driverIds,
//         notificationType: "newOrder",
//         notificationData: data,
//       });
//       // }
//     }
//   }

//   flag = true;
// }
// module.exports.orderAssignment = orderAssignment;


