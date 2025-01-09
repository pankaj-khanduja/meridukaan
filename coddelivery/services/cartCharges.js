const { Vendor } = require("../models/vendor");
const { getDistance } = require("geolib");
const geolib = require("geolib");
const config = require("config");
const { FeeAndLimit } = require("../models/feeAndLimit");
const { isPickUpPossible } = require("../models/serviceArea");
const axios = require("axios");
const { Order } = require("../models/order");

module.exports.deliveryCharges = async function (location, orderType, vendorId) {
  let adminCharges;

  if (orderType == "pickUp") {
    let criteria = {};
    criteria.serviceType = "pickUpAndDrop";
    let data = await isPickUpPossible(location.lon1, location.lat1, criteria);
    if (!data) return false;
    // console.log(data, "data================")
    adminCharges = await FeeAndLimit.findOne({ type: "pickUpDrop", cityId: data.cityId }).lean();
  } else {
    let vendor = await Vendor.findOne({ _id: vendorId, status: "active", isDeleted: false });
    if (!vendor) {
      return false;
    }
// console.log(vendor,"vendorvendorvendor==================")
    location.lat2 = parseFloat(vendor.location.coordinates[1]);
    location.lon2 = parseFloat(vendor.location.coordinates[0]);
    adminCharges = await FeeAndLimit.findOne({ type: "store", cityId: vendor.cityId }).lean();
  }

  let distance;
  if (location.lat1 == location.lat2 && location.lon1 == location.lon2) {
    distance = 0;
  } else {
    console.log("locationnm", location);
    distance = await getEstimatedTravelTime(location);
    if (distance == -1) {
      distance = getDistance({ latitude: location.lat1, longitude: location.lon1 }, { latitude: location.lat2, longitude: location.lon2 }, (accuracy = 1));
      // console.log(distance, "distancedistancedistancedistance=========")
      distance = Math.round(geolib.convertDistance(distance, "mi"), 1);
      distance = distance * config.get("mileToKmValue");
    }
    // distance = getDistance({ latitude: location.lat1, longitude: location.lon1 }, { latitude: location.lat2, longitude: location.lon2 }, (accuracy = 1));
    // distance = Math.round(geolib.convertDistance(distance, "mi"), 1);
  }

  console.log("adminChargesffffff", adminCharges);
  let deliveryCharges;
  let exceededDeliveryFare = 0;
  if (distance < adminCharges.defaultDistance) {
    // console.log("helloooooooooooooooooo<<<<<<<<<<<<<<<<")
    // if (orderType == "pickUp") {
    deliveryCharges = adminCharges.baseFare;
    // } else {
    // deliveryCharges = adminCharges.baseFare;
    // }
  } else {

    // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>")
    let exceededDistance = distance - adminCharges.defaultDistance;
    exceededDeliveryFare = adminCharges.exceededDeliveryChargesPerKm * exceededDistance;

    // if (orderType == "pickUp") {
    deliveryCharges = exceededDeliveryFare + adminCharges.baseFare;
    // } else {
    // deliveryCharges = adminCharges.baseFare + exceededDeliveryFare;
    // }
  }
  return { deliveryCharges, exceededDeliveryFare, adminCharges, distance };
};

async function getEstimatedTravelTime(location) {
  let API_KEY = config.get("googleMatrixKey");
  let url =
    "https://maps.googleapis.com/maps/api/distancematrix/json?key=" +
    API_KEY +
    "&units=metric&origins=" +
    location.lat1 +
    "," +
    location.lon1 +
    "&destinations=" +
    location.lat2 +
    "," +
    location.lon2;
  // let config = {
  //   method: "get",
  //   url: url,
  // };

  console.log(url, "urlllllllll================");

  try {
    let response = await axios.get(url);
    console.log(JSON.stringify(response.data), "ressponajsnjfhjhdfdshfhgds===========");
    var { rows } = response.data;
    // let travelTime = rows[0].elements[0].duration.text;
    let distance = rows[0].elements[0].distance.value / 1000;
    console.log("Distance Matrix for " + " : " + location.lat1 + "," + location.lon1 + " to " + location.lat1 + "," + location.lon1 + "===> " + distance);
    // console.log("distance", distance);
    return distance;
  } catch (Ex) {
    console.log("Error Getting Distance matrix for ===> ", Ex);
    return -1;
  }
}

module.exports.calculateTax = function (totalAmount, chargeDetails, orderType) {
  //   let vendor = await Vendor.find({ _id: vendorId })
  console.log("totalamount", totalAmount);
  console.log("chargeDetails2222", totalAmount, chargeDetails, orderType);
  let serviceTax = (chargeDetails.serviceTax * totalAmount) / 100;
  let serviceCharge = 0;
  if (orderType != "pickUp") {
    serviceCharge = (chargeDetails.serviceCharge * totalAmount) / 100;
  }
  let vatCharge = (chargeDetails.vatCharge * totalAmount) / 100;
  if (orderType == "pickUp") {
    console.log("serviceTax, vatCharge", serviceTax, vatCharge);
    return { serviceTax, vatCharge };
  } else {
    return { serviceTax, serviceCharge, vatCharge };
  }
};

module.exports.calculateDiscount = function (amount, couponType, couponValue, maxDiscount) {
  let discountValue = 0;
  console.log("amount, couponType, couponValue, maxDiscount", amount, couponType, couponValue, maxDiscount);
  if (couponType == "fixed") {
    discountValue = couponValue;
    if (amount < couponValue) discountValue = amount;
  } else if (couponType == "percentage") {
    discountValue = (amount * couponValue) / 100;
    if (maxDiscount != 0 && maxDiscount < discountValue) {
      discountValue = maxDiscount;
    }
  }
  return discountValue;
};
