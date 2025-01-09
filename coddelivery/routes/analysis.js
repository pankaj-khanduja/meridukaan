const { Order } = require("../models/order.js");
const { Influencer } = require("../models/influencer.js");

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const config = require("config");
const { identityManager } = require("../middleware/auth");
const { formatter } = require("../services/commonFunctions");

router.get("/totalInfluencerShare", identityManager(["vendor", "admin"], { audit: "W" }), async (req, res) => {
  var criteria = {};
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  //   if (req.query.id) criteria._id = mongoose.Types.ObjectId(req.query.id);
  criteria.couponType = "influencerCode";
  let orders = await Order.aggregate([
    {
      $match: criteria,
    },
    {
      $facet: {
        allInfluencerTotalShare: [
          {
            $group: {
              _id: null,
              totalShare: { $sum: "$influencerAmount" },
            },
          },
        ],
        perInfluencerTotalShare: [
          {
            $group: {
              _id: "$influencerId",
              totalShare: { $sum: "$influencerAmount" },
            },
          },

          //   {
          //     $lookup: {},
          //   },
        ],
        totalDiscountToUser: [
          {
            $addFields: {
              discount: {
                $cond: [{ $ne: ["$vendorCategory", "pickUpAndDrop"] }, "$details.cartDiscount", "$details.discount"],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalShare: { $sum: "$discount" },
            },
          },
        ],
        // details: [
        //   {
        //     $project: {
        //       influencerAmount: 1,
        //       couponType: 1,
        //       details: 1,
        //     },
        //   },
        // ],
        // codDetails: [
        //   { $match: criteria },

        //   {
        //     $group: {
        //       _id: null,
        //       totalDriverAmount: { $sum: "$driverAmount" },
        //       // driverToAdminAmt: { $first: { $arrayElemAt: ["$driverData.driverToAdminAmt", 0] } },

        //       // totalTipCharges: { $sum: "$deliveryTip" },

        //       // totalDriverAmount:{$sum:["$totalSaleAmount","$totalTipAmount"]}
        //     },
        //   },
        // ],
      },
    },
    // {
    //   $project: {
    //     influencerAmount: 1,
    //     couponType: 1,
    //   },
    // },
  ]);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { orders } });
});

module.exports = router;
