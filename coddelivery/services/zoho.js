// const Flutterwave = require("flutterwave-node-v3");
const config = require("config");
const { ZohoAuth } = require("../models/zohoAuth");

const zoho_client_id = config.get("zoho_client_id");
const zoho_client_secret = config.get("zoho_client_secret");
const zoho_redirect_uri = config.get("zoho_redirect_uri");
const zoho_refresh_token = config.get("zoho_refresh_token");
const axios = require("axios");

// async function authorizationRequest() {
//   let config = {
//     method: "get",
//     url:
//       "https://accounts.zoho.com/oauth/v2/auth?client_id=" +
//       zoho_client_id +
//       "&response_type=code&scope=ZohoCRM.modules.ALL&redirect_uri=" +
//       zoho_redirect_uri,
//     headers: { "Content-Type": "application/json" }
//   };

//   try {
//     let response = await axios(config);
//     return { statusCode: 200, message: "Success", data: response.data };
//   } catch (Ex) {
//     console.log("Error Calling createCustomer Api:", Ex);
//     return { statusCode: 400, message: "Success", data: Ex };
//   }
// }

async function accessTokenRequest(code) {
  console.log("accessTokenRequest :");
  let config = {
    method: "post",
    url:
      "https://accounts.zoho.com/oauth/v2/token?client_id=" +
      zoho_client_id +
      "&grant_type=refresh_token&client_secret=" +
      zoho_client_secret +
      "&refresh_token=" +
      zoho_refresh_token,
    headers: { "Content-Type": "application/json" }
  };
  try {
    let response = await axios(config);
    if (response.status == 200) {
      let auth = await ZohoAuth.findOne();
      if (!auth) {
        let auth = new ZohoAuth({
          accessToken: response.data.access_token,
          tokenType: response.data.token_type
        });
        await auth.save();
      } else {
        await ZohoAuth.updateOne({ _id: auth._id }, { $set: { accessToken: response.data.access_token } });
      }
    }
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

async function createLeads(customerObj, token) {
  console.log("accessTokenRequest :");
  let config = {
    method: "post",
    url: "https://www.zohoapis.com/crm/v2/Leads",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    data: customerObj
  };
  try {
    let response = await axios(config);
    return { statusCode: 200, message: "Success", data: response.data };
  } catch (Ex) {
    console.log("Error Calling createCustomer Api:", Ex);
    return { statusCode: 400, message: "Success", data: Ex };
  }
}

module.exports.accessTokenRequest = accessTokenRequest;
module.exports.createLeads = createLeads;
