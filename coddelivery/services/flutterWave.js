// const Flutterwave = require("flutterwave-node-v3");
const config = require("config");
const object = require("joi/lib/types/object");

const FLUTTER_SECRET_KEY = config.get("secretKey");

const FLUTTER_WAVE_URL = config.get("FLUTTER_WAVE_URL");
const BANK_COUNTRY = config.get("country");

const { PaymentLog } = require("../models/paymentLogs")

const axios = require("axios");

// const flw = new Flutterwave(config.get("publicKey"), config.get("secretKey"));
async function fetchSubaccount(page) {
  let finalResponse = {};
  try {
    const payload = {
      page: flutterwaveId
    };

    const response = await flw.Subaccount.fetch(payload);
    finalResponse = response;
    console.log(response);
  } catch (error) {
    console.log(error);
  }
  return finalResponse;
}

async function createSubaccount(object) {
  let finalResponse = {};
  try {
    const payload = {
      account_bank: object.accountBank,
      account_number: object.accountNumber,
      business_name: object.businessName,
      business_email: object.businessEmail,
      business_contact: "Anonymous",
      business_contact_mobile: object.businessContact,
      business_mobile: object.businessContact,
      country: object.countryAbbrevation,
      meta: [
        {
          meta_name: object.metaName || "",
          meta_value: object.metaValue || ""
        }
      ],
      split_type: config.get("splitType"),
      split_value: config.get("splitValue")
    };

    const response = await flw.Subaccount.create(payload);
    // console.log("response", response)
    finalResponse.status = response.status;
    finalResponse.data = response;
  } catch (error) {
    finalResponse.status = error.status;
    finalResponse.data = error;
    // console.log(error)
  }
  console.log("finalresponse", finalResponse);
  return finalResponse;
}
async function updateSubaccount(object) {
  let finalResponse = {};
  try {
    console.log("wwwwwwww", object.accountBank);
    const payload = {
      id: object.flutterwaveId,
      account_bank: object.accountBank,
      account_number: object.accountNumber,
      business_name: object.businessName,
      business_email: object.businessEmail,
      business_contact: "Anonymous",
      business_contact_mobile: object.businessContact,
      business_mobile: object.businessContact,
      country: object.countryAbbrevation,
      meta: [
        {
          meta_name: object.metaName || "",
          meta_value: object.metaValue || ""
        }
      ],
      split_type: config.get("splitType"),
      split_value: config.get("splitValue")
    };

    const response = await flw.Subaccount.update(payload);

    // console.log("response", response)
    finalResponse.status = response.status;
    finalResponse.data = response;
  } catch (error) {
    finalResponse.status = error.status;
    finalResponse.data = error;
    // console.log(error)
  }
  console.log("finalresponse", finalResponse);
  return finalResponse;
}

async function autoPayout(customerObj) {
  console.log("customerObj:", customerObj);
  let config = {
    method: "post",
    // url: FLUTTER_WAVE_URL + "/transfers/create_bulk",
    url: "https://api.flutterwave.com/v3/transfers",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY },

    data: customerObj
  };
  try {
    let response = await axios(config);
    console.log("function response 11111:", response);

    let paymentLog = new PaymentLog();;
    paymentLog.type = "payout";
    paymentLog.paymentType = "Transfer";
    paymentLog.data = response.data.response.data;
    await paymentLog.save();

    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    // console.log("#####", Ex.response.data);

    // console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex.response };
  }
}
async function retryPayout(id) {
  let config = {
    method: "post",
    // url: FLUTTER_WAVE_URL + "/transfers/create_bulk",
    url: `https://api.flutterwave.com/v3/transfers/${id}/retries`,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
  };
  try {
    let response = await axios(config);
    console.log("function response 3333:", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function retryPayoutVerify(id) {
  let config = {
    method: "get",
    url: `https://api.flutterwave.com/v3/transfers/${id}/retries`,
    // url: `https://api.flutterwave.com/v3/transfers/337790/retries`,

    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
  };
  try {
    let response = await axios(config);
    console.log("function response :", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

async function manualPayout(customerObj) {
  let config = {
    method: "post",
    url: "https://api.flutterwave.com/v3/transfers",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY },

    data: customerObj
  };
  try {
    let response = await axios(config);
    console.log("function response :", response);
    return { statusCode: 200, message: "Success", data: response };
  } catch (Ex) {
    // console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

async function createTransaction(customerObj) {
  let config = {
    method: "post",
    url: FLUTTER_WAVE_URL + "/payments",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY },
    data: customerObj
  };

  try {
    let response = await axios(config);
    console.log("function response :", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function deleteSubaccount(id) {
  console.log("id", id);
  let config = {
    method: "delete",
    url: `https://api.flutterwave.com/v3/subaccounts/${id}`,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
    // data: amount,
  };
  console.log("urrrrlllll", config.url);

  try {
    let response = await axios(config);
    console.log("responseeeee1", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function captureTransaction(data) {
  let amount = {
    amount: data.amount
  };
  let config = {
    method: "post",
    url: FLUTTER_WAVE_URL + "/charges/" + data.id + "/capture",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY },
    data: amount
  };
  console.log("urrrrlllll", config.url);

  try {
    let response = await axios(config);
    console.log("function response :", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function voidTransaction(data) {
  let amount = {
    amount: data.amount
  };
  let config = {
    method: "post",
    url: FLUTTER_WAVE_URL + "/charges/" + data.id + "/void",

    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
    // data: amount,
  };
  console.log("urrrrlllll", config.url);

  try {
    let response = await axios(config);
    console.log("function response void:", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex.response.data);
    console.log("Error Calling createCustomer Api1:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

async function refundTransaction(data) {
  let amount = {
    amount: data.amount
  };
  console.log(data.amount);
  let config = {
    method: "post",
    url: FLUTTER_WAVE_URL + "/transactions/" + data.id + "/refund",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
    // data: amount,
  };

  try {
    let response = await axios(config);
    console.log("function response :", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function getRefundById(id) {
  let config = {
    method: "GET",
    url: FLUTTER_WAVE_URL + "/refunds/" + id,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
  };

  try {
    let response = await axios(config);
    console.log("function response :", response);
    console.log("response.data", response.data);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function verifyTransaction(reference) {
  let config = {
    method: "get",
    url: FLUTTER_WAVE_URL + "/transactions/" + reference + "/verify",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
  };

  console.log(config);
  try {
    let response = await axios(config);
    console.log("function response :", response);
    console.log("response verify:", response.data);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

async function chargeWithToken(dataObj) {
  let config = {
    method: "post",
    url: FLUTTER_WAVE_URL + "/tokenized-charges",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY },
    data: dataObj
  };

  try {
    let response = await axios(config);
    console.log("function response :", response);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}
async function fetchSubaccount(i) {
  let config = {
    method: "get",
    url: FLUTTER_WAVE_URL + "/subaccounts",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY },
    data: { page: i }
  };

  try {
    let response = await axios(config);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

async function getAllBanks() {
  let config = {
    method: "get",
    url: FLUTTER_WAVE_URL + "/banks/" + BANK_COUNTRY,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + FLUTTER_SECRET_KEY }
    // data: { page: i }
  };

  try {
    let response = await axios(config);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

// const bank_trf = async () => {
// async function payDriver(object) {
//   try {
//     const payload = {
//       tx_ref: object.tx_ref,
//       amount: object.amount,
//       email: object.email,
//       phone_number: object.mobile,
//       currency: "NGN",
//       client_ip: "154.123.220.1",
//       device_fingerprint: "62wd23423rq324323qew1",
//       subaccounts: [
//         {
//           id: object.flutterwaveId,
//         },
//       ],
//       duration: 1,
//       frequency: 5,
//       narration: "All star college salary for May",
//       is_permanent: 1,
//     };

//     const response = await flw.Charge.bank_transfer(payload);
//     console.log(response);
//   } catch (error) {
//     console.log(error);
//   }
// }

module.exports.createSubaccount = createSubaccount;
module.exports.fetchSubaccount = fetchSubaccount;
module.exports.createTransaction = createTransaction;
module.exports.refundTransaction = refundTransaction;
module.exports.getRefundById = getRefundById;
module.exports.verifyTransaction = verifyTransaction;
module.exports.chargeWithToken = chargeWithToken;
module.exports.captureTransaction = captureTransaction;
module.exports.autoPayout = autoPayout;
module.exports.retryPayout = retryPayout;
module.exports.retryPayoutVerify = retryPayoutVerify;
module.exports.voidTransaction = voidTransaction;
module.exports.getAllBanks = getAllBanks;
module.exports.manualPayout = manualPayout;
module.exports.updateSubaccount = updateSubaccount;
module.exports.deleteSubaccount = deleteSubaccount;
module.exports.retryPayout = retryPayout;
