const { SYSTEM_FAILURE } = require("../config/constant.js");
const express = require("express");
const config = require("config");
const router = express.Router();
const auth = require("../middleware/auth");
// const pdfService = require("../services/pdfGenerate");
const { generatePdf, generateHtmlToPdf } = require("../services/pdfGenerate");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const gm = require("gm").subClass({ imageMagick: true });

// For Saving on disk first
const upload = multer({ dest: "./images/uploaded/" });
console.log("heyyy");
const singleUpload = upload.single("image");

// For saving directly on S3
var storage = multer.memoryStorage();
var uploadDirect = multer({ storage: storage });

// for uploading CSV data to disk first
const uploadCsv = multer({ dest: "./csv_files/uploaded/" });

const FileUrl = "https://s3." + config.get("S3_BUCKET_REGION") + ".amazonaws.com/" + config.get("S3_BUCKET_NAME") + "/";

const { uploadFileS3, uploadDirectFileS3 } = require("../services/s3Upload");

router.post("/image-upload-sync", uploadDirect.single("image"), async function (req, res) {
  //console.log("Upload direct file request: ", req.file);
  const dateString = Date.now();
  const Key = dateString + "_" + req.file.originalname;
  var url = FileUrl + "daarlo/" + Key;

  console.log("req", req.file);
  try {
    await uploadDirectFileS3(Key, "daarlo", req.file.buffer, req.file.mimetype, req.body.type);
    // await uploadDirectFileS3(Key, "daarlo", req.file.buffer);
  } catch (Ex) {
    console.log("Exception: ", Ex.message);
    return handleError(Ex, res);
  }

  res.status(200).send({
    statusCode: 200,
    message: "Success",
    data: {
      url
    }
  });
});

router.post("/csv-upload", uploadDirect.single("csv"), async function (req, res) {
  const dateString = Date.now();
  const Key = dateString + "_" + req.file.originalname;
  var url = FileUrl + "daarlo/" + Key;

  try {
    await uploadDirectFileS3(Key, "daarlo", req.file.buffer);
  } catch (Ex) {
    console.log("Exception: ", Ex.message);
    return handleError(Ex, res);
  }
  res.status(200).send({
    statusCode: 200,
    message: "Success",
    data: {
      url
    }
  });
});

router.post("/image-upload", uploadDirect.single("image"), async function (req, res) {
  //console.log("Upload direct file request: ", req.file);
  const dateString = Date.now();
  console.log("vvvvvv", req.file);
  const regex = /[^a-zA-Z0-9.]/g;
  const Key = dateString + "_" + req.file.originalname.replace(regex, "_");

  var url = FileUrl + "daarlo/" + Key;
  // console.log("req", req.file);

  try {
    // await uploadDirectFileS3(Key, "daarlo", req.file.buffer, req.file.mimetype);
    await uploadDirectFileS3(Key, "daarlo", req.file.buffer, req.file.mimetype, req.body.type);
  } catch (Ex) {
    console.log("Exception: ", Ex.message);
    return handleError(Ex, res);
  }
  res.status(200).send({
    statusCode: 200,
    message: "Success",
    data: {
      url
    }
  });
});

router.post("/multiple-image-upload", uploadDirect.array("image"), async function (req, res) {
  //console.log("Upload direct file request: ", req.file);
  let images = [];

  for (let i = 0; i < req.files.length; i++) {
    const dateString = Date.now();

    const Key = dateString + "_" + req.files[i].originalname;
    var url = FileUrl + "daarlo" + Key;
    // console.log("mmm",req.files[i].buffer);
    // console.log("gg",Key);

    try {
      let image = await uploadDirectFileS3(Key, "daarlo", req.files[i].buffer);
      let imageUrl = image.Location;
      images.push(imageUrl);
    } catch (Ex) {
      console.log("Exception: ", Ex.message);
      return handleError(Ex, res);
    }
  }
  res.status(200).send({
    statusCode: 200,
    message: "Success",
    data: {
      url: images
    }
  });
});

router.get("/invoice/pdf", async (req, res) => {
  let checkB = await generateHtmlToPdf();
  const dateString = Date.now();
  const regex = /[^a-zA-Z0-9.]/g;
  const Key = dateString + "_" + "invoice.pdf";

  var url = FileUrl + "daarlo/" + Key;
  console.log("check req :", url);
  // console.log("req", req.file);
  try {
    await uploadDirectFileS3(Key, "daarlo", checkB, "");
  } catch (Ex) {
    console.log("Exception: ", Ex.message);
    return handleError(Ex, res);
  }
  return res.status(200).send({
    statusCode: 200,
    message: "Success",
    data: {
      url
    }
  });
});

const handleError = (err, res) => {
  console.log(err);
  res.status(500).contentType("text/plain").end(SYSTEM_FAILURE);
};

module.exports = router;
