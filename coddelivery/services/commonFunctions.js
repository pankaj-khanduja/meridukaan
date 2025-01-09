const { Store } = require("../models/vendor");
const config = require("config");
const moment = require("moment");

const { getDistance } = require("geolib");

const geolib = require("geolib");
module.exports.formatter = function (stringData, dataObject) {
  console.log("stringData", stringData, dataObject);
  let keyArray = Object.keys(dataObject);
  let valueArray = Object.values(dataObject);

  let newString = stringData;
  keyArray.forEach(function (element, index) {
    let text = new RegExp("\\$" + element + "\\$", "g");
    newString = newString.replace(text, valueArray[index]);
  });
  return newString;
};
function getWeekOfYear(epoch) {
  let week = parseInt(moment(epoch).isoWeek());
  let month = parseInt(moment(epoch).format("MM"));
  if (week == 53 && month == 1) return 01;
  else if (week == 53 && month == 12) return 53;
  else return week + 1;
}
module.exports.deliveryCharges = async function (location, orderType, vendorId) {
  // location.lat1 = parseFloat(req.query.lat);
  // location.lon1 = parseFloat(req.query.lng);
  if (orderType == "pickUp") {
  } else {
    let vendor = await Vendor.findOne({ _id: vendorId });

    console.log("locartui", location);
    location.lat2 = parseFloat(vendor.location.coordinates[1]);
    location.lon2 = parseFloat(vendor.location.coordinates[0]);
  }
  if (location.lat1 == location.lat2 && location.lon1 == location.lon2) {
    return 0;
  } else {
    let distance = getDistance(
      { latitude: location.lat1, longitude: location.lon1 },
      { latitude: location.lat2, longitude: location.lon2 },
      (accuracy = 1)
    );
    console.log("fgfgfgggf", distance);
    return (distance = Math.round(geolib.convertDistance(distance, "mi"), 1));
  }
};

// module.exports.calculateTax = function (totalAmount) {
//   let tax = (config.get("defaultTax") * totalAmount) / 100
//   return tax
// }

// module.exports.calculateTime = function (data) {
//   let opening, closing, closingTimeInSec, openingTimeInSec, day;

//   if (data.closingTime.substr(0, 2) > 12) {
//     closingTime = data.closingTime.substr(0, 2) - 12 + data.closingTime.substr(2, 4) + " PM";
//     closingTimeInSec = parseInt(data.closingTime.substr(0, 2)) * 3600 + parseInt(data.closingTime.substr(3, 5)) * 60;
//   } else {
//     closingTime = data.closingTime.substr(0, 2) + data.closingTime.substr(2, 4) + " AM";
//     closingTimeInSec = parseInt(data.closingTime.substr(0, 2)) * 3600 + parseInt(data.closingTime.substr(3, 5)) * 60;
//   }
//   if (data.openingTime.substr(0, 2) > 12) {
//     openingTime = data.openingTime.substr(0, 2) - 12 + data.openingTime.substr(2, 4) + " PM";
//     openingTimeInSec = parseInt(data.openingTime.substr(0, 2)) * 3600 + parseInt(data.openingTime.substr(3, 5)) * 60;
//   } else {
//     openingTime = data.openingTime.substr(0, 2) + data.openingTime.substr(2, 4) + " AM";
//     openingTimeInSec = parseInt(data.openingTime.substr(0, 2)) * 3600 + parseInt(data.openingTime.substr(3, 5)) * 60;
//   }
//   day = data.day;
//   return { openingTime, closingTime, closingTimeInSec, openingTimeInSec, day };
// };

module.exports.calculateTime = function (data) {
  let opening, closing, closingTimeInSec, openingTimeInSec, day;
  if (data.closingTime.substr(0, 2) > 12) {
    closingTime = data.closingTime.substr(0, 2) - 12 + data.closingTime.substr(2, 4) + " PM";
    closingTimeInSec = parseInt(data.closingTime.substr(0, 2)) * 3600 + parseInt(data.closingTime.substr(3, 5)) * 60;
  } else {
    if (data.closingTime.substr(0, 2) == "00") {
      closingTime = "12" + data.closingTime.substr(2, 4) + " AM";
    } else if (data.closingTime.substr(0, 2) == "12") {
      closingTime = "12" + data.closingTime.substr(2, 4) + " PM";
    } else {
      closingTime = data.closingTime.substr(0, 2) + data.closingTime.substr(2, 4) + " AM";
    }
    closingTimeInSec = parseInt(data.closingTime.substr(0, 2)) * 3600 + parseInt(data.closingTime.substr(3, 5)) * 60;
  }
  if (data.openingTime.substr(0, 2) > 12) {
    openingTime = data.openingTime.substr(0, 2) - 12 + data.openingTime.substr(2, 4) + " PM";
    openingTimeInSec = parseInt(data.openingTime.substr(0, 2)) * 3600 + parseInt(data.openingTime.substr(3, 5)) * 60;
  } else {
    if (data.openingTime.substr(0, 2) == "00") {
      openingTime = "12" + data.openingTime.substr(2, 4) + " AM";
    } else if (data.openingTime.substr(0, 2) == "12") {
      openingTime = "12" + data.openingTime.substr(2, 4) + " PM";
    } else {
      openingTime = data.openingTime.substr(0, 2) + data.openingTime.substr(2, 4) + " AM";
    }
    openingTimeInSec = parseInt(data.openingTime.substr(0, 2)) * 3600 + parseInt(data.openingTime.substr(3, 5)) * 60;
  }
  day = data.day;
  return { openingTime, closingTime, closingTimeInSec, openingTimeInSec, day };
};
module.exports.changeDateFormat = function (dateString) {
  // Change to local timezone.
  var nd = new Date(dateString);
  let options = { day: "numeric" };
  let day = nd.toLocaleDateString(undefined, options);
  if (day < 10) day = "0" + day;
  options = { month: "numeric" };
  let month = nd.toLocaleDateString(undefined, options);
  if (month < 10) month = "0" + month;
  options = { year: "numeric" };
  let year = nd.toLocaleDateString(undefined, options);
  options = { time: "numeric" };
  let date = year + "-" + month + "-" + day;
  return date;
};

module.exports.getWeekDayHoursMinutes = function (epoch, timeZone) {
  let weekDay = moment(epoch * 1000)
    .tz(timeZone)
    .weekday();
  let minutes = moment(epoch * 1000)
    .tz(timeZone)
    .minutes();
  let hours = moment(epoch * 1000)
    .tz(timeZone)
    .hours();
  let data = {
    weekDay: weekDay,
    minutes: minutes,
    hours: hours
  };
  return data;
};

module.exports.valMsgFormatter = function (msg) {
  msg = msg.replace(/"/g, "");
  msg2 = msg.split("[");
  msg2[0] = msg2[0].replace(/([a-z])([A-Z])/g, "$1 $2");
  if (msg2[1]) msg2[1] = "[" + msg2[1];
  msg = msg2[0].charAt(0).toUpperCase() + msg2[0].slice(1) + msg2.slice(1, msg2.length) + ".";
  return msg;
};
