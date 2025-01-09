const config = require("config");
const { ApiLog } = require("../models/apiLog");
const { sendFiveHundredMail } = require("../services/amazonSes");
const axios = require("axios");

const { fiveHundredErrorTemp } = require("../services/htmlTemplateFile");
const { formatter } = require("../services/commonFunctions");

async function checkFiveHundredError() {
  let startTime = Math.round(new Date() / 1000) - 300;
  let fiveHundredError = await ApiLog.aggregate([
    { $match: { statusCode: 500, insertDate: { $gte: startTime } } },
    {
      $group: {
        _id: "$completeUrl",
        url: { $last: "$completeUrl" },
        count: { $sum: 1 },
      },
    },
    { $limit: 5 },
  ]);
  let logData = {
    fiveHundredError: fiveHundredError,
  };

  let fiveHundredData = [];
  for (var index = 0; index < logData.fiveHundredError.length; index++) {
    let url = logData.fiveHundredError[index].url;
    let count = logData.fiveHundredError[index].count;
    let temData = {
      url: url,
      count: count.toString(),
    };
    const temp = formatter(fiveHundredErrorTemp, temData);
    fiveHundredData.push(temp);
  }

  let email = ["atul@zimblecode.com", "manjit@zimblecode.com", "damanpreet@zimblecode.com"];
  if (fiveHundredData.length > 0) {
    await sendFiveHundredMail(email, fiveHundredData);
  }
}
async function sendErrorMessageTelegram(text) {
  let data = {
    method: "get",
    url: config.get("telegramBaseUrl") + `?chat_id=${config.get("telegramChatId")}&parse_mode=HTML&text=${text}`,
  };
  try {
    let response = await axios(data);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

module.exports.checkFiveHundredError = checkFiveHundredError;
module.exports.sendErrorMessageTelegram = sendErrorMessageTelegram;
