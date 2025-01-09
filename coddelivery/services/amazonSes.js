const aws = require("aws-sdk");
const config = require("config");
const winston = require("winston");
const { sendLogEmail, sendFiveHundredLogEmail } = require("../services/htmlTemplateFile");
const { formatter } = require("../services/commonFunctions");
const { EmailLog } = require("../models/emailLog");

// aws.config.update({
//   secretAccessKey: "Pq+5O2h9tjzThV8cf/gFZI4UT60eWM77J2Qa8A8w",
//   accessKeyId: "AKIARQTORDLLSU74VEFC",
//   region: "us-east-2",
// });
aws.config.update({
  secretAccessKey: config.get("S3_SECRET_KEY"),
  accessKeyId: config.get("S3_ACCESS_KEY"),
  region: config.get("S3_BUCKET_REGION"),
});
const ses = new aws.SES();

async function sendLogMail(email, responseData, fiveHundredData, errorCount) {
  // if (username) text = `Hey ${username}, your OTP is ${otp}.`;
  console.log("check :", config.get("environment"));
  let sendData = {
    errorCount: errorCount,
    data: responseData,
    fiveHundredData: fiveHundredData,
    totalFiveHundredError: fiveHundredData.length,
  };
  const temp = formatter(sendLogEmail, sendData);
  const msg = {
    Destination: {
      ToAddresses: email, // Email address/addresses that you want to send your email
    },
    Message: {
      Body: {
        Html: {
          // HTML Format of the email
          Charset: "UTF-8",
          Data: temp,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: config.get("environment") + " " + config.get("email_sendgrid.logs"),
      },
    },
    Source: "support@waivedelivery.com",
  };
  try {
    const result = await ses.sendEmail(msg).promise();
    winston.info(`Sending of Email to ${email} success with status code: ${result.MessageId}.`);
    return { MessageId: result.MessageId };
  } catch (Ex) {
    winston.error(`Sending of Email failed for ${email} with errorcode: ${Ex.code}: ${Ex.message}.`);
    return { code: Ex.code, message: Ex.message };
  }
}

async function sendOrderDetailLogsMail(email, data, subject) {
  // if (username) text = `Hey ${username}, your OTP is ${otp}.`;
  console.log("check :", config.get("environment"));
  // let sendData = {
  //   errorCount: errorCount,
  //   data: responseData,
  //   fiveHundredData: fiveHundredData,
  //   totalFiveHundredError: fiveHundredData.length,
  // };
  // const temp = formatter(sendLogEmail, sendData);
  const msg = {
    Destination: {
      ToAddresses: email, // Email address/addresses that you want to send your email
    },
    Message: {
      Body: {
        Html: {
          // HTML Format of the email
          Charset: "UTF-8",
          Data: data,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: config.get("environment") + " " + config.get("email_sendgrid.logs"),
      },
    },
    Source: "support@waivedelivery.com",
  };
  try {
    const result = await ses.sendEmail(msg).promise();
    winston.info(`Sending of Email to ${email} success with status code: ${result.MessageId}.`);
    return { MessageId: result.MessageId };
  } catch (Ex) {
    winston.error(`Sending of Email failed for ${email} with errorcode: ${Ex.code}: ${Ex.message}.`);
    return { code: Ex.code, message: Ex.message };
  }
}

async function sendTemplateEmail(email, data, template) {
  // if (username) text = `Hey ${username}, your OTP is ${otp}.`;
  let msg = {
    Source: "Waive app<support@waivedelivery.com>",
    Template: template,
    Destination: {
      ToAddresses: [email],
    },
    TemplateData: JSON.stringify(data),
  };
  try {
    const result = await ses.sendTemplatedEmail(msg).promise();
    winston.info(`Sending of Email to ${email} success with status code: ${result.MessageId}.`);
    emailLog = new EmailLog({
      email: email,
      template: template,
      data: data,
      messageId: result.MessageId,
      status: "success",
    });
    await emailLog.save();
    return { MessageId: result.MessageId };
  } catch (Ex) {
    winston.error(`Sending of Email failed for ${email} with errorcode: ${Ex.code}: ${Ex.message}.`);
    emailLog = new EmailLog({
      email: email,
      template: template,
      data: data,
      errorcode: Ex.code,
      errorMessage: Ex.message,
      status: "failure",
    });
    await emailLog.save();
    return { code: Ex.code, message: Ex.message };
  }
}

async function sendFiveHundredMail(email, fiveHundredData) {
  let sendData = {
    fiveHundredData: fiveHundredData,
    totalFiveHundredError: fiveHundredData.length,
  };
  const temp = formatter(sendFiveHundredLogEmail, sendData);
  const msg = {
    Destination: {
      ToAddresses: email, // Email address/addresses that you want to send your email
    },
    Message: {
      Body: {
        Html: {
          // HTML Format of the email
          Charset: "UTF-8",
          Data: temp,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: config.get("environment") + " 500  " + config.get("email_sendgrid.logs"),
      },
    },
    Source: "support@waivedelivery.com",
  };
  try {
    const result = await ses.sendEmail(msg).promise();
    winston.info(`Sending of Email to ${email} success with status code: ${result.MessageId}.`);
    return { MessageId: result.MessageId };
  } catch (Ex) {
    winston.error(`Sending of Email failed for ${email} with errorcode: ${Ex.code}: ${Ex.message}.`);
    return { code: Ex.code, message: Ex.message };
  }
}
exports.sendLogMail = sendLogMail;
exports.sendFiveHundredMail = sendFiveHundredMail;
exports.sendTemplateEmail = sendTemplateEmail;
exports.sendOrderDetailLogsMail = sendOrderDetailLogsMail;
