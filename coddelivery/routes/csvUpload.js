const { SYSTEM_FAILURE } = require("../config/constant.js");
const express = require("express");
const config = require("config");
const router = express.Router();
const multer = require("multer");
const aws = require("aws-sdk");
const s3 = new aws.S3();
const fs = require("fs");
const csv = require("@fast-csv/parse");

// For Saving on disk first
const upload = multer({ dest: "./images/uploaded/" });
const singleUpload = upload.single("image");

// For saving directly on S3
var storage = multer.memoryStorage();
var uploadDirect = multer({ storage: storage });

// const FileUrl = "https://" + config.get("S3_BUCKET_NAME") + ".s3.amazonaws.com/";
const FileUrl = "https://s3." + config.get("S3_BUCKET_REGION") + ".amazonaws.com/" + config.get("S3_BUCKET_NAME") + "/";

const { uploadPdfFileS3, uploadDirectFileS3 } = require("../services/s3Upload.js");
const { Category } = require("../models/category.js");
const { SubCategory } = require("../models/category.js");
const { Vendor } = require("../models/vendor.js");
const { Product } = require("../models/product.js");

router.post("/csv-upload", uploadDirect.single("file"), async function (req, res) {
  const dateString = Date.now().toString();
  const Key = dateString + "_" + req.file.originalname;

  var imagePath = "daarlo2";
  var url = FileUrl + imagePath + "/" + Key;
  let userData = req.body.userData;


  try {
    if (req.file.mimetype.substring(req.file.mimetype.lastIndexOf("/") + 1) == "pdf") {
      await uploadPdfFileS3(Key, imagePath, req.file.buffer);
    } else {
      await uploadDirectFileS3(Key, imagePath, req.file.buffer);
    }

    // Convert CSV to JSON with S3 URLs
    console.log({ url })
    const jsonData = await s3CsvToJson(url);
    // console.log(jsonData, "jsonData")

    let categories = await Category.find({}, { categoryName: 1, categoryId: "$_id", _id: 0 });

    let vendor = await Vendor.find({}, { vendorId: "$_id" }).lean();
    console.log(vendor[0], "vendor");

    let subCategories = await SubCategory.find({}, { subCategoryName: 1, categoryId: 1, subcategoryId: "$_id", _id: 0 });
    let checkCategory;

    let insertedSubCategories = [];
    let insertedProducts = [];
    if (jsonData.length > 0) {

      ///checkCategories and sub categories insert it 
      for (let index = 0; index < jsonData.length; index++) {
        const element = jsonData[index];
        if (element.Category != "") {
          // console.log("test category 1");
          // console.log(categories, "categories");

          const categoryExists = categories.some(category => category.categoryName === element.Category.trim());

          // console.log(categoryExists, "categoryExists");
          if (categoryExists) {
            // console.log(element.Category, "element.Category");
            checkCategory = categories.find(category => category.categoryName === element.Category.trim());
            // console.log(checkCategory, "test category 2");
            checkCategory = checkCategory.toObject()

            if (checkCategory) {

              let checkSubCategory = subCategories.find(subCategory => subCategory.categoryId === checkCategory.categoryId);
              // console.log(checkSubCategory, "test checkSubCategory 2");

              if (!checkSubCategory) {
                let obj = {};
                obj.categoryId = checkCategory.categoryId;
                obj.subCategoryName = element.Subcategory.trim();
                obj.vendorId = vendor[0].vendorId;

                insertedSubCategories.push(obj)
                console.log(obj, "checkCategory");

              }
            }
          } else {
            // console.log("new checkSubCategory 2");
            let categoryInsert = await Category.create({ categoryName: element.Category.trim(), vendorId: vendor[0].vendorId });
            let category = await Category.findOne({ categoryName: element.Category.trim(), vendorId: vendor[0].vendorId }, { categoryId: "$_id" });
            if (category) {
              let checkSubCategory = subCategories.find(subCategory => subCategory.categoryId === category.categoryId);
              if (!checkSubCategory) {
                let subCategory = await SubCategory.create({ categoryId: category._id.toString(), subCategoryName: element.Subcategory, vendorId: vendor[0].vendorId })
              }
            }


          }

          let productObj = {
            description: element["Product Discription"] || "",
            isHidden: false,
            itemsSold: 0,
            isSoldOut: false,
            isDeleted: false,
            thumbnailImages: ["https://s3.ap-south-1.amazonaws.com/s3.zimblecode.com/daarlo/1710484259845_Dish.svg"],
            coverImages: ["https://s3.ap-south-1.amazonaws.com/s3.zimblecode.com/daarlo/1710484259845_Dish.svg"],
            coverImage: "https://s3.ap-south-1.amazonaws.com/s3.zimblecode.com/daarlo/1710484259845_Dish.svg",
            title: element["Product Name"],
            price: element.Price === "NA" ? 0 : parseFloat(element.Price),
            calories: element.Calories,
            unit: element.Unit,
            weight: element.Weight,
            category: element.Category.trim(),
            subCategory: element.Subcategory.trim(),
            vendorId: vendor[0].vendorId,
          };


          insertedProducts.push(productObj);

        }

      }
      if (insertedSubCategories.length > 0) {
        const uniqueCategories = removeDuplicates(insertedSubCategories);
        console.log(uniqueCategories);
        let insertSubCategory = await SubCategory.insertMany(uniqueCategories);
      }
      console.log(insertedSubCategories, "insertedSubCategories");
      console.log(insertedProducts, "insertedProducts");
      if (insertedProducts.length > 0) {
        let productArray = await Product.insertMany(insertedProducts);

      }



      /////// add products 



    }


    return res.status(200).send({ apiId: req.apiId, statusCode: 200, message: "Success", data: jsonData });
  } catch (err) {
    console.error("Exception: ", err);
    return handleError(err, res);
  }
});

async function s3CsvToJson(url) {
  const response = [];
  const keyName = url.split(`${config.get("S3_BUCKET_NAME") + "/"}`)[1];
  console.log("CSV file key name:", keyName);

  const params = {
    Bucket: config.get("S3_BUCKET_NAME"),
    Key: keyName
  };

  return new Promise((resolve, reject) => {
    const csvFile = s3.getObject(params).createReadStream();

    csv
      .parseStream(csvFile, { headers: true })
      .on("data", async function (data) {
        console.log("Row data:", data);
        // Check if the image data is in a specific column, adjust this based on your CSV structure
        const imageData = data["Product Image"]; // Assuming 'image' is the column name containing image data

        if (imageData) {
          const imageBuffer = Buffer.from(imageData, 'base64');

          const imageName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.png`; // Adjust as needed

          // Upload image to S3
          const s3ImageUrl = await uploadImageToS3(imageName, imageBuffer);

          // Replace image URL in the data object with S3 URL
          data.productImage = s3ImageUrl;
        }

        response.push(data);
      })
      .on("end", function () {
        console.log("CSV parse process finished");
        resolve(response);
      })
      .on("error", function (error) {
        console.error("CSV parse process failed:", error);
        reject("CSV parse process failed");
      });
  });
}

async function uploadImageToS3(imageName, imageBuffer) {
  const s3Key = `images/${imageName}`;

  const params = {
    Bucket: config.get("S3_BUCKET_NAME"),
    Key: s3Key,
    Body: imageBuffer,
    ContentType: 'image/png', // Change content type accordingly if the images are not PNG
    ACL: 'public-read' // Making the uploaded image publicly accessible
  };

  return new Promise((resolve, reject) => {
    s3.upload(params, (err, data) => {
      if (err) {
        console.error("Error uploading image to S3:", err);
        reject(err);
      } else {
        console.log("Image uploaded to S3:", data.Location);
        resolve(data.Location);
      }
    });
  });
}



function removeDuplicates(array) {
  // Create a map to track unique categories by name or ID
  const uniqueCategoriesMap = new Map();

  // Iterate through the array using map
  array.map(category => {
    // Check if the category name or ID already exists in the map
    const key = `${category.subCategoryName}-${category.categoryId}`;
    if (!uniqueCategoriesMap.has(key)) {
      // If not, add it to the map
      uniqueCategoriesMap.set(key, category);
    }
  });

  // Convert the map values back to an array of unique categories
  const uniqueArray = Array.from(uniqueCategoriesMap.values());

  return uniqueArray;
}


const handleError = (err, res) => {
  console.error(err);
  res.status(500).contentType("text/plain").end(SYSTEM_FAILURE);
};

module.exports = router;

