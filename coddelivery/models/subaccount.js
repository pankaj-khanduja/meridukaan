const mongoose = require("mongoose");
// const { createSubaccount, updateSubaccount, fetchSubaccount } = require("../services/flutterWave");
const Joi = require("joi");
const { createFundAccountForContact } = require("../services/razorPayFunctions");
const { createSubMerchant } = require("../services/payu");
// const config = require("config");
// const { SUBACCOUNT_CONSTANTS } = require("../config/constant");
// Joi.objectId = require("joi-objectid")(Joi);
const subaccountSchema = new mongoose.Schema({
    subaccountId: String,
    userId: String,
    role: String,
    last4Digits: String,
    accountNumber: String,
    ifsc: String,
    name: String,
    pancardNumber: String,
    pancardName: String,
    businessCategoryId: Number,
    businessEntityId: Number,
    gstNumber: String,
    monthlyExpectedVolume: Number,
    businessName: String,
    holderName: String,
    childMerchantId: String,
    accountBank: String,
    bankName: String,
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive", "deleted"], default: "active" },
    insertDate: {
        type: Number,
        default: () => {
            return Math.round(new Date() / 1000);
        },
    },
    creationDate: {
        type: Date,
        default: () => {
            return new Date();
        },
    },
});
const Subaccount = mongoose.model("Subaccount", subaccountSchema);
async function postSubaccount(payload) {
    // const { name, email, businessEntityId, pancardNumber,
    //     pancardName, businessCategoryId, businessSubCategoryId, gstNumber,
    //     monthlyExpectedVolume, businessName, accountNumber, holderName, ifsc, role } = payload
    const {
        accountBank,
        bankName,
        accountNumber,
        user,
        countryAbbrevation,
        meta,
        role
    } = payload
    // const user = payload.user
    // let account = await createSubMerchant({
    //     name,
    //     email,
    //     businessEntityId,
    //     pancardNumber,
    //     pancardName,
    //     businessCategoryId,
    //     businessSubCategoryId,
    //     gstNumber,
    //     monthlyExpectedVolume,
    //     businessName,
    //     accountNumber,
    //     holderName,
    //     ifsc
    // })
    let data = {};
    let newSubaccount;
    let subaccount;
    // console.log("account", account);
    // if (account.statusCode != 200) {
    // if (account.data.message == SUBACCOUNT_CONSTANTS.SUBACCOUNT_ALREADY_EXISTS) {
    //     subaccount = await Subaccount.findOne({ accountNumber: accountNumber, userId: user._id.toString() });
    //     if (subaccount) {
    //         console.log("yyyyyyyyyyy");
    //         subaccount.status = "active";
    //         subaccount.isDefault = true;
    //         await subaccount.save();
    //         await Subaccount.updateMany({ userId: subaccount.userId, _id: { $ne: subaccount._id } }, { $set: { isDefault: false } });
    //         data.accountCreated = true;
    //         return data;
    //     } else {
    //         let last4Digits = accountNumber.substr(accountNumber.length - 4);
    //         subaccount = await Subaccount.findOne({ accountNumber: accountNumber });

    //         newSubaccount = new Subaccount({});

    //         newSubaccount.flutterwaveId = subaccount.flutterwaveId;
    //         newSubaccount.subaccountId = subaccount.subaccountId;
    //         newSubaccount.userId = user._id;
    //         newSubaccount.role = role;
    //         newSubaccount.isDefault = true;
    //         newSubaccount.last4Digits = last4Digits;
    //         newSubaccount.accountNumber = accountNumber;
    //         newSubaccount.accountBank = accountBank;
    //         newSubaccount.bankName = bankName;
    //         await newSubaccount.save();

    //         await Subaccount.updateMany({ userId: newSubaccount.userId, _id: { $ne: newSubaccount._id } }, { $set: { isDefault: false } });
    //         data.accountCreated = true;
    //         return data;
    //     }
    // } else {
    // data.accountCreated = false;
    // data.message = account.data || "Razorpay error";
    // return data;
    // }
    // }
    let last4Digits = accountNumber.substr(accountNumber.length - 4);
    newSubaccount = new Subaccount({});
    // newSubaccount.flutterwaveId = account.data.data.id;
    // newSubaccount.subaccountId = account.data.uuid;
    // newSubaccount.childMerchantId = account.data.mid // MID of Child merchant;

    newSubaccount.userId = user._id;
    newSubaccount.role = role;
    newSubaccount.isDefault = true;
    newSubaccount.last4Digits = last4Digits;
    newSubaccount.accountNumber = accountNumber;
    newSubaccount.accountNumber = accountNumber;
    // newSubaccount.ifsc = ifsc;
    newSubaccount.name = user.name;
    newSubaccount.accountBank = accountBank;
    newSubaccount.bankName = bankName;
    newSubaccount.countryAbbrevation = countryAbbrevation;

    await newSubaccount.save();

    await Subaccount.updateMany({ userId: newSubaccount.userId, _id: { $ne: newSubaccount._id } }, { $set: { isDefault: false } });
    data.accountCreated = true;
    return data;
}

// async function postSubaccount(accountBank, bankName, accountNumber, user, countryAbbrevation, meta, role) {
//   let object = {
//     accountBank: accountBank,
//     accountNumber: accountNumber,
//     businessName: user.name || user.firstName,
//     businessEmail: user.email || user.email,
//     businessContact: user.mobile,
//     countryAbbrevation: countryAbbrevation,
//   };
//   if (meta) {
//     object.meta = meta;
//   }

//   let account = await createSubaccount(object);
//   let data = {};
//   let newSubaccount;
//   let subaccount;
//   console.log("account", account);
//   if (account.status !== "success") {
//     if (account.data.message == SUBACCOUNT_CONSTANTS.SUBACCOUNT_ALREADY_EXISTS) {
//       subaccount = await Subaccount.findOne({ accountNumber: accountNumber, userId: user._id.toString() });
//       if (subaccount) {
//         console.log("yyyyyyyyyyy");
//         subaccount.status = "active";
//         subaccount.isDefault = true;
//         await subaccount.save();
//         await Subaccount.updateMany({ userId: subaccount.userId, _id: { $ne: subaccount._id } }, { $set: { isDefault: false } });
//         data.accountCreated = true;
//         return data;
//       } else {
//         let last4Digits = accountNumber.substr(accountNumber.length - 4);
//         subaccount = await Subaccount.findOne({ accountNumber: accountNumber });

//         newSubaccount = new Subaccount({});

//         newSubaccount.flutterwaveId = subaccount.flutterwaveId;
//         newSubaccount.subaccountId = subaccount.subaccountId;
//         newSubaccount.userId = user._id;
//         newSubaccount.role = role;
//         newSubaccount.isDefault = true;
//         newSubaccount.last4Digits = last4Digits;
//         newSubaccount.accountNumber = accountNumber;
//         newSubaccount.accountBank = accountBank;
//         newSubaccount.bankName = bankName;
//         await newSubaccount.save();

//         await Subaccount.updateMany({ userId: newSubaccount.userId, _id: { $ne: newSubaccount._id } }, { $set: { isDefault: false } });
//         data.accountCreated = true;
//         return data;
//       }
//     } else {
//       data.accountCreated = false;
//       data.message = account.data.message || "FlutterWave failure";
//       return data;
//     }
//   }
//   let last4Digits = accountNumber.substr(accountNumber.length - 4);

//   newSubaccount = new Subaccount({});
//   newSubaccount.flutterwaveId = account.data.data.id;
//   newSubaccount.subaccountId = account.data.data.subaccount_id;
//   newSubaccount.userId = user._id;
//   newSubaccount.role = role;
//   newSubaccount.isDefault = true;
//   newSubaccount.last4Digits = last4Digits;
//   newSubaccount.accountNumber = accountNumber;
//   newSubaccount.accountBank = accountBank;
//   newSubaccount.bankName = bankName;
//   await newSubaccount.save();

//   await Subaccount.updateMany({ userId: newSubaccount.userId, _id: { $ne: newSubaccount._id } }, { $set: { isDefault: false } });
//   data.accountCreated = true;
//   return data;
// }

async function newSubaccount(flutterwaveId, subaccountId, userId, lastFourDigits, accountNumber, bankName, role) {
    let subaccount = new Subaccount({});
    subaccount.flutterwaveId = flutterwaveId;
    subaccount.subaccountId = subaccountId;
    subaccount.userId = userId;
    subaccount.role = role;
    subaccount.isDefault = true;
    subaccount.last4Digits = lastFourDigits;
    subaccount.accountNumber = accountNumber;
    subaccount.bankName = bankName;
    await subaccount.save();

    await Subaccount.updateMany({ userId: subaccount.userId, _id: { $ne: subaccount._id } }, { $set: { isDefault: false } });
}
async function getSubaccount(criteria) {
    let subaccount = await Subaccount.aggregate([
        {
            $match: criteria,
        },
        {
            $project: {
                // subaccountId: 1,
                accountId: "$_id",
                _id: 0,
                isDefault: 1,
                status: 1,
                // flutterwaveId: 1,
                userId: 1,
                role: 1,
                last4Digits: 1,
                bankName: 1,
            },
        },
    ]);
    return subaccount;
}
async function setDefaultSubaccount(accountId, userId) {
    let subaccount = await Subaccount.findOne({ _id: accountId, userId: userId });
    if (!subaccount) {
        return false;
    }
    subaccount.isDefault = true;
    await subaccount.save();
    await Subaccount.updateMany({ userId: subaccount.userId, _id: { $ne: subaccount._id } }, { $set: { isDefault: false } });
    return true;
}

function validateBankDetails(req) {
    const schema = Joi.object({
        name: Joi.string(),
        email: Joi.string(),
        mobile: Joi.string(),
        pancardNumber: Joi.string(),
        pancardName: Joi.string(),
        businessCategoryId: Joi.number(),
        businessSubCategoryId: Joi.number(),
        businessEntityId: Joi.number(),
        gstNumber: Joi.string(),
        monthlyExpectedVolume: Joi.number(),
        businessName: Joi.string(),
        accountNumber: Joi.string().required(),
        holderName: Joi.string(),
        password: Joi.string().required(),
        ifsc: Joi.string().required(),
        isPaymentGatewayIntegrated: Joi.boolean(),
        // accountBank: Joi.string().required(),
        // bankName: Joi.string(),
        // countryAbbrevation: Joi.string().required(),
        // metaData: Joi.array(),
    });
    return schema.validate(req);
}
function validateSetDefaultSubaccount(req) {
    const schema = Joi.object({
        accountId: Joi.objectId().required(),
    });
    return schema.validate(req);
}
exports.Subaccount = Subaccount;
exports.newSubaccount = newSubaccount;
exports.getSubaccount = getSubaccount;
exports.postSubaccount = postSubaccount;
exports.validateBankDetails = validateBankDetails;
exports.validateSetDefaultSubaccount = validateSetDefaultSubaccount;
exports.setDefaultSubaccount = setDefaultSubaccount;
