const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const config = require("config");
const path = require("path");
const fs = require("fs");

aws.config.update({
  secretAccessKey: config.get("S3_SECRET_KEY"),
  accessKeyId: config.get("S3_ACCESS_KEY"),
  region: config.get("S3_BUCKET_REGION")
});

const s3 = new aws.S3();

var myBucket = config.get("S3_BUCKET_NAME");

const uploadFileS3 = function (filePath, key, folderName) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, function (err, data) {
      if (err) {
        throw err;
      }
      console.log("Bucket Name: ", myBucket + "/" + folderName);
      params = { Bucket: myBucket + "/" + folderName, Key: key, Body: data };

      s3.putObject(params, function (err, data) {
        if (err) {
          console.log(err);
          reject(new Error("Image upload failed"));
        } else {
          console.log("Successfully uploaded data to myBucket/myKey");
          resolve();
        }
      });
    });
  });
};
const uploadPdfFileS3 = function (key, folderName, data) {
  return new Promise((resolve, reject) => {
    params = { Bucket: myBucket + "/" + folderName, Key: key, Body: data, ContentType: "application/pdf" };
    console.log("Params: ", params);
    s3.upload(params, (err, data) => {
      if (err) {
        reject(new Error("Image upload failed"));
      }
      resolve();
    });
  });
};
// const uploadDirectFileS3 = function (key, folderName, data) {
//   return new Promise((resolve, reject) => {
//     params = { Bucket: myBucket + "/" + folderName, Key: key, Body: data };

//     console.log("Params: ", params);
//     s3.upload(params, (err, data) => {
//       if (err) {
//         reject(new Error("Image upload failed"));
//       }
//       resolve();
//     });
//   });
// };
const uploadDirectFileS3 = function (key, folderName, data, fileExtension, type) {
  return new Promise((resolve, reject) => {
    if (type == "inlineDisplay")
      params = { Bucket: myBucket + "/" + folderName, Key: key, Body: data, ContentType: fileExtension };
    else params = { Bucket: myBucket + "/" + folderName, Key: key, Body: data };
    console.log("Params: ", params);
    s3.upload(params, (err, data) => {
      if (err) {
        reject(new Error("File upload failed"));
      }
      resolve();
    });
  });
};

module.exports.uploadFileS3 = uploadFileS3;
module.exports.uploadDirectFileS3 = uploadDirectFileS3;
module.exports.uploadPdfFileS3 = uploadPdfFileS3;
