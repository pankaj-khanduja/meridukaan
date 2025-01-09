const express = require("express");
const config = require("config");
const SocketManager = require("./libs/socketManager");
const app = express();
const sockServer = require("http").createServer(app);
const cron = require("node-cron");

const { checkCouponExpiry, checkBannerExpiry } = require("./jobs/coupons");
const bodyParser = require("body-parser");
const winston = require("winston");
const { pendingToUnassigned, freezeTheDriver, verifyRefund, verifyRetryPayout } = require("./jobs/changeStatus");
const { paymentFailureOrders, orderAssignment } = require("./jobs/orderAssignment");
const { reorder } = require("./models/order");
const { cartReminder } = require("./jobs/cartReminder");
const {
  weeklyPayout,
  payoutEntriesVendor,
  payoutEntriesDriver,
  payoutEntriesInfluencer,
  driverDailyPayout
} = require("./jobs/payout");
const { sendLogsEmail, sendPayoutDetailLogs } = require("./jobs/logSendEmail");
const { accessTokenRequest } = require("./services/zoho");
const { checkFiveHundredError } = require("./services/monitoring");
// const { updateData } = require("./services/xlRead")
// const { refundTransaction, getRefundById, retryPayoutVerify } = require("./services/flutterWave");
// const { test } = require("./jobs/test");
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // support encoded bodies

require("./startup/logging")();
require("./startup/logger");
require("./startup/cors")(app);

require("./startup/routes")(app);
require("./startup/db")();

app.set('view engine', 'ejs');
app.get('/delete/account', (req, res) => {

  res.render('home', {
    url: config.get("apiBaseURl") + config.get("delete_api"),
    primaryColor: "#53705B",
    logoUrl: config.get("logoUrl"),
    otpUrl: config.get("apiBaseURl") + config.get("otp_api"),
  });

});

const port = process.env.PORT || config.get("port");

SocketManager.connectSocket(sockServer);
const server = sockServer.listen(port, () => winston.info(`Listening on port ${port}...`));

setInterval(paymentFailureOrders, 30 * 1000);
setInterval(orderAssignment, 3* 1000);
setInterval(checkCouponExpiry, 1 * 30 * 1000);
setInterval(cartReminder, 10 * 1000);

/////update product images with xl
// updateData(); 
module.exports = server;
