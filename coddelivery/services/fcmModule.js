const config = require("config");
const devKey = require("../config/codknox-food-delivery-firebase-adminsdk-j0h3y-61966a3910.json");
const prodKey = require("../config/daarlo-13489-firebase-adminsdk-f5vds-7414fae535.json");
let serverKey = config.get('environment') === 'prod' ? prodKey : devKey
// const formatter = require("../services/commonFunctions")
const { formatter } = require("../services/commonFunctions");

var admin = require("firebase-admin");
const { FcmLog, logFcm } = require("../models/fcmLog");

admin.initializeApp({
  credential: admin.credential.cert(serverKey),
});

async function sendFCM(token, data, type, deviceType) {
  var message = {};
  message.token = token;
  message.notification = {};
  message.android = {
    notification: {
      sound: "default",
    },
    priority: "high",
  };
  message.apns = {
    payload: { aps: { sound: "default", headers: { "apns-priority": "5" }, contentAvailable: true } },
  };
  let fcmLog = new FcmLog({ token: token, messageData: data, type: type, receiverId: data.driverId });
  // await logFcm(token, data, type, mobile, status)

  let title;
  let body;
  switch (type) {
    case "newOrder":
      message.data = data;
      title = config.get("notifications.newOrderTitle");

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.newOrderTitle");
      message.notification.body = config.get("notifications.newOrder");
      // message.data.title = config.get("notifications.newOrderTitle")
      // message.data.body = config.get("notifications.newOrder")
      // message.data.type = type
      // message.data.click_action = "FLUTTER_NOTIFICATION_CLICK"

      //   fcmLog.type = data.type;
      //   fcmLog.title = title;
      //   fcmLog.body = body;
      break;
    case "orderPlaced":
      message.data = data;
      title = config.get("notifications.orderPlacedTitle");
      // body = data.body

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.orderPlacedTitle");
      message.notification.body = config.get("notifications.orderPlaced");
      // message.data.title = config.get("notifications.newOrderTitle")
      // message.data.body = config.get("notifications.newOrder")
      // message.data.type = type
      // message.data.click_action = "FLUTTER_NOTIFICATION_CLICK"
      message.data = {
        // userName: data.userName,
        type: data.type,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      };
      //   fcmLog.type = data.type;
      //   fcmLog.title = title;
      //   fcmLog.body = body;
      break;
    case "driverAssigned":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderPlacedTitle");
      // body = data.body

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.driverAssignedTitle");
      message.notification.body = formatter(config.get("notifications.driverAssigned"), data);
      // message.data.title = config.get("notifications.newOrderTitle")
      // message.data.body = config.get("notifications.newOrder")
      // message.data.type = type
      // message.data.click_action = "FLUTTER_NOTIFICATION_CLICK"

      //   fcmLog.type = data.type;
      //   fcmLog.title = title;
      //   fcmLog.body = body;
      break;
    case "orderPickedUp":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderPlacedTitle");
      // body = data.body

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.orderPickedUpTitle");
      message.notification.body = formatter(config.get("notifications.orderPickedUp"), data);

      break;

    case "orderAccepted":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderAcceptedTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.orderAcceptedTitle");
      message.notification.body = formatter(config.get("notifications.orderAccepted"), data);

      break;
    case "orderRefund":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderRefundTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.orderRefundTitle");
      message.notification.body = config.get("notifications.orderRefund");

      break;
    case "driverUnfreezed":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.driverUnfreezedTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.driverUnfreezedTitle");
      message.notification.body = config.get("notifications.driverUnfreezed");

      break;
    case "driverTip":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.driverTipTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.driverTipTitle");
      message.notification.body = formatter(config.get("notifications.driverTip"), data);

      break;
    case "orderRejected":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderRejectedTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.orderRejectedTitle");
      message.notification.body = formatter(config.get("notifications.orderRejected"), data);

      break;
    case "documentStatus":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.documentStatusTitle");

      message.notification = {};

      message.notification.title = formatter(config.get("notifications.documentStatusTitle"), data);
      message.notification.body = formatter(config.get("notifications.documentStatus"), data);

      break;
    case "orderCanceled":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderCanceledTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.orderCanceledTitle");
      message.notification.body = config.get("notifications.orderCanceled");

      break;
    case "documentRejected":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderRejectedTitle");

      message.notification = {};
      message.notification.title = config.get("notifications.documentRejectedTitle");
      message.notification.body = config.get("notifications.documentRejected");

      break;
    case "orderMarkedDeliveredByAdmin":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderRejectedTitle");

      message.notification = {};
      message.notification.title = config.get("notifications.orderMarkedDeliveredTitle");
      message.notification.body = config.get("notifications.orderMarkedDelivered");
      break;
    case "forceAssigned":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.forceAssignedTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.forceAssignedTitle");
      message.notification.body = config.get("notifications.forceAssigned");

      break;
    case "arrivedAtDrop":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.arrivedAtDropTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.arrivedAtDropTitle");
      message.notification.body = formatter(config.get("notifications.arrivedAtDrop"), data);

      break;
    case "arrivedAtPickUp":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.arrivedAtPickUpTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.arrivedAtPickUpTitle");
      message.notification.body = formatter(config.get("notifications.arrivedAtPickUp"), data);

      break;
    case "orderCancelled":
      message.data = data;
      title = config.get("notifications.orderPlacedTitle");
      body = data.body;

      message.notification = {};

      message.notification.title = config.get("notifications.orderCancelledTitle");
      message.notification.body = formatter(config.get("notifications.orderCancelled"), data);

      break;
    case "returnOrder":
      message.data = data;
      title = config.get("notifications.returnOrderTitle");
      body = data.body;

      message.notification = {};

      message.notification.title = config.get("notifications.returnOrderTitle");
      message.notification.body = formatter(config.get("notifications.returnOrder"), data);

      break;
    case "vendorAssigned":
      message.data = data;
      title = config.get("notifications.returnOrderTitle");
      body = data.body;

      message.notification = {};

      message.notification.title = config.get("notifications.vendorAssignedTitle");
      message.notification.body = formatter(config.get("notifications.vendorAssigned"), data);

      break;
    case "receiverPic":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderPlacedTitle");
      body = data.body;

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.receiverPicTitle");
      message.notification.body = config.get("notifications.receiverPic");

      break;
    case "documentUpload":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderPlacedTitle");

      message.notification = {};

      message.notification.title = config.get("notifications.documentUploadTitle");
      message.notification.body = config.get("notifications.documentUpload");

      break;
    case "rateTheDriver":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.orderPlacedTitle");
      // body = data.body

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.rateTheDriverTitle");
      message.notification.body = formatter(config.get("notifications.rateTheDriver"), data);

      break;
      driverUnassigned;
    case "driverUnassigned":
      message.data = data;
      // message.notification = data
      title = config.get("notifications.driverUnassignedTitle");
      // body = data.body

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.driverUnassignedTitle");
      message.notification.body = formatter(config.get("notifications.driverUnassigned"), data);

      break;
    // case "REQUEST_ACCEPTED":
    //   message.data = data
    //   title = config.get("notifications.requestAcceptedTitle")
    //   body = formatter(config.get("notifications.requestAcceptedBody"), data)

    //   if (deviceType != "android") {
    //     message.notification = {}
    //     message.notification.title = title
    //     message.notification.body = body
    //   } else message.data.priority = "high"

    //   message.data.title = title
    //   message.data.body = body
    //   message.data.type = type
    //   message.data.click_action = "FLUTTER_NOTIFICATION_CLICK"

    //   //   fcmLog.type = data.type;
    //   //   fcmLog.title = title;
    //   //   fcmLog.body = body;
    //   break
    // default:
    //   message.data = data;

    //   if (deviceType != "android") {
    //     message.notification = {};
    //     message.notification.title = data.title;
    //     message.notification.body = data.body;
    //   } else message.data.priority = "high";

    //   message.data.type = type;
    //   message.data.click_action = "FLUTTER_NOTIFICATION_CLICK";
    //   fcmLog.type = data.type;
    //   fcmLog.title = data.title;
    //   fcmLog.body = data.body;
  }

  console.log("Message: ", message);
  try {
    admin
      .messaging()
      .send(message)
      .then(async (response) => {
        console.log("Successfully sent message:", response);
        console.log("\n*** SUCCESS FCM: " + response + " |Type: " + type + " |DataType: " + data.type);
        fcmLog.status = "success";
        fcmLog.payload = message;
        fcmLog.response = response;
        await fcmLog.save();
      })
      .catch(async (error) => {
        console.log("Error sending message:", error);
        fcmLog.status = "failed";
        fcmLog.payload = message;
        fcmLog.response = error;
        await fcmLog.save();
      });
  } catch (Ex) {
    console.log("Error sending notifications: ", Ex);
    fcmLog.status = "failed";
    fcmLog.payload = message;
    fcmLog.response = Ex;
    fcmLog.save();
  }
}

async function sendMultipleFCM(token, data, type, deviceType) {
  // console.log("In sendMultipleFCM: ", token)
  var message = {};

  message.tokens = token;
  message.android = {
    notification: {
      sound: "default",
    },
    priority: "high",
  };
  message.apns = {
    payload: { aps: { sound: "default", headers: { "apns-priority": "5" }, contentAvailable: true } },
  };
  let fcmLog = new FcmLog({ messageData: data, type: type, timeZone: data.timeZone });

  let title;
  let body;
  switch (type) {
    case "recordAudio":
      message.data = data;
      title = config.get("notifications.recordAudioTitle");

      // if (deviceType != "android") {
      message.notification = {};

      message.notification.title = config.get("notifications.recordAudioTitle");
      message.notification.body = config.get("notifications.recordAudio");

      break;

    case "newOrder":
      message.data = data;
      title = config.get("notifications.newOrderTitle");

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.newOrderTitle");
      message.notification.body = config.get("notifications.newOrder");
      // message.data.title = config.get("notifications.newOrderTitle")
      // message.data.body = config.get("notifications.newOrder")
      // message.data.type = type
      // message.data.click_action = "FLUTTER_NOTIFICATION_CLICK"

      //   fcmLog.type = data.type;
      //   fcmLog.title = title;
      //   fcmLog.body = body;
      break;
    case "cartReminder":
      message.data = data;
      title = config.get("notifications.cartReminderTitle");

      // if (deviceType != "android") {
      message.notification = {};
      // message.notification.title = config.get("notifications.newOrderTitle")
      // message.notification.body = config.get("notifications.newOrder")
      // }
      // else message.data.priority = "high";
      message.notification.title = config.get("notifications.cartReminderTitle");
      message.notification.body = config.get("notifications.cartReminder");
      // message.data.title = config.get("notifications.newOrderTitle")
      // message.data.body = config.get("notifications.newOrder")
      // message.data.type = type
      // message.data.click_action = "FLUTTER_NOTIFICATION_CLICK"

      //   fcmLog.type = data.type;
      //   fcmLog.title = title;
      //   fcmLog.body = body;
      break;
    default:
      message.data = data;

      if (deviceType != "android") {
        message.notification = {};
        message.notification.title = data.title;
        message.notification.body = data.body;
      } else message.data.priority = "high";

      message.data.type = type;
      message.data.click_action = "FLUTTER_NOTIFICATION_CLICK";
  }
console.l
  try {
    admin.messaging().sendEachForMulticast(message).then(async (response) => {
        // Response is a message ID string.
        console.log("Successfully sent message:", JSON.stringify(response));

        fcmLog.status = "success";
        fcmLog.payload = message;
        fcmLog.response = response;
        await fcmLog.save();
      })
      .catch(async (error) => {
        console.log("Error sending message:", JSON.stringify(error));
        fcmLog.status = "failed";
        fcmLog.payload = message;
        fcmLog.response = error;
        await fcmLog.save();
      });
  } catch (Ex) {
    console.log("Error sending notifications: ", Ex);
    fcmLog.status = "failed";
    fcmLog.payload = message;
    fcmLog.response = Ex;
    fcmLog.save();
  }
}

module.exports.sendFCM = sendFCM;
module.exports.sendMultipleFCM = sendMultipleFCM;
