const express = require("express");
const config = require("config");
const mongoose = require("mongoose");
const { Cart, CartItem, validateCreateCart, validateClearCart, validateAddItem, validateRemoveItem, validateViewCart } = require("../models/cart");
const { createTransaction, chargeWithToken } = require("../services/flutterWave");
const { Order, vendorAdminShare, validatePlaceOrder, reorder, validateReorder, isDriverAvailable } = require("../models/order");
const { FeeAndLimit, feeLimitLookUp } = require("../models/feeAndLimit");
const { Redemption } = require("../models/redemption.js");
const { Card } = require("../models/card");
const { sendFCM } = require("../services/fcmModule");
const { sendTemplateEmail } = require("../services/amazonSes");
const { isPickUpPossible } = require("../models/serviceArea");
const { slotLookUp, vendorFareAggregate } = require("../models/vendor");
const { Topping, Product } = require("../models/product");
const {
  CART_CONSTANTS,
  PRODUCT_CONSTANTS,
  COUPON_CONSTANTS,
  VENDOR_CONSTANTS,
  PAYMENT_CONSTANTS,
  OTHER_CONSTANTS,
  REFERRAl_CONSTANTS,
  CARD_CONSTANTS,
} = require("../config/constant.js");
const { Variant } = require("../models/product");
const { Store, Vendor } = require("../models/vendor");
const { calculateTax, deliveryCharges, calculateDiscount } = require("../services/cartCharges");
const _ = require("lodash");
const { User } = require("../models/user");
const { identityManager } = require("../middleware/auth");
// const { Order, vendorAdminShare } = require("../models/order");
const { Coupon } = require("../models/coupon");
const { Referral } = require("../models/referral");
const { OrderNo } = require("../models/orderNo");
const { Influencer } = require("../models/influencer");
const { PaymentLog } = require("../models/paymentLogs");
const { createPaymentLink } = require("../services/razorPayFunctions");
const router = express.Router();
mongoose.set("debug", true);

router.post("/", identityManager(["user", "storeManager", "public"]), async (req, res) => {
  var { error } = validateCreateCart(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let cart;
  let userId;

  cart = await Cart.findOne({ deviceToken: req.body.deviceToken });

  if (cart) {
    return res.send({
      statusCode: 200,
      message: "Success",
      data: { cart, message: CART_CONSTANTS.CART_EXISTED },
    });
  }
  if (req.jwtData.role == "user") {
    userId = req.jwtData.userId;
    cart = await new Cart({});
    cart.userId = userId;
    await cart.save();
    return res.send({
      statusCode: 200,
      message: "Success",
      data: { cart, message: CART_CONSTANTS.CART_CREATED },
    });
  } else {
    cart = await new Cart({ deviceToken: req.body.deviceToken });

    await cart.save();
    return res.send({
      statusCode: 200,
      message: "Success",
      data: { cart, message: CART_CONSTANTS.CART_CREATED },
    });
  }
});

router.get("/", identityManager(["user", "public"]), async (req, res) => {
  var { error } = validateViewCart(req.query);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  // let cart = await Cart.findOne({ userId: req.jwtData.userId });
  let cart;

  let criteria = {};
  let criteria1 = {};
  console.log("req.jwtData.role", req.jwtData.role);
  if (req.jwtData.role == "user") {
    criteria.userId = req.jwtData.userId;
    cart = await Cart.findOne({ userId: req.jwtData.userId });
  } else if (req.jwtData.role == "public") {
    if (!req.query.deviceToken) {
      return res.send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: CART_CONSTANTS.DEVICE_TOKEN },
      });
    }
    if (req.query.deviceToken && req.query.deviceToken != "") criteria.deviceToken = req.query.deviceToken;
    cart = await Cart.findOne({ deviceToken: req.query.deviceToken });
  }
  if (!cart) {
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CART_CONSTANTS.CART_NOT_FOUND },
    });
  }
  criteria._id = mongoose.Types.ObjectId(cart._id);
  if (req.query.isDeleted) criteria1.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria1 = { $expr: { $eq: ["$isDeleted", false] } };

  let cartList = await Cart.aggregate([
    { $match: criteria },
    { $addFields: { cartId: "$_id", vendorId: { $toObjectId: "$vendorId" } } },

    {
      $lookup: {
        from: "cartitems",
        let: { cartId: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$cartId", "$$cartId"] } } },
          {
            $addFields: {
              productId: { $toObjectId: "$items.productId" },
            },
          },
          { $addFields: { cartId: "$_id" } },
          // { $lookup: { from: "variants", localField: "variantId", foreignField: "_id", as: "variantData" } },
          // { $addFields: { isDeleted: { $arrayElemAt: ["$variantData.isDeleted", 0] } } },
          // { $match: criteria1 },

          { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "productData" } },

          {
            $addFields: {
              productPrice: { $arrayElemAt: ["$productData.price", 0] },
              productWeight: { $arrayElemAt: ["$productData.weight", 0] },
              productUnit: { $arrayElemAt: ["$productData.unit", 0] },
              subtypeTotal: "$items.subtypesTotal",
              cartItemId: "$_id",
              itemTotalPrice: "$totalPrice",
              uniqueItemId: "$uniqueItemId",
              subtypes: "$items.subtypes",
              productCoverImage: { $arrayElemAt: ["$productData.coverImage", 0] },
              productTitle: { $arrayElemAt: ["$productData.title", 0] },
              productCategory: { $arrayElemAt: ["$productData.category", 0] },
              productSubCategory: { $arrayElemAt: ["$productData.subCategory", 0] },
              calories: { $arrayElemAt: ["$productData.calories", 0] },
              quantityType: { $arrayElemAt: ["$productData.quantityType", 0] },

            },
          },
          {
            $addFields: {
              productCoverImage: { $arrayElemAt: ["$productData.coverImage", 0] },
              productTitle: { $arrayElemAt: ["$productData.title", 0] },
              //     stock: { $arrayElemAt: ["$variantData.stock", 0] },
              productCategory: { $arrayElemAt: ["$productData.category", 0] },
              productSubCategory: { $arrayElemAt: ["$productData.subCategory", 0] },
              calories: { $arrayElemAt: ["$productData.calories", 0] },
              quantityType: { $arrayElemAt: ["$productData.quantityType", 0] },
              //     storeId: { $arrayElemAt: ["$productData.storeId", 0] },
            },
          },
        ],
        as: "cartItems",
      },
    },
    // {$addFields:{storeId:{$toObjectId:{$arrayElemAt:["$cartItems.productData.storeId",0]}}}},
    // {$addFields:{storeId:{$arrayElemAt:["$cartItems.productData.storeId",0]}}},
    // {$addFields:{testTotal:{$sum:"cartItems.testTotal"}}},
    // {$lookup:{from:"stores", localField:""}}
    {
      $lookup: {
        from: "referrals",
        let: { userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", "active"] }],
              },
            },
          },
        ],
        as: "referralData",
      },
    },


    {
      $lookup: {
        from: "referrals",
        let: { userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$referredBy", "$$userId"] }, { $eq: ["$referredByStatus", "active"] }],
              },
            },
          },
        ],
        as: "referralReferredByData",
      },
    },

    // {
    //   $addFields: {
    //     isReferralDataEmpty: { $eq: [{ $size: "$referralData" }, 0] }
    //   }
    // },


    {
      $addFields: {
        referralData: { $ifNull: ["$referralData", []] },
        isReferralDataEmpty: { $eq: [{ $size: "$referralData" }, 0] }
      }
    },
    {
      $addFields: {
        referralCount: {
          $cond: {
            if: { $eq: ["$isReferralDataEmpty", true] },
            then: { $size: { $ifNull: ["$referralReferredByData", []] } },
            else: { $size: "$referralData" }
          }
        }
      }
    },


    { $lookup: { from: "vendors", localField: "vendorId", foreignField: "_id", as: "vendorData" } },
    { $addFields: { cityId: { $arrayElemAt: ["$vendorData.cityId", 0] } } },
    {
      $lookup: feeLimitLookUp("$cityId"),
    },
    // {
    //   $lookup: {
    //     from: "feeandlimits",
    //     let: { cityId: { $toObjectId: { $arrayElemAt: ["$vendorData.cityId", 0] } } },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
    //           },
    //         },
    //       },
    //     ],
    //     as: "fareData",
    //   },
    // },

    {
      $project: {
        subTotal: 1,
        cartDiscount: 1,
        cartId: 1,
        userId: 1,
        vendorId: 1,
        couponCode: 1,
        couponId: 1,
        referralDiscount: 1,
        // cartItems: 1,
        // referralCount: {
        //   $cond: {
        //     if: { $eq: ["$isReferralDataEmpty", true] },
        //     then: { $size: "$additionalData" },
        //     else: { $size: "$referralData" }
        //   }
        // },

        referralCount: 1,
        "cartItems.isDeleted": 1,
        // "cartItems.productPrice": { $arrayElemAt: ["$cartItems.items.productPrice", 0] },
        // "cartItems.subtypesTotal": { $arrayElemAt: ["$cartItems.items.subtypesTotal", 0] },
        // "cartItems.subtypes": { $arrayElemAt: ["$cartItems.items.subtypes", 1] },
        // "cartItems.uniqueItemId": { $arrayElemAt: ["$cartItems.items.uniqueItemId", 0] },
        // "cartItems.productId": { $arrayElemAt: ["$cartItems.items.productId", 0] },
        // "cartItems.cartItemId": { $arrayElemAt: ["$cartItems._id", 0] },
        //

        "cartItems.totalPrice": 1,
        "cartItems.quantityType": 1,
        "cartItems.productPrice": 1,
        "cartItems.productWeight": 1,
        "cartItems.productUnit": 1,
        "cartItems.productId": 1,
        "cartItems.cartItemId": 1,

        "cartItems.itemSubtypeTotal": 1,
        "cartItems.subtypes": 1,
        "cartItems.uniqueItemId": 1,
        "cartItems.quantity": 1,
        "cartItems.productTitle": 1,
        // "cartItems.storeId": 1,

        "cartItems.productSubCategory": 1,
        "cartItems.calories": 1,
        "cartItems.productCategory": 1,
        //  "cartItems.testTotal":1,
        "cartItems.productCoverImage": 1,
        "cartItems.weight": 1,
        "cartItems.unit": 1,
        // "cartItems.items.weight": 1,
        // "cartItems.items.unit": 1,
        // "cartItems.items.price": 1,
        _id: 0,
        vendorDetails: {
          name: { $arrayElemAt: ["$vendorData.name", 0] },
          vendorId: { $arrayElemAt: ["$vendorData._id", 0] },
          profilePic: { $arrayElemAt: ["$vendorData.profilePic", 0] },
          location: { $arrayElemAt: ["$vendorData.location", 0] },
          address: { $arrayElemAt: ["$vendorData.address", 0] },
          deliveryTime: { $arrayElemAt: ["$vendorData.deliveryTime", 0] },
          packagingCharges: { $arrayElemAt: ["$vendorData.packagingCharges", 0] },
          // vatCharge: { $arrayElemAt: ["$vendorData.vatCharge", 0] },
          minimumOrderAmount: { $arrayElemAt: ["$vendorData.minimumOrderAmount", 0] },
        },
        chargeDetails: {
          serviceCharge: {
            $cond: [
              { $ne: [{ $arrayElemAt: ["$vendorData.isDefaultTaxes", 0] }, false] },
              { $arrayElemAt: ["$fareData.serviceCharge", 0] },
              { $arrayElemAt: ["$vendorData.serviceCharge", 0] },
            ],
          },
          serviceTax: {
            $cond: [
              { $ne: [{ $arrayElemAt: ["$vendorData.isDefaultTaxes", 0] }, false] },
              { $arrayElemAt: ["$fareData.serviceTax", 0] },
              { $arrayElemAt: ["$vendorData.serviceTax", 0] },
            ],
          },
          vatCharge: {
            $cond: [
              { $ne: [{ $arrayElemAt: ["$vendorData.isDefaultTaxes", 0] }, false] },
              { $arrayElemAt: ["$fareData.vatCharge", 0] },
              { $arrayElemAt: ["$vendorData.vatCharge", 0] },
            ],
          },
        },
        maxOrderAmtForCod: { $arrayElemAt: ["$fareData.maxOrderAmtForCod", 0] },
        driverPlatformFeePercent: { $arrayElemAt: ["$fareData.driverPlatformFeePercent", 0] },
        platformFees: { $arrayElemAt: ["$fareData.platformFees", 0] },
      },
    },
  ]);

  console.log("cartttt", cart);
  let cartSubtotal = await CartItem.aggregate([
    {
      $facet: {
        // items: [{ $match: { cartId: cart._id.toString() } }],
        totalPrice: [{ $match: { cartId: cart._id.toString() } }, { $group: { _id: "$cartId", total: { $sum: "$totalPrice" } } }],
      },
    },
  ]);
  if (cartSubtotal[0].totalPrice[0]) {
    console.log("cartSubtotal", cartSubtotal[0]);
    cart.subTotal = cartSubtotal[0].totalPrice[0].total;
  }

  let discountValue = 0;
  if (cart.couponId != "") {
    let coupon = await Coupon.findOne({ _id: cart.couponId });
    if (coupon) {
      discountValue = calculateDiscount(cart.subTotal, coupon.couponType, coupon.value, coupon.maxDiscountPrice);
    }
  }

  cart.cartDiscount = discountValue;

  // cart.subTotal = cartItems[0].totalPrice[0].total;
  console.log("cart.cartDiscount :", cart.cartDiscount);
  let amount;
  let cartCharges = {};
  let deliveryCharge;
  let data = {};
  if (cartList[0] && cart.vendorId) {
    data = cartList[0];
    let location = {};
    location.lat1 = parseFloat(req.query.lat1);
    location.lon1 = parseFloat(req.query.lon1);
    let dCharge = await deliveryCharges(location, "normal", cart.vendorId);
    console.log("dCharge :", dCharge);
    if (!dCharge) {
      data.cartItems = [];
      return res.send({ apiId: req.apiId, statusCode: 200, status: "Success", data });
    }
    console.log("dCharge", dCharge);
    deliveryCharge = dCharge.deliveryCharges;
    cart.deliveryCharges = deliveryCharge;

    // if (data.vendorDetails) {
    amount = cart.subTotal - cart.cartDiscount - cartList[0].referralDiscount;
    if (amount > 0) {
      // let cartCharges


      cartCharges = calculateTax(amount, cartList[0].chargeDetails);

      cartCharges.platformFees = (cartList[0].platformFees * amount) / 100;
      // console.log(cartCharges, "platformFees");
      cartCharges.deliveryCharge = deliveryCharge;
      let location = {};
      location.lat1 = parseFloat(req.query.lat);
      location.lon1 = parseFloat(req.query.lng);
      cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount + cartCharges.platformFees;
      cart.totalAmount += cart.deliveryCharges;
      if (cartList[0].vendorDetails.packagingCharges) {
        cart.totalAmount += cartList[0].vendorDetails.packagingCharges;
      }
    } else {
      // let cartCharges = {}

      cartCharges.serviceCharge = 0;
      cartCharges.serviceTax = 0;
      cartCharges.vatCharge = 0;
      cartCharges.platformFee = 0;
      console.log("cartList[0].totalAmount", cartList[0].totalAmount);
      cartList[0].totalAmount = 0 + deliveryCharge;
      if (cartList[0].vendorDetails.packagingCharges) {
        cartList[0].totalAmount += cartList[0].vendorDetails.packagingCharges;
      }
      if (req.jwtData.role == "user") {
        criteria.userId = req.jwtData.userId;
      } else if (req.jwtData.role == "public") {
        if (req.query.deviceToken && req.query.deviceToken != "") criteria.deviceToken = req.query.deviceToken;
      }
      await Cart.updateOne(criteria, { $set: { totalAmount: cartList[0].totalAmount } });
    }
    // if (cartList[0].vendorDetails.packagingCharges) {
    //   cart.totalAmount += cartList[0].vendorDetails.packagingCharges;
    // }
    // }
    //  else {
    //   console.log("cart length 0000000000")
    //   data.subTotal = 0
    //   data.deliveryCharges = 0
    //   cartCharges.serviceCharge = 0
    //   cartCharges.serviceTax = 0
    //   cartCharges.vatCharge = 0
    // }

    console.log("data.vendorId", data);
    cart.distance = dCharge.distance;
    // let platformFee = await FeeAndLimit.findOne({});
    await cart.save();
    let totalReferral = 0;
    if (req.jwtData.role === "user") {
      totalReferral = req.userData.totalReferral;
    }
    data.cartCharges = cartCharges;
    data.totalAmount = cart.totalAmount;
    data.subTotal = cart.subTotal;
    data.deliveryCharge = deliveryCharge;
    data.maxOrderAmtForCod = data.maxOrderAmtForCod;
    data.driverPlatformFeePercent = data.driverPlatformFeePercent;
    data.packagingCharges = cartList[0].vendorDetails.packagingCharges;
    data.referralDiscount = data.referralDiscount;
    data.cartDiscount = data.cartDiscount;
    data.couponId = data.couponId;
    data.couponCode = data.couponCode;
    data.totalReferral = totalReferral;
    data.distance = dCharge.distance;
  } else {
    data.cartItems = [];
  }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    status: "Success",
    data,
  });
});

//add a  item into cart
router.put("/addItem", identityManager(["user", "public"]), async (req, res) => {
  var { error } = validateAddItem(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  var cart = await Cart.findById(req.body.cartId);
  if (!cart)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CART_CONSTANTS.NOT_FOUND },
    });
  let vendor = await vendorFareAggregate(req.body.vendorId);
  if (!vendor) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.VENDOR_NOT_FOUND },
    });
  }
  if (vendor.status != "active") {
    await CartItem.deleteMany({ cartId: req.body.cartId });
    await Cart.updateOne(
      { _id: req.body.cartId },
      {
        $set: {
          subTotal: 0,
          totalAmount: 0,
          referralDiscount: 0,
          cartDiscount: 0,
          couponId: "",
          couponCode: "",
          totalItems: 0,
          sendCartNotification: false,
        },
      }
    );
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.NOT_AVAILABLE },
    });
  }

  cart.vendorId = req.body.vendorId;

  let product = await Product.findOne({ _id: req.body.productId, isDeleted: false }).lean();
  if (!product) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PRODUCT_CONSTANTS.NOT_FOUND },
    });
  }
  // product.variantId = req.body.variantId
  let itemsArray = [];
  let subtypesTotal = 0;
  for (subtype of req.body.subtypes) {
    let topping = await Topping.findOne({ _id: subtype.toppingId });
    subtypesTotal += subtype.price;
    itemsArray.push(subtype.toppingId, subtype.subtypeId);
  }

  let uniqueItemId = "";
  if (itemsArray.length > 0) {
    uniqueItemId = itemsArray.sort().join(".");
  }
  console.log("uniqueItemId", uniqueItemId);
  let addItem = await CartItem.findOne({
    $and: [{ cartId: req.body.cartId }, { "items.productId": req.body.productId }, { "items.uniqueItemId": uniqueItemId }],
  });
  console.log("jhsfhdsdgdsg", addItem);
  if (!addItem) {
    addItem = new CartItem({
      cartId: req.body.cartId,
    });
    addItem.items.uniqueItemId = uniqueItemId;
    addItem.items.productId = req.body.productId;
    addItem.items.subtypes = req.body.subtypes;
    addItem.items.productPrice = product.price;
    addItem.items.productWeight = product.weight;
    addItem.items.productUnit = product.unit;
    addItem.items.subtypesTotal = subtypesTotal;
    // addItem.items.variantId = req.body.variantId;
    addItem.quantity += req.body.quantity;

    addItem.totalPrice = addItem.quantity * (product.price + subtypesTotal);
  } else {
    addItem.quantity += req.body.quantity;
    addItem.productPrice = product.price;
    addItem.subtypesTotal = subtypesTotal;
    addItem.totalPrice = addItem.quantity * (product.price + subtypesTotal);
    let currentTime = Math.round(new Date() / 1000);
    addItem.insertDate = currentTime;
  }
  let item = await CartItem.findOne({ cartId: req.body.cartId });
  if (!item) {
    cart.sendCartNotification = true;
  }
  await addItem.save();
  // let subTotal = await CartItem.aggregate([
  //   {
  //     $group: {
  //       _id: req.body.cartId,
  //       total: {
  //         $sum: "$totalPrice",
  //       },
  //     },
  //   },
  // ]);
  let cartItems = await CartItem.aggregate([
    {
      $facet: {
        items: [{ $match: { cartId: addItem.cartId } }],
        totalPrice: [{ $match: { cartId: addItem.cartId } }, { $group: { _id: "$cartId", total: { $sum: "$totalPrice" } } }],
      },
    },
  ]);
  cart.subTotal = cartItems[0].totalPrice[0].total;

  let discountValue;
  // console.log("mmmmmm", cart, cart.couponId);
  if (cart.couponId && cart.couponId != "") {
    let coupon = await Coupon.findOne({ _id: cart.couponId });
    if (coupon) {
      // if (coupon.couponType == "fixed") {
      //   discountValue = coupon.value;
      // } else if (coupon.couponType == "percentage") {
      //   discountValue = (cart.subTotal * coupon.value) / 100;
      // }
      // console.log("check subTotal :", cart.subTotal);
      discountValue = calculateDiscount(cart.subTotal, coupon.couponType, coupon.value, coupon.maxDiscountPrice);
    }
    cart.cartDiscount = discountValue;
  }
  // await cart.save();

  let amount;
  let cartCharges = {};

  let deliveryCharge;
  // console.log("cartCharges", cartCharges);
  // let store = await Store.findOne({_id:})
  let data = {};
  // if (cart.length > 0) {
  // data = cart[0]
  // amount = cart[0].subTotal - cart[0].cartDiscount
  let location = {};
  location.lat1 = parseFloat(req.body.lat1);
  location.lon1 = parseFloat(req.body.lon1);
  // location.lat2 = parseFloat(req.query.lat2);
  // location.lon2 = parseFloat(req.query.lon2);
  // deliveryCharge = dCharge.deliveryCharges;

  let chargeDetails = {
    serviceTax: vendor.serviceTax,
    serviceCharge: vendor.serviceCharge,
    vatCharge: vendor.vatCharge,
  };
  amount = cart.subTotal - cart.cartDiscount - cart.referralDiscount;

  if (amount > 0) {
    // let cartCharges

    cartCharges = calculateTax(amount, chargeDetails);
    // console.log(vendor, "cartCharges");
    cartCharges.platformFees = (vendor.platformFees * amount) / 100;
    // console.log(cartCharges, "platformFees");

    cartCharges.deliveryCharge = deliveryCharge;
    let location = {};
    location.lat1 = parseFloat(req.query.lat);
    location.lon1 = parseFloat(req.query.lng);
    // cartList[0].totalAmount +=
    //
    cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount + cartCharges.platformFees;
    cart.totalAmount += cart.deliveryCharges;
  } else {
    // let cartCharges = {}

    cartCharges.serviceCharge = 0;
    cartCharges.serviceTax = 0;
    cartCharges.platformFees = 0;
    cartCharges.vatCharge = 0;
    cart.totalAmount = 0 + cart.deliveryCharges;
  }
  let response = {};

  if (vendor.packagingCharges) {
    cart.totalAmount += vendor.packagingCharges;
    response.packagingCharges = vendor.packagingCharges;
  }
  // let location = {}
  // location.lat1 = parseFloat(req.query.lat)
  // location.lon1 = parseFloat(req.query.lng)
  // } else {
  //   data.subTotal = 0
  //   data.deliveryCharges = 0
  //   cartCharges.serviceCharge = 0
  //   cartCharges.serviceTax = 0
  //   cartCharges.vatCharge = 0
  // }
  cartCharges.deliveryCharge = cart.deliveryCharges;

  await cart.save();
  let totalItemCount = await CartItem.countDocuments({ cartId: req.body.cartId });
  response.subTotal = cart.subTotal;
  response.cartDiscount = cart.cartDiscount;
  response.couponId = cart.couponId;
  response.couponCode = cart.couponCode;
  response.deliveryCharge = cart.deliveryCharges;
  response.referralDiscount = cart.referralDiscount;
  response.vendorId = cart.vendorId;
  response.productId = addItem.items.productId;
  response.totalAmount = cart.totalAmount;
  response.itemTotalPrice = addItem.totalPrice;
  response.itemQuantity = addItem.quantity;
  response.cartItemId = addItem._id;
  response.cartId = addItem.cartId;
  response.totalItemCount = totalItemCount;
  response.cartCharges = cartCharges;
  // response.tax = calculateTax(response.subTotal)
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: CART_CONSTANTS.ITEM_ADDED, response },
  });
});

router.put("/clearCart", async (req, res) => {
  // let totalItemCount = await CartItem.countDocuments({ cartId: req.query.cartId, "items.isDeleted": false });
  var { error } = validateClearCart(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let cart = await Cart.findOne({ _id: req.body.cartId });
  if (!cart) {
    return res.status(200).send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: CART_CONSTANTS.CART_CLEARED },
    });
  }
  cart.subTotal = 0;
  cart.totalAmount = 0;
  cart.cartDiscount = 0;
  cart.referralDiscount = 0;
  cart.couponCode = "";
  cart.couponId = "";
  cart.deliveryCharges = 0;
  cart.sendCartNotification = false;

  await CartItem.deleteMany({ cartId: req.body.cartId });
  await cart.save();
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: CART_CONSTANTS.CART_CLEARED },
  });
});

router.get("/itemCount", async (req, res) => {
  var { error } = validateClearCart(req.query);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let criteria = {};
  let criteria1 = {};

  criteria.cartId = req.query.cartId;
  criteria1.isDeleted = false;
  // let totalItemCount = await CartItem.countDocuments({ cartId: req.query.cartId, "items.isDeleted": false });
  let items = await CartItem.aggregate([
    { $match: criteria },

    // { $addFields: { variantId: { $toObjectId: "$items.variantId" } } },
    // { $lookup: { from: "variants", localField: "variantId", foreignField: "_id", as: "variantData" } },
    // { $addFields: { isDeleted: { $arrayElemAt: ["$variantData.isDeleted", 0] } } },
    // { $match: criteria1 },
  ]);

  let response = {};
  response.totalItemCount = items.length;
  let cart = await Cart.findOne({ _id: req.query.cartId }).lean();
  if (!cart) {
    response.vendorId = "";
    response.subTotal = 0;
  } else {
    response.vendorId = cart.vendorId || "";
    response.subTotal = cart.subTotal || 0;
  }

  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

//remove a item from cart
router.put("/removeItem", identityManager(["user", "public"]), async (req, res) => {
  var { error } = validateRemoveItem(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  var cart = await Cart.findOne({ _id: req.body.cartId });

  if (!cart)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CART_CONSTANTS.NOT_FOUND },
    });
  cart.vendorId = req.body.vendorId || cart.vendorId;

  // let removedItem = await CartItem.findOne({
  //   $and: [{ cartId: req.body.cartId }, { "items.variantId": req.body.variantId }],
  // })

  let removedItem = await CartItem.findOne({ _id: req.body.cartItemId });
  if (removedItem) {
    if (req.body.isDeleteItem === true) {
      removedItem.quantity = 0;
      removedItem.totalPrice = 0;
      await CartItem.deleteOne({
        _id: req.body.cartItemId,
      });
    } else {
      let quantity = removedItem.quantity;

      if (quantity > 0) {
        quantity = quantity - 1;
        removedItem.quantity = quantity;
        removedItem.totalPrice = quantity * (removedItem.items.subtypesTotal + removedItem.items.productPrice);
        await removedItem.save();
        if (removedItem.quantity === 0) {
          await CartItem.deleteOne({
            _id: req.body.cartItemId,
          });
        }
      }
    }

    let criteria = {};
    let cartId;
    if (req.body.cartId) {
      cartId = req.body.cartId;
      criteria.cartId = cartId;
    }
    let subTotal = await CartItem.aggregate([
      { $match: criteria },
      {
        $group: {
          _id: "$cartId",
          total: {
            $sum: "$totalPrice",
          },
        },
      },
    ]);
    let amount;
    let cartCharges = {};
    let location = {};
    location.lat1 = parseFloat(req.body.lat1);
    location.lon1 = parseFloat(req.body.lon1);
    // location.lat2 = parseFloat(req.query.lat2);
    // location.lon2 = parseFloat(req.query.lon2);
    // let deliveryCharge = dCharge.deliveryCharges;
    let discountValue = 0;
    let vendor;
    let response = {};
    console.log("!subTotal[0]", subTotal[0]);
    if (!subTotal[0]) {
      cart.subTotal = 0;
    } else {
      cart.subTotal = subTotal[0].total;

      if (cart.couponId && cart.couponId != "") {
        let coupon = await Coupon.findOne({ _id: cart.couponId });
        if (coupon && coupon.minOrderPrice <= cart.subTotal) {
          discountValue = calculateDiscount(cart.subTotal, coupon.couponType, coupon.value, coupon.maxDiscountPrice);

          cart.cartDiscount = discountValue;
          cart.couponCode = coupon.code;
          cart.couponId = req.body.couponId || cart.couponId;
        } else {
          cart.cartDiscount = 0;
          cart.couponCode = "";
          cart.couponId = "";
        }
      }

      // let store = await Store.findOne({_id:})
      // if (cart.length > 0) {
      // data = cart[0]
      // amount = cart[0].subTotal - cart[0].cartDiscount
      vendor = await vendorFareAggregate(req.body.vendorId);
      console.log("vendorD", vendor);
      let chargeDetails = {
        serviceTax: vendor.serviceTax,
        serviceCharge: vendor.serviceCharge,
        vatCharge: vendor.vatCharge,
      };
      amount = cart.subTotal - cart.cartDiscount - cart.referralDiscount;
      if (amount > 0) {
        // let cartCharges

        cartCharges = calculateTax(amount, chargeDetails);

        cartCharges.platformFees = (vendor.platformFees * amount) / 100;

        // console.log(cartCharges, "platformFees");

        cartCharges.deliveryCharge = cart.deliveryCharges;
        let location = {};
        location.lat1 = parseFloat(req.query.lat);
        location.lon1 = parseFloat(req.query.lng);
        // cartList[0].totalAmount +=
        //
        cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount - cart.referralDiscount + cartCharges.platformFees;
        cart.totalAmount += cart.deliveryCharges;
      } else {
        // let cartCharges = {}

        cartCharges.serviceCharge = 0;
        cartCharges.serviceTax = 0;
        cartCharges.vatCharge = 0;
        cartCharges.platformFees = 0;
        cart.totalAmount = 0 + cart.deliveryCharges;
      }
      if (vendor.packagingCharges) {
        cart.totalAmount += vendor.packagingCharges;
        response.packagingCharges = vendor.packagingCharges;
      }
      // let location = {}
      // location.lat1 = parseFloat(req.query.lat)
      // location.lon1 = parseFloat(req.query.lng)
      // } else {
      //   data.subTotal = 0
      //   data.deliveryCharges = 0
      //   cartCharges.serviceCharge = 0
      //   cartCharges.serviceTax = 0
      //   cartCharges.vatCharge = 0
      // }
      cartCharges.deliveryCharge = cart.deliveryCharges;
      // cart.totalAmount = cart.subTotal + cartCharges.serviceCharge + cartCharges.serviceTax + cartCharges.vatCharge - cart.cartDiscount;
      // cart.totalAmount += cart.deliveryCharges;
    }
    await cart.save();

    let totalItemCount = await CartItem.countDocuments({ cartId: req.body.cartId });

    // console.log(cart);
    // let subTotal = cart.subTotal
    // subTotal = subTotal - removedItem.totalPrice;
    // let response = {};
    response.subTotal = cart.subTotal;
    response.totalAmount = cart.totalAmount;
    response.vendorId = cart.vendorId;
    response.itemTotalPrice = removedItem.totalPrice;
    response.itemQuantity = removedItem.quantity;
    response.cartItemId = removedItem._id;
    response.cartId = removedItem.cartId;
    response.couponId = cart.couponId;
    response.deliveryCharge = cart.deliveryCharges;
    response.totalItemCount = totalItemCount;
    response.cartCharges = cartCharges;
    response.productId = removedItem.items.productId;
    response.cartDiscount = cart.cartDiscount;
    response.referralDiscount = cart.referralDiscount;
    // response.tax = calculateTax(response.subTotal)
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { message: CART_CONSTANTS.ITEM_REMOVED, response },
    });
  } else {
    // let removedItem = await CartItem.findOneAndRemove({ _id: req.body.id });

    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: "product already removed" },
    });
  }
});

router.get("/checkout", identityManager(["user"]), async (req, res) => {
  var criteria = {};
  let cartId;
  if (req.query.cartId) {
    cartId = req.query.cartId;
    criteria.cartId = cartId;
  }

  // let cartItems = await CartItem.find({ cartId: cartId });
  let data = await checkStock(cartId);
  if (data.length > 0) {
    return res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Failure",
      data: { data, message: "These products are out of stock now." },
    });
  } else {
    res.send({
      apiId: req.apiId,
      statusCode: 200,
      message: "Success",
      data: { data, message: "Products are in stock." },
    });
  }

  // console.log(cartItems);
});

router.post("/repeatOrder", identityManager(["user"]), async (req, res) => {
  const { error } = validateReorder(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let cartId = req.body.cartId;
  // let product = await Order.findOne({ _id: req.query.orderId });
  let cartItemArray = await reorder(req.body.orderId, req.body.cartId);
  console.log("cartItemArray", cartItemArray);
  if (cartItemArray.pushCartItems.length === 0) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CART_CONSTANTS.ITEM_UNAVAILABLE },
    });
  }
  await CartItem.deleteMany({ cartId: req.body.cartId });

  let cart = await Cart.findOne({ _id: req.body.cartId });
  console.log("cartIDddd", cartId, cart);
  await CartItem.insertMany(cartItemArray.pushCartItems);
  let cartItems = await CartItem.aggregate([
    {
      $facet: {
        items: [{ $match: { cartId: cartId } }],
        totalPrice: [{ $match: { cartId: cartId } }, { $group: { _id: "$cartId", total: { $sum: "$totalPrice" } } }],
      },
    },
  ]);
  console.log("cartItems[0].totalPrice[0].total", cartItems[0].totalPrice[0]);
  cart.subTotal = cartItems[0].totalPrice[0].total;
  cart.cartDiscount = 0;
  cart.totalAmount = 0;
  cart.referralDiscount = 0;
  cart.couponId = "";
  cart.couponCode = "";
  cart.vendorId = cartItemArray.vendorId;
  cart.totalItems = cartItemArray.length;
  cart.sendCartNotification = false;

  await cart.save();
  let message;
  if (cartItemArray.pushCartItems.length !== cartItemArray.length) {
    message = CART_CONSTANTS.SOMEITEMS_UNAVAIL;
  } else {
    message = CART_CONSTANTS.ITEMS_ADDED_CART;
  }
  res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { message } });
});

router.post("/placeOrder", identityManager(["user"]), async (req, res) => {
  const { error } = validatePlaceOrder(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  // let deliveryCharges = req.body.deliveryCharges || 0;
  // let taxes = req.body.taxes || 0;
  // let deliveryTip = req.body.deliveryTip || 0;
  // let deliveryAddress = req.body.address;
  // let deliveryTime = req.body.deliveryTime;
  let criteria = {};
  criteria._id = mongoose.Types.ObjectId(req.body.vendorId);

  let vendor = await Vendor.aggregate([
    {
      $match: criteria,
    },
    {
      $lookup: slotLookUp("$_id"),
    },
    {
      $lookup: feeLimitLookUp("$cityId"),
    },
    {
      $addFields: {
        platformFeePercentage: {
          $cond: [{ $ne: ["$isPlatformFee", false] }, { $arrayElemAt: ["$fareData.vendorPlatformFeePercent", 0] }, "$platformFeePercentage"],
        },
      },
    },
    {
      $project: {
        vendorName: "$name",
        vendorEmail: "$email",
        driverPlatformFeePercent: { $arrayElemAt: ["$fareData.driverPlatformFeePercent", 0] },
        platformFees: { $arrayElemAt: ["$fareData.platformFees", 0] },
        vendorLocation: "$location",
        cityId: 1,
        vendorAddress: "$address",
        vendorImage: "$profilePic",
        status: "$status",
        driverCount: 1,
        merchantCategory: "$merchantCategory",
        platformFee: "$platformFeePercentage",
        isVenderOpen: { $anyElementTrue: ["$scheduleData"] },
      },
    },
  ]);
  console.log("vendor", vendor);
  if (vendor.length == 0 || vendor[0].status != "active") {
    await CartItem.deleteMany({ cartId: req.body.cartId });
    await Cart.updateOne(
      { _id: req.body.cartId },
      {
        $set: {
          subTotal: 0,
          totalAmount: 0,
          referralDiscount: 0,
          cartDiscount: 0,
          distance: 0,
          deliveryCharges: 0,

          couponId: "",
          couponCode: "",
          totalItems: 0,
          sendCartNotification: false,
        },
      }
    );
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: VENDOR_CONSTANTS.NOT_AVAILABLE },
    });
  }

  // if (!vendor[0].isVenderOpen) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: VENDOR_CONSTANTS.CURRENTLY_CLOSED },
  //   });
  // }
  // let isDeliveryPoss = await isDriverAvailable(vendor[0].cityId, "store");

  // if (!isDeliveryPoss) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: OTHER_CONSTANTS.DELIVERY_NOT_POSSIBLE_ON_THIS_TIME },
  //   });
  // }

  let cartId = req.body.cartId;
  let productUpdated = await isProductUpdated(req.body.details.cartItems, req.body.cartId);
console.log(productUpdated,"productUpdatedproductUpdatedproductUpdatedproductUpdated==============")
  if (productUpdated) {
    console.log("heloooooo=============================")
    let isRefreshRequired;
    isRefreshRequired = true;
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PRODUCT_CONSTANTS.UNAVAILABLE, isRefreshRequired },
    });
  }
console.log("heloooooooooooooooooo======================================")
  let coupon;
  if (req.body.details.couponId && req.body.details.couponId != "") {
    coupon = await Coupon.findOne({ _id: req.body.details.couponId });
    if (!coupon) {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: COUPON_CONSTANTS.INVALID_COUPON },
      });
    }
    if (coupon && coupon.status === "expired") {
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: COUPON_CONSTANTS.EXPIRED_COUPON },
      });
    }
  }
  let userId;
  if (req.jwtData.role == "user") userId = req.jwtData.userId;
  let user = await User.findOne({ _id: userId });
  console.log(user,"usersrsrrererererree=================================")
  // user.address = req.body.address;
  let cart = await Cart.findOne({ userId: userId });
  if (!cart)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CART_CONSTANTS.CART_NOT_FOUND },
    });
  let referral;
  if (req.body.details.referralDiscount > 0) {
    referral = await Referral.findOne({ userId: userId, status: "active" });
    if (!referral) {
      referral = await Referral.findOne({ referredBy: userId, referredByStatus: "active" });
      if (!referral) { return res.status(400).send({ apiId: req.apiId, statusCode: 400, message: "Failure", data: { message: REFERRAl_CONSTANTS.NO_REFERRAL_AVAILABLE }, }); }
      referral.referredByStatus = "redeemed";
    }

  }
  req.body.details.distance = cart.distance;
  let order = new Order(
    _.pick(req.body, [
      "deliveryCharges",
      "deliveryInstructions",
      "vendorId",
      "name",
      "driverAmount",
      "mobile",
      "countryCode",
      "address",
      "deliveryTip",
      "deliveryTime",
      "deliveryAddress",
      "details",
      "paymentType",
      "taxes",
      "cartId",
      "taxesPercent",
      "cardToken",
      "cardDetails",
      "platformFees",
      "appType",
    ])
  );
  if (req.body.packagingCharges) {
    order.packagingCharges = req.body.packagingCharges;
  }
  let type = "";
  if (coupon) {
    type = coupon.type;
  }

  let shares = await vendorAdminShare(req.body.details.subTotal, vendor[0].platformFee, req.body.details.cartDiscount, req.body.details.referralDiscount, type);
  order.vendorAmount = shares.vendorShare + order.packagingCharges;
  order.adminSubtotalAmount = shares.adminShare;
  order.adminDeliveryAmount = req.body.deliveryCharges - req.body.driverAmount;
  order.initialWaiveShare = shares.initialWaiveShare + order.adminDeliveryAmount;

  order.platformFees = (vendor[0].platformFees * req.body.details.subTotal) / 100;

  // console.log(order.platformFees, vendor[0].platformFees, "detaks ");

  order.adminAmount = order.adminDeliveryAmount + order.adminSubtotalAmount + order.platformFees;
  order.vendorCommissionPercent = 100 - vendor[0].platformFee;
  order.driverCommissionPercent = 100 - vendor[0].driverPlatformFeePercent;
  order.isOrderAmtPaidToVendor = false;
  order.location.coordinates = req.body.location;
  if (coupon && coupon.type == "influencerCode") {
    order.influencerId = coupon.userId;
    order.isInfluencerSharePaid = false;
    let influencer = await Influencer.findOne({ _id: coupon.userId });
    if (influencer.paymentType == "fixed") {
      order.influencerAmount = influencer.paymentValue;
    } else {
      order.influencerAmount = order.initialWaiveShare * (influencer.paymentValue / 100); // add
    }
    order.influencerDetails.paymentType = influencer.paymentType;
    order.influencerDetails.paymentValue = influencer.paymentValue;

    order.adminAmount = order.adminDeliveryAmount + order.adminSubtotalAmount - order.influencerAmount;
  }

  if (req.body.details.couponId && req.body.details.couponId != "") {
    order.couponType = coupon.couponType;
  }
  console.log("vendor[0].merchantCategory;", vendor[0].merchantCategory);
  order.vendorName = vendor[0].vendorName;
  order.vendorLocation = vendor[0].vendorLocation;
  order.vendorImage = vendor[0].vendorImage;
  order.vendorAddress = vendor[0].vendorAddress;
  order.vendorCategory = vendor[0].merchantCategory;
  order.totalAmount = cart.totalAmount;
  if (vendor[0].driverCount && vendor[0].driverCount > 0) {
    order.vendorDriverCount = vendor[0].driverCount;
  }
  order.cartId = cartId;
  order.userId = userId;
  let result = await OrderNo.findOne();
  if(!result){
    result = await OrderNo.create({"orderNo" :0, "payoutNo" :0})
  }
  await OrderNo.updateOne({"_id" : result._id}, { $inc: { orderNo: 1 } }, { new: true });
  
  console.log(result);
  req.body.paymentType === "paidOnline" // changing variable to single constant value so that only payment link case should work
  if (req.body.paymentType === "POD") {
    order.orderStatus = "ACTIVE";
    order.isRefundPending = false;
    order.isOrderSeen = false;
    order.codAmountToPay = order.totalAmount;

    if (order.details.couponId != "") {
      await Coupon.updateOne({ _id: order.details.couponId }, { $inc: { redemptionCount: 1 } });
    }

    // let cartItem = await CartItem.find({ cartId: req.body.cartId })
    let data = {
      type: "orderPlaced",
      userName: req.userData.firstName + req.userData.firstName,
    };
    if (user && user.deviceToken != "") {
      await sendFCM(user.deviceToken, data, "orderPlaced");
    }
    await CartItem.deleteMany({ cartId: cart._id });
    cart.subTotal = 0;
    cart.cartDiscount = 0;
    cart.totalAmount = 0;
    cart.referralDiscount = 0;
    cart.distance = 0;
    cart.deliveryCharges = 0;
    cart.couponId = "";
    cart.couponCode = "";
    cart.sendCartNotification = false;

    await cart.save();

    await sendTemplateEmail(vendor[0].vendorEmail, {}, "vendorNewOrder");
    if (req.body.details.couponId && req.body.details.couponId != "") {
      let redemption = await Redemption.insertMany([{ userId: req.jwtData.userId, couponId: req.body.details.couponId }]);
    }
  } else if (req.body.paymentType === "card") {
    let card = await Card.findOne({ cardToken: req.body.cardToken });
    if (!card)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: CARD_CONSTANTS.INVALID_CARD },
      });
    // console.log("Amounttttt", order.totalAmount);s
    let chargeObject = {
      token: req.body.cardToken,
      narration: config.get("narration"),
      tx_ref: order._id.toString(),
      amount: order.totalAmount,
      currency: config.get("currency"),
      country: config.get("country"),
      email: card.email || config.get("dummyEmail"),
      phonenumber: user.mobile,
      first_name: card.nameOnCard || user.firstName,
      last_name: card.nameOnCard || user.lastName,
    };
    console.log("chargeObjectchargeObjectchargeObject", chargeObject);
    let response = await chargeWithToken(chargeObject);
    console.log("responsssseeee", response);
    if (response.statusCode !== 200)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
      });
    else {
      if (response.data.data.status != "successful")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
        });
      else {
        order.orderStatus = "ACTIVE";
        order.isOrderAmtPaidToAdmin = true;
        order.isOrderSeen = false;
        order.flutterwaveRef = response.data.data.flw_ref;
        order.flutterwaveId = response.data.data.id;
        order.cardId = card._id;
        order.cardDetails = response.data.data.card;
        let data = {
          type: "orderPlaced",
        };
        if (user && user.deviceToken != "") {
          await sendFCM(user.deviceToken, data, "orderPlaced");
        }
        await CartItem.deleteMany({ cartId: cart._id });
        if (order.details.couponId != "") {
          await Coupon.updateOne({ _id: order.details.couponId }, { $inc: { redemptionCount: 1 } });
        }
        if (req.body.details.couponId && req.body.details.couponId != "") {
          let redemption = await Redemption.insertMany([{ userId: req.jwtData.userId, couponId: req.body.details.couponId }]);
        }
        cart.subTotal = 0;
        cart.cartDiscount = 0;
        cart.totalAmount = 0;
        cart.referralDiscount = 0;
        cart.couponId = "";
        cart.couponCode = "";
        cart.sendCartNotification = false;
        cart.distance = 0;
        cart.deliveryCharges = 0;

        await cart.save();
        await sendTemplateEmail(vendor[0].vendorEmail, {}, "vendorNewOrder");
        console.log("responseeeeee", response.data);
      }
    }
  } else {
    let appType = "";
    if (req.body.appType && req.body.appType == "web") {
      appType = "web";
    } else {
      appType = "app";
    }
    // let chargeObject = {
    //   productinfo: 'produect',
    //   amount: order.totalAmount,
    //   name: user.firstName,
    //   phone: user.mobile,
    //   userId: req.jwtData.userId,
    //   orderId: order._id.toString(),
    //   appType: req.body.appType,
    //   email: user.email
    //   // payment_options: config.get("paymentOptions"),
    //   // meta: {
    //   //   consumer_id: user._id.toString(),
    //   //   consumer_mac: "92a3-912ba-1192a",
    //   //   redirectUrl: req.body.redirectUrl,
    //   // },
    //   // customer: {
    //   //   email: user.email || config.get("dummyEmail"),
    //   //   phonenumber: user.mobile,
    //   //   name: user.firstName + " " + user.lastName,
    //   // },
    //   // customizations: {
    //   //   title: order.vendorName,
    //   //   description: order.vendorName,
    //   //   logo: order.vendorImage,
    //   // }
    // };


    let chargeObject = {
      amount: Number(order.totalAmount.toFixed(2)),
      name: user.firstName,
      email: user.email,
      contact: user.mobile,
      orderId: order._id,
      orderNo: result.orderNo,
      callback_url: `${config.get("apiBaseURl")}/api/webhook/placeOrder/app?orderId=${encodeURIComponent(order._id.toString())}`,
    }

    console.log("chargeOBjeectttt", chargeObject);
    let response = await createPaymentLink(chargeObject);
    console.log("responseeeee", response);
    let paymentLog = new PaymentLog();
    paymentLog.userId = req.jwtData.userId;
    paymentLog.type = "createTransaction";
    paymentLog.paymentType = "placeOrder";
    if (response.statusCode !== 200) {

      paymentLog.data = response.data
      await paymentLog.save();
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
      });
    } else {
      if (response.message != "Success")
        return res.status(401).send({
          apiId: req.apiId,
          statusCode: 400,
          message: "Failure",
          data: { message: PAYMENT_CONSTANTS.PAYMENT_FAILED },
        });
      else {
        // order.paymentUrl = response.data.result.paymentLink;
        order.paymentUrl = response.data.short_url;
        order.orderPaymentId = response.data.id;

        paymentLog.data = response;
        await paymentLog.save();

        // if (user && user.deviceToken != "") {
        //   await sendFCM(user.deviceToken, data, "orderPlaced");
        // }
        // await CartItem.deleteMany({ cartId: cart._id });
        // if (order.details.couponId != "") {
        //   await Coupon.updateOne({ _id: order.details.couponId }, { $inc: { redemptionCount: 1 } });
        // }
        // if (req.body.details.couponId && req.body.details.couponId != "") {
        //   let redemption = await Redemption.insertMany([{ userId: req.jwtData.userId, couponId: req.body.details.couponId }]);
        // }
        // cart.subTotal = 0;
        // cart.cartDiscount = 0;
        // cart.totalAmount = 0;
        // cart.referralDiscount = 0;
        // cart.couponId = "";
        // cart.couponCode = "";
        // cart.sendCartNotification = false;
        // cart.distance = 0;
        // cart.deliveryCharges = 0;

        // await cart.save();
        // await sendTemplateEmail(vendor[0].vendorEmail, {}, "vendorNewOrder");
        // console.log("responseeeeee", response.data);

      }
    }
  }

  order.orderNo = result.orderNo;
  if (req.body.details.referralDiscount > 0) {
    order.referralId = referral._id.toString();

    if (order.paymentType !== "paidOnline") {
      // let referral = await Referral.findOne({_id:referral._id})
      console.log("referral.status = redeemed", referral);
      referral.status = "redeemed";
      await referral.save();

      if (referral.referredByStatus === "redeemed") {
        await User.updateOne({ _id: user._id }, { $inc: { totalReferral: -1 } })
      }

    }
  }
  order.email = req.userData.email;
  await order.save();
  // let data = {};
  // await sendTemplateEmail(vendor[0].vendorEmail, data, "vendorNewOrder");
  // if (req.body.details.couponId && req.body.details.couponId != "") {
  //   let redemption = await Redemption.insertMany([
  //     { userId: req.jwtData.userId, couponId: req.body.details.couponId }
  //   ]);
  // }
  order.orderId = order._id;
  console.log("orderrrrr", order);
  let response = _.pick(order, [
    "orderId",
    "orderNo",
    "location",
    "vendorLocation",
    "orderStatus",
    "paymentUrl",
    "driverRatedByUser",
    "mobile",
    "email",
    "driverAmount",
    "countryCode",
    "vendorName",
    "deliveryCharges",
    "driverId",
    "deliveryTip",
    "isRefundPending",
    "deliveryPic",
    "deliveryInstructions",
    "vendorId",
    "name",
    "deliveryTime",
    "deliveryAddress",
    "details",
    "paymentType",
    "taxes",
    "cartId",
    "taxesPercent",
    "creationDate",
    "insertDate",
    "packagingCharges",
    "vendorImage",
    "vendorName",
    "vendorAddress",
    "totalAmount",
    "userId",
    "platformFees",
    "cardDetails",
    "vendorCategory",
  ]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: "Order created successfully", response },
  });




});

router.delete("/:id", identityManager(["user"]), async (req, res) => {
  let cart = await Cart.findOne({ _id: req.params.id });
  console.log(cart);

  if (!cart) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CART_CONSTANTS.NOT_FOUND },
    });
  }
  await Cart.deleteOne({ _id: req.params.id });
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: CART_CONSTANTS.CART_DELETED },
  });

  // res.status(200).send({
  //   apiId: req.apiId,
  //   statusCode: 400,
  //   message: "product already removed",
  //   data: { message: CART_CONSTANTS.DELETED },
  // });
});

router.get("/test", identityManager(["user"]), async (req, res) => {
  let criteria = {};
  orderId = req.query.orderId;
  criteria._id = mongoose.Types.ObjectId(orderId);
  let order = await Order.aggregate([
    {
      $match: criteria,
    },
    { $unwind: "$details.cartItems" },
    { $project: { cartItems: "$details.cartItems", _id: 0 } },
    { $sort: { "cartItems.productId": 1 } },
  ]);

  let productIds = [];
  for (item of order) {
    let id = mongoose.Types.ObjectId(item.cartItems.productId);
    productIds.push(id);
  }
  let criteria1 = {};
  criteria1._id = { $in: productIds };
  criteria1.isDeleted = false;
  let products = await Product.aggregate([
    {
      $match: criteria1,
    },
    { $addFields: { productId: { $toString: "$_id" } } },
    {
      $lookup: { from: "toppings", localField: "productId", foreignField: "productId", as: "toppingData" },
    },
  ]);
  console.log("orderrrrr,", order, products);

  res.status(200).send({
    apiId: req.apiId,
    statusCode: 400,
    message: "product already removed",
    data: { products },
  });
});

// async function productUnavailable(cartId) {
//   let cartItems = await CartItem.find({ cartId: cartId });
//   let data = [];
//   let variant = {};
//   for (item of cartItems) {
//     let product = await Product.findOne({ _id: item.items.productId, isDeleted: false, isHidden: false });
//     if (!product) {
//       data.push(item._id);
//       await CartItem.deleteOne({ _id: item._id });
//       return data;
//     }
//   }
//   return data;
// }
async function isProductUpdated(cartItems, cartId) {
  let itemsInDb = await CartItem.find({ cartId: cartId });
  if (itemsInDb.length != cartItems.length) {
    return true;
  }
  return false;
}
module.exports = router;
