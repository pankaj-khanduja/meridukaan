const config = require("config");
const winston = require("winston");
const accountSid = config.get("ACCOUNT_SID");
const authToken = config.get("AUTH_TOKEN");
const client = require("twilio")(accountSid, authToken);

// module.exports = function (data) {
//   return new Promise((resolve, reject) => {
//     client.messages
//       .create(data)
//       .then((message) => {
//         resolve(message);
//       })
//       .catch((err) => {
//         console.log("ccccc :", err);
//         reject(err);
//       });
//   });
// };

async function twillioSms(data) {
  console.log(data, "data")
  try {
    const result = await client.messages.create(data);
    console.log("otp send resut", result);
    if (result.sid) {
      winston.info(`Sending of SMS success with SID: ${result.sid}`);
    }
    return { sid: result.sid };
  } catch (Ex) {
    winston.error(`Sending of SMS failed errorcode: ${Ex.code}.`);
    return { code: Ex.code };
  }
}

module.exports.twillioSms = twillioSms;
// console.log(client);
