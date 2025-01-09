const mongoose = require("mongoose");
const { Driver } = require("../models/driver");
const { Order } = require("../models/order");
const { PayoutEntry } = require("../models/payoutEntry");

async function pendingToUnassigned() {
  let currentTime = Math.round(new Date() / 1000);
  let orders = await Order.updateMany(
    { orderStatus: "PENDING", deliveryTime: { $lte: currentTime } },
    { $set: { orderStatus: "UNASSIGNED" } }
  );
}
async function verifyRefund() {
  let ordersToVerify = await Order.find({ isRefundToVerified: true });
  let verifiedRefundIds = [];
  for (i = 0; i < ordersToVerify.length; i++) {
    let response = await getRefundById(ordersToVerify[i].refundId);

    if (response.status == "completed-mpgs") {
      verifiedRefundIds.push(ordersToVerify[i]._id);
    }
  }
  await Order.updateMany({ _id: { $in: verifiedRefundIds } }, { $set: { isRefundToVerified: false } });
}
async function verifyRetryPayout() {
  let payoutsToVerify = await PayoutEntry.find({ status: "retried" });

  for (i = 0; i < payoutsToVerify.length; i++) {
    let response = await retryPayoutVerify(payoutsToVerify[i].transferId);
    let indexToCheck = response.data.data.length - 1;
    console.log("indexToCheck", response.data.data[indexToCheck]);
    if (response.data.data[indexToCheck].status == "FAILED") {
      await PayoutEntry.updateOne({ transferId: payoutsToVerify[i].transferId }, { $set: { status: "failure" } });
    } else if (
      response.data.data[indexToCheck].status == "NEW" ||
      response.data.data[indexToCheck].status == "pending"
    ) {
      //nothing to do
    } else {
      await PayoutEntry.updateOne({ transferId: payoutsToVerify[i].transferId }, { $set: { status: "success" } });
    }
  }
}

async function freezeTheDriver() {
  let criteria = {};
  let criteria1 = {};
  // criteria.paymentType = "POD";
  // criteria.orderStatus = "DELIVERED";
  criteria.type = "codByDriver";
  criteria.status = "pending";

  // criteria.isOrderAmtPaidToAdmin = false;
  // criteria.codReceived = true;
  let currentTime = Math.round(new Date() / 1000);
  let twoDaysBackTime = currentTime - 2 * 24 * 60 * 60;
  criteria1.insertDate = { $lte: twoDaysBackTime };

  // criteria1.deliveredAt = { $lte: twoDaysBackTime };

  let drivers = await PayoutEntry.aggregate([
    {
      $match: criteria
    },
    { $sort: { insertDate: 1 } },

    {
      $group: { _id: "$userDetails.userId", insertDate: { $first: "$insertDate" } }
    },
    {
      $match: criteria1
    },
    {
      $lookup: {
        from: "drivers",
        let: { driverId: { $toObjectId: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$driverId"] }, { $eq: ["$isFreezed", false] }]
              }
            }
          }
        ],
        as: "driverData"
      }
    },
    {
      $project: {
        needToFreeze: { $anyElementTrue: ["$driverData"] },
        driverId: "$_id",
        _id: 0
      }
    },
    { $match: { needToFreeze: true } }
  ]);
  console.log("drivers123", drivers);
  let driverList = [];
  for (driver of drivers) {
    driverList.push(mongoose.Types.ObjectId(driver.driverId));
  }
  await Driver.updateMany(
    { _id: { $in: driverList }, freezeDriverAt: { $lte: currentTime } },
    { $set: { isFreezed: true } }
  );

  // await Driver.updateMany({ freezeDriverAt: { $lte: currentTime, $ne: 0 } }, { $set: { isFreezed: true } });
}
module.exports.pendingToUnassigned = pendingToUnassigned;
module.exports.freezeTheDriver = freezeTheDriver;
module.exports.verifyRefund = verifyRefund;
module.exports.verifyRetryPayout = verifyRetryPayout;
