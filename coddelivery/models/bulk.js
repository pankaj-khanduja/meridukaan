// const Joi = require("joi");
// const mongoose = require("mongoose");
// const _ = require("lodash");

// const bulkSchema = new mongoose.Schema(
//   {
//     _id: { type: String },
//     acceptedData: { type: Array, default:""},
//     rejectedData: {type:Array, default:""},
//     requestStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default:"PENDING" },
//     typeOfRequest: { type: String, enum: ["UPDATE", "CREATE"] },
//   },
//   { timestamps: true }
// );
// const Bulk = mongoose.model("Bulk", bulkSchema);

// async function createUniqueId() {
//   let uniqueId =
//     Math.random().toString(36).substr(2, 2) +
//     Date.now().toString(36).substr(4, 4) +
//     Math.random().toString(36).substr(2, 2) +
//     Math.floor(Math.random() * 90000 + 10000);
//   let loop = true;
//   while (loop) {
//     let id = await Bulk.findOne({ _id: uniqueId });
//     if (!id) {
//       loop = false;
//     } else {
//       uniqueId =
//       Math.random().toString(36).substr(3, 3) +
//     Date.now().toString(36).substr(4, 4) +
//     Math.random().toString(36).substr(4, 2) +
//     Math.floor(Math.random() * 90000 + 10000);

//     }
//   }
//   return uniqueId;
// };

// async function generateBulkRequest(acceptedData, rejectedData, requestStatus,typeOfRequest) {
//     let id = await createUniqueId()
//     let bulk = await new Bulk({
//         acceptedData:acceptedData,
//         rejectedData:rejectedData,
//         requestStatus:requestStatus,
//         typeOfRequest:typeOfRequest,
//         _id:id

//     })
//     bulk.save()

// }

// async function properData(successArray,failureArray){
//   let bulkSuccessData = [];
//   let bulkFailureData = [];
//   successArray.forEach((product) => {
//     product.status = "accepted";
//     lodashData = _.pick(product, ["product.title","product.productCode","variants.variantCode","variants.stock","variants.mrp","status"]);
//     bulkSuccessData.push(lodashData);
// });

//   failureArray.forEach((product) => {
//     product.status = "rejected";
//     lodashData = _.pick(product, ["product.title","product.productCode","variants.variantCode","variants.stock","variants.mrp","status"]);
//     bulkFailureData.push(lodashData);
//   });
// let status;
//   if (successArray.length > 0) {
//     status = "APPROVED"
//   }
//   else{
//     status = "REJECTED"
//   }
//   console.log("0000",bulkSuccessData);
//   let returnObj = {
//     bulkSuccessData:bulkSuccessData,
//     bulkFailureData:bulkFailureData,
//     status:status
//   }
//   return returnObj;

// }

// exports.Bulk = Bulk;
// // exports.createUniqueId = this.createUniqueId;
// exports.properData = properData;
// exports.generateBulkRequest = generateBulkRequest;
