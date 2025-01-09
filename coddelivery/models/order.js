const Joi = require("joi");
const config = require("config");
const mongoose = require("mongoose");
const { Topping, Product } = require("../models/product");
const { FeeAndLimit } = require("./feeAndLimit");

Joi.objectId = require("joi-objectid")(Joi);

// const { array } = require("joi")
const orderSchema = new mongoose.Schema({
  userId: { type: String },
  cartId: { type: String },
  parentOrderId: String,
  childOrderId: String,
  isReturnOrder: { type: Boolean, default: false },
  parentOrderAmount: Number,
  userId: String,
  cartId: String,
  cityId: String,
  vendorPayoutId: String,
  driverPayoutId: String,
  influencerPayoutId: String,
  codPayoutId: String,
  orderStatus: {
    type: String,
    enum: [
      "ACTIVE",
      "ACCEPTED",
      "UPCOMING",
      "REJECTED",
      "PICKEDUP",
      "ITEM_MATCHED",
      "ARRIVED_AT_PICKUP",
      "ASSIGNED",
      "UNASSIGNED",
      "DELIVERED",
      "CANCELLED",
      "PENDING",
      "ARRIVED_AT_DROP",
      "REFUNDED",
      "RETURN_IN_PROGRESS",
      "RETURNED"
    ],
    default: "PENDING"
  },
  paymentType: { type: String, enum: ["POD", "paidOnline", "card"] },
  paymentUrl: { type: String, default: "" },
  tipPaymentUrl: { type: String, default: "" },
  orderRating: { type: Number, default: 0 },
  flutterwaveRef: { type: String, default: "" },
  flutterwaveId: String,
  tipFlutterwaveRef: { type: String, default: "" },
  orderNo: { type: String },
  countryCode: { type: String, default: "" },
  mobile: { type: String, default: "" },
  name: { type: String },
  email: { type: String, default: "" },
  deliveryAddress: { type: Object },
  isOrderSeen: { type: Boolean },
  isUnassignedSoundNeedsToBeNotified: { type: Boolean, default: false },
  appType: { type: String, default: "app" },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }
  },
  details: { type: Object },
  couponType: { type: String, default: "" },
  referralId: String,
  vendorId: { type: String },
  vendorName: { type: String, default: "" },
  vendorCategory: { type: String },
  vendorDriverCount: Number,
  isPickUpAndDropOrder: { type: Boolean, default: false },
  vendorLocation: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }
  },
  loopCount: { type: Number, default: 0 },
  noDriverFoundLoopCount: { type: Number, default: 0 },

  vendorImage: String,
  vendorAddress: String,
  vehicleType: String,
  driverId: { type: String, default: "" },
  isReassignDriver: { type: Boolean, default: false },
  wasReassignOrderPickedUp: { type: Boolean, default: false },
  driverCancelledAt: Number,
  exDriverId: [String],
  influencerId: { type: String, default: "" },

  deliveryCharges: { type: Number },
  driverAmount: Number,
  adminAmount: Number,
  platformFees: Number,
  returnOrderFare: Number,
  adminSubtotalAmount: { type: Number, default: 0 },
  adminDeliveryAmount: Number,
  initialWaiveShare: Number,
  vendorAmount: { type: Number, default: 0 },
  packagingCharges: { type: Number, default: 0 },
  returnReason: String,
  influencerAmount: { type: Number, default: 0 },
  vendorCommissionPercent: { type: Number, default: 0 },
  driverCommissionPercent: { type: Number, default: 0 },
  switchDriverTime: { type: Number, default: 0 },
  deliveryInstructions: String,
  deliveryTime: { type: Number },
  deliveryDateTime: { type: String },
  deliveryDate: String,
  acceptedAt: Number,
  rejectedAt: Number,
  pickedUpTime: Number,
  otpPickUpVerifiedAt: Number,
  otpDropOffVerifiedAt: Number,
  influencerDetails: {
    paymentType: String,
    paymentValue: String
  },
  cardId: String,
  cancelledAt: Number,
  deliveredAt: Number,
  driverAssignedAt: Number,
  arrivedPickUpAt: Number,
  arrivedDropAt: Number,
  deliveredAtDate: Date,
  orderDeliveryWeek: Number,
  deliveryTip: { type: Number, default: 0 },
  driverRatedByUser: { type: Number, default: 0 },
  taxes: Object,
  taxesPercent: Object,
  pickUpPic: { type: String, default: "" },
  // isDriverRated: false,
  // isVendorRated: false,
  sendRatingReminder: { type: Boolean, default: true },
  isOrderAmtPaidToDriver: { type: Boolean, default: false },
  isOrderAmtPaidToAdmin: { type: Boolean, default: false },
  isOrderAmtPaidToVendor: { type: Boolean },
  isInfluencerSharePaid: { type: Boolean, default: true },
  waitingTimeFare: { type: Number, default: 0 },
  waitingTimeinMin: { type: Number, default: 0 },
  rideTimeFare: { type: Number, default: 0 },
  rideTimeMin: { type: Number, default: 0 },
  baseFare: Number,
  deliveryFare: Number,
  isChargesAtPickUpUpdated: { type: Boolean, default: false },
  isChargesAtDropUpdated: { type: Boolean, default: false },
  rejectedBy: [String],
  totalAmount: Number,
  codAmountToPay: { type: Number, default: 0 },
  cardDetails: { type: Object, default: {} },
  tipCardDetails: { type: Object, default: {} },

  isRefundPending: { type: Boolean, default: false },
  refundId: String,
  isRefundToVerified: { type: Boolean, default: false },
  codReceived: { type: Boolean, default: false },
  isUserVerified: { type: Boolean, default: false },

  deliveryPic: { type: String, default: "" },
  cancelledBy: {
    role: { type: String },
    userId: { type: String }
  },
  orderRefundStatus: { type: String }, ///Refunded means processed 
  orderPaymentId: { type: String, default: "" },
  razorpay_payment_id: { type: String },
  razorpay_payment_link_id: { type: String },
  paymentLinkStatus: { type: String, default: "" },
  razorpay_payment_link_reference_id: { type: String },
  otp: { type: Number, min: 1000, max: 9999 },
  isArrivedAtPickUp: { type: Boolean, default: false },
  isArrivedAtDrop: { type: Boolean, default: false },
  invoiceLink: { type: String },
  redirectUrl: String,
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    }
  }
});

const Order = mongoose.model("Order", orderSchema);
function validatePlaceOrder(req) {
  const schema = Joi.object({
    vendorId: Joi.objectId().required(),
    couponId: Joi.objectId(),
    cartId: Joi.objectId().required(),
    details: Joi.object().required(),
    name: Joi.string().required(),
    mobile: Joi.string().required(),
    countryCode: Joi.string(),
    paymentType: Joi.string().valid(["POD", "paidOnline", "card"]).required(),
    cardToken: Joi.when("paymentType", {
      is: "card",
      then: Joi.string().required(),
      otherwise: Joi.string()
    }),
    taxes: Joi.object().required(),
    deliveryTip: Joi.number(),
    deliveryTime: Joi.number().required(),
    taxesPercent: Joi.object().required(),
    packagingCharges: Joi.number(),
    // cardDetails: Joi.object().required(),
    deliveryCharges: Joi.number().required(),
    driverAmount: Joi.number().required(),
    deliveryInstructions: Joi.string().allow(""),
    deliveryAddress: Joi.object().required(),
    cardDetails: Joi.object(),
    location: Joi.array(),
    redirectUrl: Joi.string(),
    appType: Joi.string()
  });
  return schema.validate(req);
}

function validatePlacePickUpDrop(req) {
  const schema = Joi.object({
    details: Joi.object({
      senderName: Joi.string().required(),

      orderType: Joi.string().valid(["normal", "scheduled"]),
      senderMobile: Joi.string().required(),
      senderEmail: Joi.string(),
      couponId: Joi.string().allow(""),
      discount: Joi.number(),
      couponValue: Joi.number(),
      couponType: Joi.string().allow(""),
      couponCode: Joi.string().allow(""),
      referralDiscount: Joi.number(),
      maxDiscountPrice: Joi.number(),
      senderCountryCode: Joi.string().required(),
      recipientName: Joi.string().required(),
      recipientMobile: Joi.string().required(),
      recipientEmail: Joi.string(),
      recipientCountryCode: Joi.string().required(),
      itemPicture: Joi.string(),
      pickUpLocation: Joi.array().required(),
      pickUpAddress: Joi.object().required(),
      dropLocation: Joi.array().required(),
      dropAddress: Joi.object().required(),
      deliveryTime: Joi.number(),
      deliveryDateTime: Joi.string(),
      otherDeliveryDetails: Joi.object(),
      weight: Joi.string(),
      isFragile: Joi.string(),
      productCategory: Joi.string(),
      instruction: Joi.string(),
      distance: Joi.number(),
      exceededDeliveryCharges: Joi.number(),
      baseFare: Joi.number()
    }),
    paymentType: Joi.string().valid(["POD", "paidOnline", "card"]).required(),
    vehicleType: Joi.string().required(),
    cardToken: Joi.when("paymentType", {
      is: "card",
      then: Joi.string().required(),
      otherwise: Joi.string()
    }),
    taxes: Joi.object().required(),
    // deliveryTime: Joi.number().required(),
    taxesPercent: Joi.object().required(),
    // exceededDistanceFare: Joi.number(),
    // deliveryBaseFare: Joi.number(),
    // baseFare: Joi.number(),
    deliveryFare: Joi.number().required(),
    // cardDetails: Joi.object().required(),
    deliveryCharges: Joi.number().required(),
    driverAmount: Joi.number(),
    deliveryInstructions: Joi.string().allow(""),
    cardDetails: Joi.object(),
    appType: Joi.string().valid("app", "web")
  });
  return schema.validate(req);
}
function validateReturnOrder(req) {
  const schema = Joi.object({
    orderId: Joi.objectId().required(),
    returnReason: Joi.string()
    // details: Joi.object({
    //   senderName: Joi.string().required(),
    //   orderType: Joi.string().valid(["normal", "scheduled"]),
    //   senderMobile: Joi.string().required(),
    //   senderEmail: Joi.string(),

    //   senderCountryCode: Joi.string().required(),
    //   recipientName: Joi.string().required(),
    //   recipientMobile: Joi.string().required(),
    //   recipientEmail: Joi.string(),
    //   recipientCountryCode: Joi.string().required(),
    //   itemPicture: Joi.string(),
    //   pickUpLocation: Joi.array().required(),
    //   pickUpAddress: Joi.object().required(),
    //   dropLocation: Joi.array().required(),
    //   dropAddress: Joi.object().required(),

    //   otherDeliveryDetails: Joi.object(),
    //   weight: Joi.string(),
    //   isFragile: Joi.string(),
    //   productCategory: Joi.string(),
    //   distance: Joi.number(),
    //   exceededDeliveryCharges: Joi.number(),
    //   baseFare: Joi.number(),
    // }),
    // paymentType: Joi.string().valid(["POD", "paidOnline", "card"]).required(),
    // vehicleType: Joi.string().required(),
    // cardToken: Joi.when("paymentType", {
    //   is: "card",
    //   then: Joi.string().required(),
    //   otherwise: Joi.string(),
    // }),

    // // deliveryTime: Joi.number().required(),
    // taxesPercent: Joi.object().required(),
    // // exceededDistanceFare: Joi.number(),
    // // deliveryBaseFare: Joi.number(),
    // // baseFare: Joi.number(),
    // deliveryFare: Joi.number().required(),
    // // cardDetails: Joi.object().required(),
    // // driverAmount: Joi.number(),
    // deliveryInstructions: Joi.string().allow(""),
    // cardDetails: Joi.object(),
  });
  return schema.validate(req);
}

function validatePayDeliveryTip(req) {
  const schema = Joi.object({
    orderId: Joi.objectId().required(),
    deliveryTip: Joi.number().required(),
    appType: Joi.string(),
    paymentType: Joi.string().valid(["others", "card"]).required(),
    cardToken: Joi.when("paymentType", {
      is: "card",
      then: Joi.string().required(),
      otherwise: Joi.string()
    })
  });
  return schema.validate(req);
}
function validateDeliveryLocation(req) {
  const schema = Joi.object({
    lat1: Joi.number().required(),
    lon1: Joi.number().required(),
    lat2: Joi.number().required(),
    lon2: Joi.number().required()
  });
  return schema.validate(req);
}
function validateCancelDriver(req) {
  const schema = Joi.object({
    orderId: Joi.objectId().required()
  });
  return schema.validate(req);
}
function validateReorder(req) {
  const schema = Joi.object({
    orderId: Joi.objectId().required(),
    cartId: Joi.objectId().required()
  });
  return schema.validate(req);
}
function validateAcceptReject(req) {
  const schema = Joi.object({
    orderId: Joi.objectId()
      .required()
      .error(() => {
        return {
          message: "Invalid orderId"
        };
      }),
    driverId: Joi.string(),
    isAccepted: Joi.boolean().required()
  });
  return schema.validate(req);
}
function validateOrderAcceptRejectVendor(req) {
  const schema = Joi.object({
    orderId: Joi.objectId().required(),
    orderStatus: Joi.string().valid("ACCEPTED", "REJECTED", "DELIVERED")
  });
  return schema.validate(req);
}

function validateOrderStatusUpdate(req) {
  const schema = Joi.object({
    orderId: Joi.objectId()
      .required()
      .error(() => {
        return {
          message: "Invalid orderId"
        };
      })
      .required(),
    driverId: Joi.string(),
    lat: Joi.number(),
    lng: Joi.number(),
    razorpayPaymentLinkStatus: Joi.string(),
    orderStatus: Joi.string().valid(
      "ACTIVE",
      "ACCEPTED",
      "REJECTED",
      "PICKEDUP",
      "ITEM_MATCHED",
      "ARRIVED_AT_PICKUP",
      "ARRIVED_AT_DROP",
      "UNASSIGNED",
      "DELIVERED",
      "CANCELLED",
      "PENDING"
    )
  });
  return schema.validate(req);
}
// function validate(req){
//   const schema = Joi.object({
//     orderId: Joi.objectId().required()
//     .error(() => {
//       return {
//         message: "Invalid orderId",
//       };
//     }),

//    });
//    return schema.validate(req);
// }

function validateDeliveryPic(req) {
  const schema = Joi.object({
    orderId: Joi.objectId()
      .required()
      .error(() => {
        return {
          message: "Invalid orderId"
        };
      }),

    deliveryPic: Joi.string(),
    pickUpPic: Joi.string()

    // driverId:Joi.string().required(),
    // isAccepted:Joi.boolean().required()
  });
  return schema.validate(req);
}

async function isDriverAvailable(cityId, serviceType) {
  let currentTime = Math.round(new Date() / 1000);
  let dayStartTime = Math.round(new Date().setUTCHours(0, 0, 0, 0) / 1000) + parseInt(config.get("inOffset"));
  let currentTimeinSec = currentTime - dayStartTime;
  console.log("dayStartTime", dayStartTime, currentTime);

  let fare = await FeeAndLimit.findOne({ cityId: cityId, type: serviceType });
  console.log(
    "fare.startDeliveryTimeInSec",
    fare,
    fare.startDeliveryTimeInSec,
    currentTimeinSec,
    fare.endDeliveryTimeInSec
  );
  if (currentTimeinSec > fare.startDeliveryTimeInSec && currentTimeinSec < fare.endDeliveryTimeInSec) {
    return true;
  }
  return false;
}

async function vendorAdminShare(subTotalAmount, platformFee, cartDiscount, referralDiscount, couponType) {
  console.log(
    "subTotalAmount, platformFee, cartDiscount, referralDiscount, couponType",
    subTotalAmount,
    platformFee,
    cartDiscount,
    referralDiscount,
    couponType
  );
  let vendorShare = 0,
    adminShare = 0,
    amount = 0;
  initialWaiveShare = 0;
  if (couponType === "coupon") {
    // amount = subTotalAmount - cartDiscount;
    // amount = (amount * platformFee) / 100;
    // vendorShare = subTotalAmount - amount;
    // adminShare = amount - referralDiscount;
    amount = subTotalAmount - cartDiscount;
    adminShare = (amount * platformFee) / 100;
    initialWaiveShare = (subTotalAmount * platformFee) / 100;
    vendorShare = amount - adminShare;
    adminShare = (amount * platformFee) / 100 - referralDiscount;
  } else {
    amount = (subTotalAmount * platformFee) / 100;
    vendorShare = subTotalAmount - amount;
    initialWaiveShare = amount;
    adminShare = amount - referralDiscount - cartDiscount;
  }
  let data = {
    vendorShare: vendorShare,
    adminShare: adminShare,
    initialWaiveShare: initialWaiveShare
  };
  console.log("data", data);
  return data;
}

async function reorder(orderId, cartId) {
  let criteria = {};
  criteria._id = mongoose.Types.ObjectId(orderId);
  console.log("cartId", cartId);
  let order = await Order.aggregate([
    {
      $match: criteria
    }
  ]);
  console.log("orderrrrr,", order);

  let cartItems = order[0].details.cartItems;
  let vendorId = order[0].vendorId;
  let length = cartItems.length;
  let pushCartItems = [];
  for (cartItem of cartItems) {
    let product = await Product.findOne({ _id: cartItem.productId, isHidden: false, isDeleted: false });
    if (product) {
      let pushCartItemObj = {};
      pushCartItemObj.items = {};
      let subtypesTotal = 0;
      let subtypes = [];
      let itemsArray = [];
      if (cartItem.subtypes.length > 0) {
        for (subtype of cartItem.subtypes) {
          let topping = await Topping.findOne({ _id: subtype.toppingId }).lean();

          let index = topping.subtype.findIndex((i) => i._id == subtype.subtypeId);
          if (index === -1) {
            continue;
          }
          let subtypeObj = {};
          subtypeObj.toppingName = topping.toppingName;
          subtypeObj.toppingId = topping._id;
          subtypeObj.subtypeId = topping.subtype[index]._id;
          subtypeObj.price = topping.subtype[index].price;

          subtypeObj.name = topping.subtype[index].name;
          subtypes.push(subtypeObj);
          subtypesTotal += topping.subtype[index].price;
          itemsArray.push(subtype.toppingId, subtype.subtypeId);
        }
      }
      let uniqueItemId = "";
      if (itemsArray.length > 0) {
        uniqueItemId = itemsArray.sort().join(".");
      }
      pushCartItemObj.items.productPrice = product.price;
      pushCartItemObj.items.subtypesTotal = subtypesTotal;
      pushCartItemObj.items.subtypes = subtypes;
      pushCartItemObj.items.uniqueItemId = uniqueItemId;
      pushCartItemObj.items.productId = product._id;
      pushCartItemObj.quantity = cartItem.quantity;
      pushCartItemObj.quantity = cartItem.quantity;
      pushCartItemObj.cartId = cartId;
      pushCartItemObj.subtypesTotal = subtypesTotal;

      pushCartItemObj.totalPrice = cartItem.quantity * (product.price + subtypesTotal);
      pushCartItems.push(pushCartItemObj);
    }
  }
  let data = { pushCartItems: pushCartItems, length: length, vendorId: vendorId };
  return data;
}

module.exports.Order = Order;
module.exports.validatePlaceOrder = validatePlaceOrder;
module.exports.validateReturnOrder = validateReturnOrder;

module.exports.validateAcceptReject = validateAcceptReject;
module.exports.validateOrderAcceptRejectVendor = validateOrderAcceptRejectVendor;
module.exports.validateCancelDriver = validateCancelDriver;
module.exports.validateOrderStatusUpdate = validateOrderStatusUpdate;
module.exports.validatePlacePickUpDrop = validatePlacePickUpDrop;
module.exports.validateDeliveryPic = validateDeliveryPic;
module.exports.validateReorder = validateReorder;
module.exports.vendorAdminShare = vendorAdminShare;
module.exports.validatePayDeliveryTip = validatePayDeliveryTip;
module.exports.validateDeliveryLocation = validateDeliveryLocation;
module.exports.isDriverAvailable = isDriverAvailable;
module.exports.reorder = reorder;
