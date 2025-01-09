const Joi = require("joi");
const mongoose = require("mongoose");
const auditLogSchema = new mongoose.Schema({
  actionOn: { type: String, enum: ["feesAndLimit", "coupon", "influencer", "vendor"] },
  recordId: String,
  userId: String,
  email: String,
  userRole: { type: String, enum: ["vendor", "admin", "user"] },
  typeOfAction: { type: String, enum: ["update", "create", "delete"] },
  updatedData: Object,
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    },
  },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    },
  },
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

async function createAuditLog(actionOn, recordId, userId, userRole, typeOfAction, updatedData, email) {
  let auditLog = await new AuditLog({
    actionOn: actionOn,
    userRole: userRole,
    userId: userId,
    email: email,
    typeOfAction: typeOfAction,
    recordId: recordId,
    updatedData: updatedData,
  });
  auditLog.save();
}
// async function filterOutUpdatedKeys(afterUpdate, beforeUpdate) {
//   var afterUpdate = req.body;
//   var keyBody = Object.keys(afterUpdate);
//   var keyData = Object.keys(beforeUpdate);
//   //   console.log("body", keyBody);
//   //   console.log("data", keyData);
//   for (var i = 0; i < keyBody.length; i++) {
//     let key = keyBody[i];
//     // console.log("jjjj", key);
//     for (var j = 0; j < keyData.length; j++) {
//       let dataKey = keyData[j];
//       if (dataKey == key) {
//         // console.log("value", beforeUpdate[dataKey]);
//         // console.log("val", afterUpdate[key]);
//         if (beforeUpdate[dataKey] === afterUpdate[key]) {
//           delete afterUpdate[key];
//           delete beforeUpdate[dataKey];
//           // console.log("hhhh",afterUpdate[key]);
//           //   console.log("same data", afterUpdate);
//         } else {
//           //   console.log("new data", afterUpdate);
//         }
//         break;
//       }
//     }
//   }
//   return { afterUpdate, beforeUpdate };
// }

exports.AuditLog = AuditLog;
exports.createAuditLog = createAuditLog;
// exports.filterOutUpdatedKeys = filterOutUpdatedKeys;
