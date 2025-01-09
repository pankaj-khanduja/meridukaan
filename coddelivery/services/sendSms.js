const config = require("config");
const winston = require("winston");
const axios = require("axios");

const MULTITEXTER_URL = config.get("MULTITEXTER_URL");
const API_KEY = config.get("sms_multitexter.api_key");

async function sendSms(customerObj) {
  console.log("check :", API_KEY);
  let config = {
    method: "post",
    url: MULTITEXTER_URL + "/app/sendsms",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + API_KEY
    },
    data: customerObj
  };

  try {
    let response = await axios(config);
    console.log("response.data:", response.data);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

// module.exports.sendSms = sendSms;
module.exports.sendSms = sendSms;
