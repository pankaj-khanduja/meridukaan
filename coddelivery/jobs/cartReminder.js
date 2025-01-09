const { Cart, CartItem } = require("../models/cart");
const { User } = require("../models/user");
const { sendMultipleFCM } = require("../services/fcmModule");

async function cartReminder() {
  let currentEpoch = Math.round(new Date() / 1000);
  let thirtyMinBefore = currentEpoch - 30 * 60;
  let thirtyFiveMinBefore = currentEpoch - 35 * 60;
  let criteria = {};
  criteria.insertDate = { $gte: thirtyMinBefore, $lte: thirtyFiveMinBefore };
  let cartItems = await CartItem.aggregate([
    {
      $match: criteria,
    },
    {
      $group: { _id: "$cartId" },
    },
    {
      $lookup: {
        from: "carts",
        let: { cartId: { $toObjectId: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$cartId"] }, { $eq: ["$sendCartNotification", true] }],
              },
            },
          },
        ],
        as: "cartData",
      },
    },

    {
      $addFields: {
        userId: {
          $cond: [{ $ne: [{ $arrayElemAt: ["$cartData.userId", 0] }, null] }, { $toObjectId: { $arrayElemAt: ["$cartData.userId", 0] } }, "$userId"],
        },
      },
    },
    {
      $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "userData" },
    },

    {
      $project: {
        deviceToken: {
          $cond: [{ $ne: [{ $size: "$userData" }, 0] }, { $arrayElemAt: ["$userData.deviceToken", 0] }, { $arrayElemAt: ["$cartData.deviceToken", 0] }],
        },
        cartId: "$_id",
        _id: 0,
      },
    },
    { $match: { deviceToken: { $ne: null } } },
  ]);

  let deviceTokens = [];
  for (item of cartItems) {
    deviceTokens.push(item.deviceToken);
    await Cart.updateOne({ _id: item.cartId }, { $set: { sendCartNotification: false } });
  }
  let data = {
    type: "cartReminder",
  };
  if (deviceTokens.length > 0) {
    await sendMultipleFCM(deviceTokens, data, "cartReminder");
  }
}

module.exports.cartReminder = cartReminder;
