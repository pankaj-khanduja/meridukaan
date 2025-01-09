const axios = require("axios");
const Razorpay = require("razorpay");
const express = require("express");
const config = require("config");

// TODO :- To add razorpay credentials on config file, and fetch these credentials from there in future
const key_id = config.get("KeyId");
const key_secret = config.get("secretkey");
const basicAuthToken = `Basic ${Buffer.from(key_id + ':' + key_secret).toString('base64')}`
var instance = new Razorpay({ key_id: key_id, key_secret: key_secret });

//creating customer i.e. user
async function createCustomer(user, flag) {
  let finalResponse = {};
  const payload = {
    name: user.firstName + ' ' + user.lastName,
    contact: user.mobile,
    email: user.email,
    fail_existing: flag,
    notes: {
      notes_key_1: "Tea, Earl Grey, Hot",
      notes_key_2: "Tea, Earl Grey… decaf.",
    },
  }
  try {
    let response = await instance.customers.create(payload);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error)
  }

  return finalResponse;
}
//create contact i.e. vendor
async function createContact(payload) {
  let finalResponse = {};
  try {
    const apiUrl = 'https://api.razorpay.com/v1/contacts';
    const data = {
      name: payload.name,
      email: payload.email,
      contact: payload.phone,
      type: "vendor",
      reference_id: payload._id
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuthToken
      }
    };

    let response = await axios.post(apiUrl, data, config)
    response = response.data
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
    console.log("response", finalResponse);
  } catch (error) {
    let { status = 400, data } = error.response
    finalResponse.statusCode = status;
    finalResponse.message = "Failure";
    finalResponse.data = data.error.description;
    console.log("error", error);

  }
  return finalResponse;
}
/// create fundAccount for vendor (where payouts wil be done)
async function createFundAccountForContact(payload) {
  let finalResponse = {};
  try {
    const apiUrl = 'https://api.razorpay.com/v1/fund_accounts';
    const data = {
      contact_id: payload.contactId,
      account_type: 'bank_account',
      bank_account: {
        name: payload.name,
        ifsc: payload.ifsc,
        account_number: payload.accountNumber
      }
    };
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuthToken
      }
    };
    let response = await axios.post(apiUrl, data, config)
    response = response.data
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
    console.log("response", finalResponse);
  } catch (error) {
    let { status = 400, data } = error.response
    finalResponse.statusCode = status;
    finalResponse.message = "Failure";
    finalResponse.data = data.error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function updateCustomer(customerId, updateObject) {
  let finalResponse = {};
  try {
    // let response = await instance.customers.edit(customerId, ({
    //     name: "Gaurav sharma",
    //     contact: 9123456780,
    //     email: "gaurav.kumar@example.com",

    // }));
    let response = await instance.customers.edit(customerId, updateObject);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
    // console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function getAllCustomer(option) {
  let finalResponse = {};
  try {
    let response = await instance.customers.all(option);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error)
  }

  return finalResponse;
  // // remove this fundtion options for ron this function show Allcustomer
}
// console.log(customerId,"customerId...............");
async function fatchCustomerById(customerId) {



  let finalResponse = {};
  try {
    let response = await instance.customers.fetch(customerId);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error)
  }
  return finalResponse;
}
//////// functions of orders ///
async function createOrders(orders) {
  let finalResponse = {};
  try {
    let response = await instance.orders.create({
      amount: "a",
      currency: "INR",
      receipt: "receipt#1",
      notes: {
        key1: "value3",
        key2: "value2",
      },
    });

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
    // console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    // console.log("error", error)
  }
  return finalResponse;
}
async function getAllOrders(option) {
  let finalResponse = {};
  try {
    let response = await instance.orders.all(option);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", response);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }

  return finalResponse;
  // // remove this fundtion options for ron this function show Allcustomer
}
async function fatchOrderById(orderId) {
  let finalResponse = {};
  try {
    let response = await instance.orders.fetch(orderId);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    // console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    // console.log("error", error)
  }
  return finalResponse;
}
async function fatchPaymentByOrderId(orderId) {
  let finalResponse = {};
  try {
    let response = await instance.orders.fetchPayments(orderId);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", response);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function updateOrderNote() {
  let finalResponse = {};
  try {
    // let response = await instance.customers.edit(customerId, ({
    //     name: "Gaurav sharma",
    //     contact: 9123456780,
    //     email: "gaurav.kumar@example.com",

    // }));
    let response = await instance.orders.edit({
      notes: {
        key1: "value3",
        key2: "value2",
      },
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
    // console.log("response", response)
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
//////////functions for payments
async function createPaymentLink(chargeObject) {

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const expire_by = currentTimestamp + 16 * 60;
  console.log(expire_by, "expire_by")
  console.log(config.get("apiBaseURl"), "testttttttttttttttt")
  console.log({
    key_id: config.get("KeyId"),
    key_secret: config.get("secretkey"),
    env: config.get("environment")
  })

  let finalResponse = {};
  try {
    let response = await instance.paymentLink.create({
      amount: Math.round(chargeObject.amount * 100),
      currency: "INR",
      accept_partial: false,
      // first_min_partial_amount: 100,
      description: 'Daarlo Payment for orderNo ' + chargeObject.orderNo,
      callback_url: chargeObject.callback_url,
      callback_method: "get",
      customer: {
        name: chargeObject.name,
        email: chargeObject.email,
        contact: chargeObject.mobile,
      },
      notify: {
        sms: true,
        email: true,
      },
      notes: {
        policy_name: "Daarlo"
      },
      expire_by: expire_by,
      reminder_enable: true,
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
////// refund payments
async function refundTransaction(data) {
  let finalResponse = {};
  try {
    let response = await instance.payments.refund(data.paymentId, {
      amount: data.amount,
      speed: "optimum", // for instant refund if in case you not choose instant then changes speed to normal
      notes: {
        "notes_key_1": "Beam me up Scotty.",
        "notes_key_2": "Engage"
      },
      receipt: data.orderId

    })
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;

}
// check refund status 
async function checkRefundTransaction(data) {

  let finalResponse = {};
  try {
    let response = await instance.payments.fetchRefund(data.paymentId, data.refundId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function fatchPaymentLink() {
  let finalResponse = {};
  try {
    let response = await instance.paymentLink.all();
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function paymentLinkById(paymentLinkId) {
  let finalResponse = {};
  try {
    let response = await instance.paymentLink.fetch(paymentLinkId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function sendOrResendNotification() {
  let finalResponse = {};
  try {
    let response = await instance.paymentLink.notifyBy(paymentLinkId, medium);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function updatePaymentLink() {
  let finalResponse = {};
  try {
    let response = await instance.paymentLink.edit({
      reference_id: "TS35",
      expire_by: 1653347540,
      reminder_enable: false,
      notes: {
        policy_name: "Jeevan Saral",
      },
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function cancelPaymentLink() {
  let finalResponse = {};
  try {
    let response = await instance.paymentLink.cancel(paymentLinkId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function capturePayments({ paymentId, amount, currency }) {
  let finalResponse = {};
  try {
    let response = await instance.payments.capture(paymentId, amount, currency);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
//////////////////////////Customize Payment Methods
//////////customizing  payment methods shown on checkout
///////originals vs customized checkout
/////////////Request parameters
async function createPaymentLinkApi() {
  let finalResponse = {};
  try {
    let response = await instance.paymentLink.create({
      amount: 500,
      currency: "INR",
      accept_partial: true,
      first_min_partial_amount: 100,
      description: "For XYZ purpose",
      customer: {
        name: "Gaurav Kumar",
        email: "gaurav.kumar@example.com",
        contact: '9765432190',
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      options: {
        checkout: {
          method: {
            netbanking: 1,
            card: 1,
            upi: 0,
            wallet: 0,
          },
        },
      },
    });

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
/////////////////
// axios({
//     url: 'https://checkout.razorpay.com/v1/checkout.js',
//     method: 'get',
//     data: {
//         foo: 'bar'
//     }
// })
async function checkoutRazorpay() {
  let finalResponse = {};
  try {
    let conf = {
      method: "POST",
      url: "https://checkout.razorpay.com/v1/checkout.js",
      headers: { "Content-Type": "application/json" },
      data: { "receipt-data": `${subscription.ReceiptData}`, password: config.get("password") },
    };

    let response = await axios(conf);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
// let response = await axios(conf);

// let conf = {
//     method: "POST",
//     url: 'https://checkout.razorpay.com/v1/checkout.js',
//     headers: { "Content-Type": "application/json" },
//     data: { "receipt-data": `${subscription.ReceiptData}`, password: config.get("password") },
// };

//////////////////////////////create subscription plan
async function createSubscriptionPlan() {
  let finalResponse = {};
  try {
    let response = await instance.plans.create({
      period: "yearly",
      interval: 1,
      item: {
        name: "Test plan - Weekly",
        amount: 1000,
        currency: "INR",
        description: "Description for the test plan"
      },
      notes: {
        notes_key_1: "Tea, Earl Grey, Hot",
        notes_key_2: "Tea, Earl Grey… decaf."
      }
    })

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function fetchAllSubscriptionPlan(options) {

  let finalResponse = {};

  try {

    let response = await instance.plans.all(options);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    console.log("response", finalResponse.data.items);




  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;


}
async function fetchOneSubscriptionPlan(planId) {

  let finalResponse = {};

  try {
    let response = await instance.plans.fetch(planId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function createSubscription() {

  let finalResponse = {};

  try {
    let response = await instance.subscriptions.create({
      plan_id: "plan_LH69vyH4MCkm80",
      customer_notify: 1,
      quantity: 5,
      total_count: 6,
      start_at: 1676633824,
      addons: [
        {
          item: {
            name: "Delivery charges",
            amount: 30000,
            currency: "INR"
          }
        }
      ],
      notes: {
        key1: "value3",
        key2: "value2"
      }
    })

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function createSubscriptionLink() {

  let finalResponse = {};

  try {
    let response = await instance.subscriptions.create({
      plan_id: "plan_LH69vyH4MCkm80",
      total_count: 12,
      quantity: 1,
      expire_by: 1676806624,
      customer_notify: 1,
      addons: [
        {
          item: {
            name: "Delivery charges",
            amount: 30000,
            currency: "INR"
          }
        }
      ],
      notes: {
        notes_key_1: "Tea, Earl Grey, Hot",
        notes_key_2: "Tea, Earl Grey… decaf."
      },
      notify_info: {
        notify_phone: 9878676544331,
        notify_email: "sahil.zimble@gmail.com"
      }
    })

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function fetchAllSubscription(options) {

  let finalResponse = {};

  try {

    let response = await instance.subscriptions.all(options);

    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    console.log("response", finalResponse.data.items);




  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;


}
async function fetchOneSubscription(subscriptionId) {

  let finalResponse = {};

  try {
    let response = await instance.subscriptions.fetch(subscriptionId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function cancelSubscription(subscriptionId, options) {

  let finalResponse = {};

  try {
    let response = await instance.subscriptions.cancel(subscriptionId, options);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;
}
async function updateSubscription(subscriptionId, options) {

  let finalResponse = {};

  try {
    let response = await instance.subscriptions.update(subscriptionId, options);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;

}
let options = {
  customer_notify: 0,
}
//////add merchant bank account on boarding  
async function addBankAccount() {


  let finalResponse = {};
  try {
    let response = await instance.accounts.create({
      "email": "gauriagain.kumar@example.org",
      "phone": "9000090000",
      "legal_business_name": "Acme Corp",
      "business_type": "partnership",
      "customer_facing_business_name": "Example",
      "profile": {
        "category": "healthcare",
        "subcategory": "clinic",
        "description": "Healthcare E-commerce platform",
        "addresses": {
          "operation": {
            "street1": "507, Koramangala 6th block",
            "street2": "Kormanagala",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": 560047,
            "country": "IN"
          },
          "registered": {
            "street1": "507, Koramangala 1st block",
            "street2": "MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": 560034,
            "country": "IN"
          }
        },
        "business_model": "Online Clothing ( men, women, ethnic, modern ) fashion and lifestyle, accessories, t-shirt, shirt, track pant, shoes."
      },
      "legal_info": {
        "pan": "AAACL1234C",
        "gst": "18AABCU9603R1ZM"
      },
      "brand": {
        "color": "FFFFFF"
      },
      "notes": {
        "internal_ref_id": "123123"
      },
      "contact_name": "Gaurav Kumar",
      "contact_info": {
        "chargeback": {
          "email": "cb@example.org"
        },
        "refund": {
          "email": "cb@example.org"
        },
        "support": {
          "email": "support@example.org",
          "phone": "9999999998",
          "policy_url": "https://www.google.com"
        }
      },
      "apps": {
        "websites": [
          "https://www.example.org"
        ],
        "android": [
          {
            "url": "playstore.example.org",
            "name": "Example"
          }
        ],
        "ios": [
          {
            "url": "appstore.example.org",
            "name": "Example"
          }
        ]
      }
    })
    console.log(response, "response");
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;

    console.log("response", finalResponse);
    // console.log("response", finalResponse.data.items);

  } catch (error) {
    finalResponse.statusCode = error.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = error.description;
    console.log("error", error);
  }
  return finalResponse;


}
module.exports.capturePayments = capturePayments;
module.exports.cancelPaymentLink = cancelPaymentLink;
module.exports.updatePaymentLink = updatePaymentLink;
module.exports.sendOrResendNotification = sendOrResendNotification;
module.exports.paymentLinkById = paymentLinkById;
module.exports.fatchPaymentLink = fatchPaymentLink;
module.exports.createPaymentLink = createPaymentLink;
module.exports.updateOrderNote = updateOrderNote;
module.exports.fatchOrderById = fatchOrderById;
module.exports.getAllOrders = getAllOrders;
module.exports.createOrders = createOrders;
module.exports.fatchCustomerById = fatchCustomerById;
module.exports.createCustomer = createCustomer;
module.exports.updateCustomer = updateCustomer;
module.exports.createContact = createContact;
module.exports.createFundAccountForContact = createFundAccountForContact;
module.exports.createPaymentLinkApi = createPaymentLinkApi;
module.exports.refundTransaction = refundTransaction;
module.exports.checkRefundTransaction = checkRefundTransaction;

