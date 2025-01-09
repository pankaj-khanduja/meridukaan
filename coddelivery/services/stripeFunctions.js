const config = require("config");
const STRIPE_KEY = config.get("STRIPE_KEY");
const stripe = require("stripe")(STRIPE_KEY);

// console.log("ssde", STRIPE_KEY);

async function createCharge(chargeObject) {
  let finalResponse = {};
  try {
    response = await stripe.charges.create({
      amount: chargeObject.amount, // amount in cents
      currency: chargeObject.currency,
      customer: chargeObject.customer,
      source: chargeObject.source,
      description: chargeObject.description,
      metadata: chargeObject.metadata
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    console.log(Ex);
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

async function createCustomer(customerObject) {
  let finalResponse = {};
  try {
    response = await stripe.customers.create({
      source: customerObject.stripeToken,
      email: customerObject.email,
      phone: customerObject.mobile,
      description: customerObject.description,
      metadata: customerObject.metadata
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    console.log(Ex);
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

async function createCustomerSource(customerId, token) {
  let finalResponse = {};
  console.log("custId", customerId, token);
  try {
    response = await stripe.customers.createSource(customerId, {
      source: token
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    console.log(Ex);
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

async function getCustomer(customerId) {
  let finalResponse = {};
  try {
    response = await stripe.customers.retrieve(customerId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    console.log(Ex);
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

async function updateCustomer(customerObject) {
  let finalResponse = {};
  try {
    response = await stripe.customers.update(customerObject.customerId, {
      source: customerObject.stripeToken,
      email: customerObject.email,
      phone: customerObject.mobile,
      description: customerObject.description
    });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

async function setAsDefaultPaymentMethod(customerId, paymentMethodId) {
  let finalResponse = {};
  try {
    response = await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

async function deleteCard(customerId, cardId) {
  let finalResponse = {};
  try {
    let response = await stripe.customers.deleteSource(customerId, cardId);
  } catch (Ex) {
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = response;
  }
  return finalResponse;
}

async function deleteCustomer(customerId) {
  let finalResponse = {};
  try {
    let response = await stripe.customers.del(customerId);
    finalResponse.statusCode = 200;
    finalResponse.message = "Success";
    finalResponse.data = response;
  } catch (Ex) {
    finalResponse.statusCode = Ex.statusCode;
    finalResponse.message = "Failure";
    finalResponse.data = Ex.message;
  }
  return finalResponse;
}

module.exports.createCharge = createCharge;
module.exports.createCustomerSource = createCustomerSource;
module.exports.createCustomer = createCustomer;
module.exports.getCustomer = getCustomer;
module.exports.deleteCard = deleteCard;
module.exports.setAsDefaultPaymentMethod = setAsDefaultPaymentMethod;
module.exports.updateCustomer = updateCustomer;
module.exports.deleteCustomer = deleteCustomer;
