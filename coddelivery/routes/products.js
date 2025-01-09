const {
  Topping,
  Product,
  validateProductPost,
  validateProductBulk,
  // validateProductBulkUpdate,
  validateProductPut,
  // validateVariantPost,
  validateToppingPost,
  validateToppingPut,
} = require("../models/product");
const express = require("express");
const mongoose = require("mongoose");
const config = require("config");
const { identityManager } = require("../middleware/auth");
const { PRODUCT_CONSTANTS, TOPPING_CONSTANTS, STORE_MANAGER_CONSTANTS } = require("../config/constant");
const _ = require("lodash");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Vendor, slotLookUp } = require("../models/vendor");
// const csvFilePath = `${__dirname}/csv_file/uploaded/${req.file}`;
const CsvToJson = require("csvtojson");
const { valMsgFormatter } = require("../services/commonFunctions");
const ObjectsToCsv = require("objects-to-csv");
const { convertArrayToCSV } = require("convert-array-to-csv");
const AWS = require("aws-sdk");
const { getMaxListeners } = require("process");
const router = express.Router();
const sgMail = require("@sendgrid/mail");
// const { generateBulkRequest, properData } = require("../models/bulk");
const { Category } = require("../models/category");
// const { VariantAlsoNegotiates } = require("http-errors");
const { CartItem } = require("../models/cart");
const { Order } = require("../models/order");
sgMail.setApiKey(config.get("sendGridApiKey"));
const { createTransaction, chargeWithToken } = require("../services/flutterWave");
mongoose.set("debug", true);
// const s3 = {
//   secretAccessKey: config.get("S3_SECRET_KEY"),
//   accessKeyId: config.get("S3_ACCESS_KEY"),
//   region: config.get("S3_BUCKET_REGION"),
// };

// AWS.config.update(s3);

// const S3 = new AWS.S3();
// const params = {
//   Bucket: config.get("S3_BUCKET_NAME"),
//   Key: "groceryapp/1613470518354_myProducts.csv",
// };
router.get("/withVendorSearch", identityManager(["vendor", "admin", "user", "public"], { merchant: "W" }), async (req, res) => {
  let criteria = {};
  let criteria1 = {};
  let criteria2 = {};

  if (req.query.status) {
    criteria.status = req.query.status;
  } else {
    criteria.status = "active";
  }

  if (req.query.text) {
    criteria2.title = { $regex : req.query.text, $options : "i" };
  }
  // if (req.query.isDeleted) {
  //   criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  // } else {
  //   criteria.isDeleted = false;
  // }

  var skipVal, limitVal;
  if (req.query.vendorId) criteria._id = mongoose.Types.ObjectId(req.query.vendorId);

  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);

  if (isNaN(parseInt(req.query.limit))) limitVal = 5000;
  else limitVal = parseInt(req.query.limit);
  console.log("skipVal", limitVal);
  criteria1.isStoreDeliverable = true;
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };

  if (req.query.type) criteria.merchantCategory = req.query.type;
  let cartId = req.query.cartId;

  let lng = 0;
  let lat = 0;
  let maxDistance = 0;
  if (req.jwtData.role == "user" || req.jwtData.role == "public") {
    maxDistance = config.get("maxDistance");
  } else {
    maxDistance = 100000000000000;
  }
  if (req.query.lng) {
    lng = parseFloat(req.query.lng);
  }
  if (req.query.lat) {
    lat = parseFloat(req.query.lat);
  }

  let sortCriteria = {};
  if (req.query.sortBy === "insertDate") {
    sortCriteria = { insertDate: -1 };
  } else {
    sortCriteria = { isVendorOpen: -1, isStoreDeliverable: -1, "dist.calculated": 1, _id: -1 };
  }


  console.log(criteria, criteria1, criteria2, "criteriaaa===========================");

  let productList = await Vendor.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "dist.calculated",
        maxDistance: maxDistance,
        query: criteria,
        includeLocs: "dist.location",
        spherical: true,
        // distanceMultiplier: 6378.1,
      },
    },
    {
      $lookup: {
        from: "feeandlimits",
        let: { cityId: "$cityId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$cityId", "$$cityId"] }, { $eq: ["$type", "store"] }],
              },
            },
          },
        ],
        as: "fareData",
      },
    },
    {
      $addFields: {
        deliveryRadius: {
          $cond: [{ $ne: ["$isDeliveryRadius", false] }, { $arrayElemAt: ["$fareData.deliveryRadius", 0] }, "$deliveryRadius"],
        },
      },
    },
    {
      $addFields: {
        isStoreDeliverable: {
          $cond: [
            {
              $lte: ["$dist.calculated", { $multiply: [/*"$deliveryRadius"*/ 6000, 1000] }], // deliveryRadius static for now after feeandlimits data created make it dynamic 
            },
            true,
            false,
          ],
        },
      },
    },
    { $match: criteria1 },
    {
      $lookup: slotLookUp("$_id"),
    },
    {
      $addFields: { isVendorOpen: { $anyElementTrue: ["$scheduleData"] } },
    },
    { $sort: sortCriteria },
    {
      $lookup: {
        from: "products",
        let: { vendorId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$vendorId", "$$vendorId"] }, { $eq: ["$isDeleted", false] }, { $eq: ["$isHidden", false] }],
              },
            },
          },
        ],
        as: "productData",
      },
    },
    { $unwind: "$productData" },
    {
      $project: {
        vendorId: "$_id",
        vendorName: "$name",
        productId: { $toString: "$productData._id" },
        isVendorOpen: 1,
        title: "$productData.title",
        category: "$productData.category",
        subCategory: "$productData.subCategory",
        description: "$productData.description",
        coverImage: "$productData.coverImage",
        coverImages: "$productData.coverImages",
        blobImageObject: "$productData.blobImageObject",
        price: "$productData.price",
        oldPrice: "$productData.oldPrice",
        offerText: "$productData.offerText",
        calories: "$productData.calories",
        weight: "$productData.weight",
        unit: "$productData.unit",
        isHidden: "$productData.isHidden",
        isSoldOut: "$productData.isSoldOut",
        quantityType: "$productData.quantityType",
        thumbnailImages: "$productData.thumbnailImages",
      },
    },
    { $match: criteria2 },
    {
      $lookup: {
        from: "toppings",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$productId", "$$productId"] }],
              },
            },
          },
          { $addFields: { toppingId: "$_id" } },
        ],
        as: "toppingData",
      },
    },
    {
      $lookup: {
        from: "cartitems",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.productId", "$$productId"] }, { $eq: ["$cartId", cartId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },

    {
      $facet: {
        allDocs: [
          {
            $group: {
              _id: null,

              totalCount: {
                $sum: 1,
              },
            },
          },
        ],
        paginatedDocs: [{ $skip: skipVal }, { $limit: limitVal }],
      },
    },
  ]);
  let totalCount = productList[0].allDocs.length > 0 ? productList[0].allDocs[0].totalCount : 0;

  productList = productList[0].paginatedDocs;
  // console.log("criteriaa", criteria);
  // let totalCount = await Vendor.countDocuments(criteria);
  return res.send({ apiId: req.apiId, statusCode: 200, message: "Success", data: { totalCount, productList } });
});

router.get("/searchProducts", identityManager(["user", "vendor", "public"]), async (req, res) => {
  var criteria = {};
  var criteria2 = {};
  var offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  // if (req.query.title) criteria.title = new RegExp(req.query.title, "i");
  if (req.query.vendorId) criteria.vendorId = req.query.vendorId;
  // if (req.query.isDeleted) criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  // else criteria.isDeleted = false;
  if (req.query.isDeleted) {
    criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  } else {
    criteria.isDeleted = false;
  }
  if (req.query.isHidden) criteria.isHidden = req.query.isHidden === "true" ? true : false;
  else criteria.isHidden = false;
  let cartId = req.query.cartId;

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ title: regexName }, { category: regexName }];
  }
  console.log("tweygh", criteria);
  let products = await Product.aggregate([
    { $match: criteria },
    { $skip: offset },
    { $limit: limit },
    { $sort: { title: 1 } },
    { $addFields: { categoryName: "$category", subCategoryName: "$subCategory", productId: { $toString: "$_id" } } },

    {
      $lookup: {
        from: "toppings",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", criteria.isDeleted] }],
              },
            },
          },
          { $addFields: { toppingId: "$_id" } },
        ],
        as: "toppingData",
      },
    },
    {
      $lookup: {
        from: "cartitems",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.productId", "$$productId"] }, { $eq: ["$cartId", cartId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },
    // {
    //   $lookup: {
    //     from: "vendors",
    //     let: { vendorId: { $toObjectId: "$vendorId" } },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$_id", "$$vendorId"] }],
    //           },
    //         },
    //       },
    //     ],
    //     as: "vendorData",
    //   },
    // },
    {
      $project: {
        _id: 0,

        title: 1,
        price: 1,
        subCategory: 1,
        category: 1,
        quantityType: 1,
        description: 1,
        coverImage: 1,
        blobImageObject: 1,
        thumbnailImages: 1,
        offerText: 1,
        coverImages: 1,
        weight: 1,
        calories: 1,
        vendorId: 1,
        isSoldOut: 1,
        toppingData: 1,
        productId: 1,
        cartItemData: 1,

        unit: 1,
        vendorName: { $arrayElemAt: ["$vendorData.name", 0] },
      },
    },

    // { $addFields: { category: { $toObjectId: "$category" }, subCategory: { $toObjectId: "$subCategory" } } },
    // { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "categoryData" } },
    // { $lookup: { from: "subcategories", localField: "subCategory", foreignField: "_id", as: "subCategoryData" } },
    // { $addFields: { categoryName: { $arrayElemAt: ["$categoryData.category", 0] }, subCategoryName: { $arrayElemAt: ["$subCategoryData.subCategory", 0] } } },
    // { $match: criteria2 },
  ]);
  let totalCount = await Product.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, products },
  });
});

router.get("/", identityManager(["user", "vendor", "public"]), async (req, res) => {
  var criteria = {};
  var criteria1 = {};
  var criteria2 = {};

  var offset, limit;
  let userId = req.jwtData.userId;
  let cartId = req.query.cartId;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.query.productId) criteria._id = mongoose.Types.ObjectId(req.query.productId);
  if (req.query.vendorId) criteria.vendorId = req.query.vendorId;
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ title: regexName }, { brand: regexName }, { category: regexName }, { subCategory: regexName }];
    // { $or: [{ title: regexName }, { brand: regexName }, { category: regexName }, { subCategory: regexName }] };
  }
  if (req.query.categoryName) criteria.category = req.query.categoryName;
  if (req.query.subCategoryName) criteria.subCategory = req.query.subCategoryName;

  // if (req.query.subCategoryId) {
  //   subCategoryId = req.query.subCategoryId.split(",")
  //   criteria.subCategory = { $in: subCategoryId }
  // }

  // if (req.query.isOutOfStock) criteria.stock = req.query.isOutOfStock === "true" ? { $eq: 0 } : { $gt: 0 }
  if (req.query.isDeleted) criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria.isDeleted = false;
  if (req.query.isHidden) criteria.isHidden = req.query.isHidden === "true" ? true : false;
  else criteria.isHidden = false;
  if (req.query.isFeatured) criteria.isFeatured = req.query.isFeatured === "true" ? true : false;

  if (req.query.minPrice) criteria.price = { $gte: parseInt(req.query.minPrice) };
  if (req.query.minPrice) criteria.price = { $lte: parseInt(req.query.minPrice) };
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };
  console.log("hajjjj", criteria);
  let products = await Product.aggregate([
    { $match: criteria },
    { $addFields: { categoryName: "$category", subCategoryName: "$subCategory", productId: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "cartitems",
        let: { productId: { $toString: "$productId" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.productId", "$$productId"] }, { $eq: ["$cartId", cartId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },
    // {
    //   $addFields: {
    //     quantity: {
    //       $cond: [{ $ne: [{ $size: "$cartItemData" }, 0] }, "$cartItemData.quantity", [0]],
    //     },
    //   },
    // },
    // { $unwind: "$quantity" },
    {
      $lookup: {
        from: "toppings",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", criteria.isDeleted] }],
              },
            },
          },
          { $addFields: { toppingId: "$_id" } },
        ],
        as: "toppingData",
      },
    },

    {
      $group: {
        _id: "$subCategory",
        category: {
          $addToSet: {
            name: "$category",
          },
        },
        productList: {
          $push: {
            title: "$title",
            price: "$price",
            weight: "$weight",
            unit: "$unit",
            isSoldOut: "$isSoldOut",
            subCategory: "$subCategory",
            category: "$category",
            description: "$description",
            coverImage: "$coverImage",
            blobImageObject: "$blobImageObject",
            thumbnailImages: "$thumbnailImages",
            offerText: "$offerText",
            calories: "$calories",
            vendorId: "$vendorId",
            toppingData: "$toppingData",
            productId: "$productId",
            quantityType: "$quantityType",
            coverImages: "$coveriamges",
            cartItemData: "$cartItemData",
          },
        },
      },
    },
    { $sort: { _id: -1 } },
    // {
    //   $lookup: {
    //     from: "variants",
    //     let: { productId: { $toString: "$_id" } },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", criteria.isDeleted] }],
    //           },
    //         },
    //       },
    //     ],
    //     as: "variantsData",
    //   },
    // },
    // { $match: { $expr: { $ne: [{ $size: "$variantsData" }, 0] } } },

    // { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },
    // {
    //   $addFields: {
    //     storeName: { $arrayElemAt: ["$storeData.storeName", 0] },
    //     storeAddress: { $arrayElemAt: ["$storeData.address", 0] },
    //   },
    // },
    // {
    //   $lookup: {
    //     from: "cartitems",
    //     let: { variantId: { $toString: "$variantId" } },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$items.variantId", "$$variantId"] }, { $eq: ["$userId", userId] }],
    //           },
    //         },
    //       },
    //     ],
    //     as: "cartItemData",
    //   },
    // },
    // { $sort: { itemsSold: -1 } },
    // {
    //   $addFields: {
    //     quantity: {
    //       $cond: [{ $ne: [{ : "$cartItemData" }, 0] }, "$cartItemData.quantity", [0]],
    //     },
    //   },
    // },
    // { $unwind: "$quantity" },
    { $skip: offset },
    { $limit: limit },
    {
      $project: { storeData: 0, cartItemData: 0 },
    },
  ]);
  let totalCount = await Product.countDocuments(criteria);

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, products },
  });
});

router.get("/byCategories", identityManager(["user", "vendor", "public"]), async (req, res) => {

  var criteria = {};
  var criteria1 = {};
  var criteria2 = {};

  var offset, limit;
  var productOffset, productLimit;

  let userId = req.jwtData.userId;
  let cartId = req.query.cartId;
  // if (isNaN(parseInt(req.query.offset))) offset = 0;
  // else offset = parseInt(req.query.offset);
  // if (isNaN(parseInt(req.query.limit))) limit = 500;
  // else limit = parseInt(req.query.limit);
  // if (isNaN(parseInt(req.query.productOffset))) productOffset = 0;
  // else productOffset = parseInt(req.query.productOffset);
  // if (isNaN(parseInt(req.query.productLimit))) productLimit = 500;
  // else productLimit = parseInt(req.query.productLimit);
  // if (req.query.productId) criteria._id = mongoose.Types.ObjectId(req.query.productId);
  if (req.query.vendorId) criteria.vendorId = req.query.vendorId;

  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ title: regexName }, { brand: regexName }, { category: regexName }, { subCategory: regexName }];
    // { $or: [{ title: regexName }, { brand: regexName }, { category: regexName }, { subCategory: regexName }] };
  }
  if (req.query.categoryId) criteria._id = new mongoose.Types.ObjectId(req.query.categoryId);
  console.log(criteria._id )
  if (req.query.subCategoryName) criteria.subCategory = req.query.subCategoryName;

  // if (req.query.subCategoryId) {
  //   subCategoryId = req.query.subCategoryId.split(",")
  //   criteria.subCategory = { $in: subCategoryId }
  // }

  // if (req.query.isOutOfStock) criteria.stock = req.query.isOutOfStock === "true" ? { $eq: 0 } : { $gt: 0 }
  // if (req.query.isDeleted) criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  // else criteria.isDeleted = false;
  // if (req.query.isHidden) criteria.isHidden = req.query.isHidden === "true" ? true : false;
  // else criteria.isHidden = false;
  // if (req.query.isFeatured) criteria.isFeatured = req.query.isFeatured === "true" ? true : false;

  if (req.query.minPrice) criteria.price = { $gte: parseInt(req.query.minPrice) };
  if (req.query.minPrice) criteria.price = { $lte: parseInt(req.query.minPrice) };
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) criteria.insertDate = { $gte: parseInt(req.query.startDate), $lte: parseInt(req.query.endDate) };

  console.log("hajjjj", criteria);

  let products = await Category.aggregate([
    { $match: criteria },
    // { $addFields: { categoryName: "$category", subCategoryName: "$subCategory", productId: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "subcategories",
        let: { categoryId: { $toString: "$_id" }, categoryName: "$categoryName" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$categoryId", "$$categoryId"] }],
              },
            },
          },
          {
            $lookup: {
              from: "products",
              let: { subCategoryName: "$subCategoryName", categoryName: "$$categoryName", vendorId: criteria.vendorId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$category", "$$categoryName"] },
                        { $eq: ["$subCategory", "$$subCategoryName"] },
                        { $eq: ["$vendorId", "$$vendorId"] },

                        { $eq: ["$isDeleted", false] },
                        { $eq: ["$isHidden", false] },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    productId: "$_id",
                    title: 1,
                    vendorId: 1,
                    subCategory: 1,
                    category: 1,
                    description: 1,
                    quantityType: 1,
                    coverImage: 1,
                    thumbnailImages: 1,
                    coverImages: 1,
                    price: 1,
                    oldPrice: 1,
                    offerText: 1,
                    calories: 1,
                    weight: 1,
                    unit: 1,
                    isHidden: 1,
                    itemsSold: 1,
                    isSoldOut: 1,
                    isDeleted: 1,
                    insertDate: 1,
                  },
                },
                { $sort: { title: 1 } },
                // {
                //   $lookup: {
                //     from: "toppings",
                //     let: { productId: { $toString: "$productId" } },
                //     pipeline: [
                //       {
                //         $match: {
                //           $expr: {
                //             $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", false] }],
                //           },
                //         },
                //       },
                //       {
                //         $project: {
                //           toppingName: 1,
                //           productId: 1,
                //           lowerLimit: 1,
                //           checkbox: 1,
                //           upperLimit: 1,
                //           subtype: 1,
                //           isDeleted: 1,
                //           toppingId: "$_id",
                //           _id: 0,
                //         },
                //       },
                //     ],
                //     as: "toppingData",
                //   },
                // },
                {
                  $lookup: {
                    from: "cartitems",
                    let: { productId: { $toString: "$productId" } },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [{ $eq: ["$items.productId", "$$productId"] }, { $eq: ["$cartId", cartId] }],
                          },
                        },
                      },
                    ],
                    as: "cartItemData",
                  },
                },
              ],
              as: "productData",
            },
          },
          { $addFields: { isFound: { $anyElementTrue: ["$productData"] } } },

          { $match: { isFound: true } },
          {
            $project: {
              subCategoryName: 1,
              hasProduct: 1,
              productData: 1,
              subCategoryId: "$_id",
              _id: 0,
            },
          },
        ],
        as: "subCategoryData",
      },
    },
    { $addFields: { isSubCategoryFound: { $anyElementTrue: ["$subCategoryData"] } } },

    // { $match: { isSubCategoryFound: true } },
    {
      $lookup: {
        from: "products",
        let: { category: "$categoryName", vendorId: criteria.vendorId },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$subCategory", "N.A."] },
                  { $eq: ["$category", "$$category"] },
                  { $eq: ["$vendorId", "$$vendorId"] },

                  { $eq: ["$isDeleted", false] },
                  { $eq: ["$isHidden", false] },
                ],
              },
            },
          },
          // { $skip: offset },
          // { $limit: limit },
          {
            $project: {
              productId: "$_id",
              title: 1,
              vendorId: 1,
              subCategory: 1,
              category: 1,
              description: 1,
              quantityType: 1,
              coverImage: 1,
              coverImages: 1,
              price: 1,
              oldPrice: 1,
              offerText: 1,
              calories: 1,
              weight: 1,
              unit: 1,
              isHidden: 1,
              itemsSold: 1,
              isSoldOut: 1,
              isDeleted: 1,
              insertDate: 1,
            },
          },

          // {
          //   $lookup: {
          //     from: "toppings",
          //     let: { productId: { $toString: "$productId" } },
          //     pipeline: [
          //       {
          //         $match: {
          //           $expr: {
          //             $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", false] }],
          //           },
          //         },
          //       },
          //       {
          //         $project: {
          //           toppingName: 1,
          //           productId: 1,
          //           lowerLimit: 1,
          //           checkbox: 1,
          //           upperLimit: 1,
          //           subtype: 1,
          //           isDeleted: 1,
          //           toppingId: "$_id",
          //           _id: 0,
          //         },
          //       },
          //     ],
          //     as: "toppingData",
          //   },
          // },
          // {
          //   $lookup: {
          //     from: "cartitems",
          //     let: { productId: { $toString: "$productId" } },
          //     pipeline: [
          //       {
          //         $match: {
          //           $expr: {
          //             $and: [{ $eq: ["$items.productId", "$$productId"] }, { $eq: ["$cartId", cartId] }],
          //           },
          //         },
          //       },
          //     ],
          //     as: "cartItemData",
          //   },
          // },
        ],
        as: "otherProductData",
      },
    },
    { $addFields: { isOtherProductData: { $anyElementTrue: ["$otherProductData"] } } },
    { $match: { $or: [{ isOtherProductData: true }, { isSubCategoryFound: true }] } },

    //

    // { $skip: offset },
    // { $limit: limit },
    {
      $project: {
        categoryId: "$_id",
        categoryName: 1,
        subCategoryData: 1,
        otherProductData: 1,
        vendorId: 1,
        // $hasSubcategory: { $anyElementTrue: ["$subcategoryData"] },

        _id: 0,
      },
    },
  ]);
  // let totalCount = await Product.countDocuments(criteria);

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { products },
  });
});
router.get("/similarProduct", identityManager(["user", "vendor", "public"]), async (req, res) => {
  var criteria = {};
  var criteria1 = {};

  var offset, limit;
  let userId = req.jwtData.userId;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.query.cartId) {
    let productId = [];
    let cartItems = await CartItem.find({ cartId: req.query.cartId });
    for (item of cartItems) {
      product = item.items.productId;
      productId.push(_.clone(product));
    }
    criteria1.productId = { $nin: productId };
  }
  if (req.query.productId) {
    productId = req.query.productId.split(",");
    criteria1.productId = { $nin: productId };
  }

  // if (req.query.productId) criteria._id = mongoose.Types.ObjectId(req.query.productId);
  if (req.query.storeId) criteria.storeId = req.query.storeId;

  if (req.query.categoryId) criteria.category = req.query.categoryId;
  if (req.query.subCategoryId) {
    subCategoryId = req.query.subCategoryId.split(",");
    // console.log("ghgjfhg", subCategoryId);
    criteria.subCategory = { $in: subCategoryId };
    console.log("hjgsgdfj", criteria);
  }

  if (req.query.brand) criteria.brand = req.query.brand;
  // if(req.query.variantId)criteria1.variantId = req.query.variantId

  if (req.query.isOutOfStock) criteria.stock = req.query.isOutOfStock === "true" ? { $eq: 0 } : { $gt: 0 };
  if (req.query.isDeleted) criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria.isDeleted = false;
  if (req.query.minPrice) criteria1.price = { $gte: parseInt(req.query.minPrice) };
  if (req.query.maxPrice) criteria1.price = { $lte: parseInt(req.query.maxPrice) };
  if (req.query.minPrice != null && req.query.maxPrice != null)
    criteria.price = {
      $gte: parseInt(req.query.minPrice),
      $lte: parseInt(req.query.maxPrice),
    };
  if (req.query.title) criteria.title = new RegExp(req.query.title, "i");
  let products = await Product.aggregate([
    // {
    //   $group: {
    //     _id: "$subCategory",
    //     docs: { $push: "$$ROOT" },
    //   },
    // },
    { $match: criteria },
    { $addFields: { productId: { $toString: "$_id" } } },
    { $match: criteria1 },
    { $sort: { title: 1 } },

    { $skip: offset },
    { $limit: limit },
    {
      $lookup: {
        from: "variants",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", criteria.isDeleted] }],
              },
            },
          },
        ],
        as: "variantsData",
      },
    },
    { $match: { $expr: { $ne: [{ $size: "$variantsData" }, 0] } } },

    {
      $addFields: {
        variantId: { $toString: { $arrayElemAt: ["$variantsData._id", 0] } },
        price: { $arrayElemAt: ["$variantsData.price", 0] },
        weight: { $arrayElemAt: ["$variantsData.weight", 0] },
        unit: { $arrayElemAt: ["$variantsData.unit", 0] },
        stock: { $arrayElemAt: ["$variantsData.stock", 0] },
        itemsSold: { $arrayElemAt: ["$variantsData.itemsSold", 0] },
        productId: { $arrayElemAt: ["$variantsData.productId", 0] },
        imageUrl: { $arrayElemAt: ["$variantsData.imageUrl", 0] },

        storeId: { $toObjectId: "$storeId" },
      },
    },
    { $match: criteria1 },
    { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },
    {
      $addFields: {
        storeName: { $arrayElemAt: ["$storeData.storeName", 0] },
        storeAddress: { $arrayElemAt: ["$storeData.address", 0] },
      },
    },
    {
      $lookup: {
        from: "cartitems",
        let: { variantId: { $toString: "$variantId" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.variantId", "$$variantId"] }, { $eq: ["$userId", userId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },
    // { $sort: { itemsSold: -1 } },
    {
      $addFields: {
        quantity: {
          $cond: [{ $ne: [{ $size: "$cartItemData" }, 0] }, "$cartItemData.quantity", [0]],
        },
      },
    },
    { $unwind: "$quantity" },

    {
      $project: { variantsData: 0, storeData: 0, cartItemData: 0 },
    },
  ]);
  let totalCount = await Product.countDocuments(criteria);
  // let totalCount = products.length;

  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { products },
  });
});

router.get("/buyAgain", identityManager(["vendor", "user", "public"]), async (req, res) => {
  let criteria = {};
  let criteria1 = {};
  if (req.query.categoryId) {
    criteria1.category = req.query.categoryId;
  }
  if (req.query.isDeleted) criteria1.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria1.isDeleted = false;
  if (req.query.subCategoryId) {
    criteria1.subCategory = req.query.subCategoryId;
  }
  if (req.query.storeId) {
    criteria1.storeId = req.query.storeId;
  }
  let userId;
  var offset, limit;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  criteria.userId = req.jwtData.userId;
  // console.log("nsjkfds",criteria1);
  let products = await Order.aggregate([
    { $match: criteria },
    {
      $lookup: {
        from: "variants",
        let: {
          variantIds: "$details.cartItems.items.variantId",
        },
        pipeline: [{ $match: { $expr: { $in: [{ $toString: "$_id" }, "$$variantIds"] } } }],
        as: "variantData",
      },
    },
    { $unwind: "$variantData" },
    { $replaceRoot: { newRoot: "$variantData" } },
    { $group: { _id: "$_id", variantData: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$variantData" } },
    { $addFields: { variantId: { $toString: "$_id" }, productId: { $toObjectId: "$productId" } } },
    { $match: criteria1 },

    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "productData" } },
    {
      $addFields: {
        title: { $arrayElemAt: ["$productData.title", 0] },
        coverImage: { $arrayElemAt: ["$productData.coverImage", 0] },
        brand: { $arrayElemAt: ["$productData.brand", 0] },
        subCategory: { $arrayElemAt: ["$productData.subCategory", 0] },
        category: { $arrayElemAt: ["$productData.category", 0] },
        storeId: { $arrayElemAt: ["$productData.storeId", 0] },
        // isDeleted: { $arrayElemAt: ["$productData.isDe", 0] },
        // imageUrl: { $arrayElemAt: ["$productData.imageUrl", 0] },
        description: { $arrayElemAt: ["$productData.description", 0] },
        coverImages: { $arrayElemAt: ["$productData.coverImages", 0] },
        // storeId: { $toObjectId: "$productData.storeId" },
      },
    },
    { $addFields: { storeId: { $toObjectId: { $arrayElemAt: ["$productData.storeId", 0] } } } },
    { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },
    {
      $addFields: {
        storeName: { $arrayElemAt: ["$storeData.storeName", 0] },
        storeAddress: { $arrayElemAt: ["$storeData.address", 0] },
      },
    },
    {
      $lookup: {
        from: "cartitems",
        let: { variantId: "$variantId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.variantId", "$$variantId"] }, { $eq: ["$userId", criteria.userId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },

    {
      $addFields: {
        quantity: {
          $cond: [{ $ne: [{ $size: "$cartItemData" }, 0] }, "$cartItemData.quantity", [0]],
        },
      },
    },
    { $unwind: "$quantity" },

    { $skip: offset },
    { $limit: limit },
    // { $addFields: { quantity: { $arrayElemAt: ["$cartItemData.quantity", 0] } } },
    {
      $project: { productData: 0, storeData: 0, categoryData: 0 },
    },

    // // { $sort: { itemsSold: -1 } },
  ]);
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { products },
  });
});

// best selling products

router.get("/bestSelling", identityManager(["user", "public", "vendor"]), async (req, res) => {
  var criteria = {};
  var criteria1 = {};
  var offset, limit;
  let userId = req.jwtData.userId;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.query.categoryId) criteria.category = req.query.categoryId;
  if (req.query.subCategoryId) criteria.subCategory = req.query.subCategoryId;
  if (req.query.brand) criteria.brand = req.query.brand;
  if (req.query.storeId) criteria.storeId = req.query.storeId;
  // if(req.query.variantId)criteria1._id = req.query.variantId
  if (req.query.variantId) criteria1._id = mongoose.Types.ObjectId(req.query.variantId);
  if (req.query.productId) criteria1.productId = req.query.productId;

  if (req.query.isOutOfStock) criteria1.stock = req.query.isOutOfStock === "true" ? { $eq: 0 } : { $gt: 0 };
  if (req.query.isDeleted) criteria1.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria1.isDeleted = false;
  if (req.query.minPrice) criteria1.price = { $gte: parseInt(req.query.minPrice) };
  if (req.query.maxPrice) criteria1.price = { $lte: parseInt(req.query.maxPrice) };
  if (req.query.minPrice != null && req.query.maxPrice != null)
    criteria.price = {
      $gte: parseInt(req.query.minPrice),
      $lte: parseInt(req.query.maxPrice),
    };
  if (req.query.title) criteria.title = new RegExp(req.query.title, "i");
  let products = await Variant.aggregate([
    { $match: criteria1 },
    { $sort: { itemsSold: -1 } },
    { $addFields: { productId: { $toObjectId: "$productId" } } },
    { $addFields: { variantId: { $toString: "$_id" } } },

    { $group: { _id: "$productId", variantData: { $first: "$$ROOT" } } },
    { $sort: { "variantData.itemsSold": -1 } },
    { $replaceRoot: { newRoot: "$variantData" } },

    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "productData" } },

    {
      $addFields: {
        title: { $arrayElemAt: ["$productData.title", 0] },
        coverImage: { $arrayElemAt: ["$productData.coverImage", 0] },
        thumbnailImages: { $arrayElemAt: ["$productData.thumbnailImages", 0] },
        brand: { $arrayElemAt: ["$productData.brand", 0] },
        subCategory: { $arrayElemAt: ["$productData.subCategory", 0] },
        category: { $arrayElemAt: ["$productData.category", 0] },
        storeId: { $arrayElemAt: ["$productData.storeId", 0] },
        // imageUrl: { $arrayElemAt: ["$productData.imageUrl", 0] },
        description: { $arrayElemAt: ["$productData.description", 0] },
        coverImages: { $arrayElemAt: ["$productData.coverImages", 0] },

        // storeId: { $toObjectId: "$productData.storeId" },
      },
    },
    { $match: criteria },

    { $addFields: { storeId: { $toObjectId: { $arrayElemAt: ["$productData.storeId", 0] } } } },
    { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },
    {
      $addFields: {
        storeName: { $arrayElemAt: ["$storeData.storeName", 0] },
        storeAddress: { $arrayElemAt: ["$storeData.address", 0] },
      },
    },
    {
      $lookup: {
        from: "cartitems",
        let: { variantId: "$variantId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.variantId", "$$variantId"] }, { $eq: ["$userId", userId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },
    {
      $addFields: {
        quantity: {
          $cond: [{ $ne: [{ $size: "$cartItemData" }, 0] }, "$cartItemData.quantity", [0]],
        },
      },
    },
    { $unwind: "$quantity" },

    { $skip: offset },
    { $limit: limit },
    // { $addFields: { quantity: { $arrayElemAt: ["$cartItemData.quantity", 0] } } },
    {
      $project: { productData: 0, storeData: 0, cartItemData: 0 },
    },
  ]);
  // let totalCount = products.length;
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { products },
  });
});

router.post("/", identityManager(["vendor"]), async (req, res) => {
  var { error } = validateProductPost(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  if (req.body.subCategory) req.body.subCategory = req.body.subCategory.trim()
  if (req.body.category) req.body.category = req.body.category.trim()

  // let category = await Category.findOne({ _id: req.body.product.category });
  // console.log("category", category);

  // let stock = 0
  // let count = await Product.countDocuments()
  // count = count + 1

  let product = new Product(_.pick(req.body, ["title", "coverImages", "quantityType", "thumbnailImages", "price", "blobImageObject", "description", "oldPrice", "category", "subCategory", "coverImage", "offerText", "calories", "weight", "unit"]));
  product.vendorId = req.jwtData.userId;
  if (!req.body.subCategory) {
    product.subCategory = "N.A.";
  }
  await product.save();
  product.productId = product._id;
  let response = _.pick(product, ["title", "productId", "price", "coverImages", "description", "blobImageObject", "oldPrice", "quantityType", "category", "thumbnailImages", "subCategory", "coverImage", "offerText", "calories", "weight", "unit"]);
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: {
      message: PRODUCT_CONSTANTS.INSERTED,
      response,
      // addedVariants: addedVariants,
    },
  });
});

router.get("/details", identityManager(["user", "store", "vendor"]), async (req, res) => {
  let criteria = {};
  if (req.query.isDeleted) criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria.isDeleted = false;
  if (req.query.productId) {
    criteria._id = mongoose.Types.ObjectId(req.query.productId);
  }
  // if (req.query.isHidden) criteria.isHidden = req.query.isHidden === "true" ? true : false
  // else criteria.isHidden = false

  if (req.jwtData.role === "vendor") {
    criteria.vendorId = req.jwtData.userId;
  } else {
    if (req.query.vendorId) {
      criteria.vendorId = req.query.vendorId;
    }
  }
  if (req.query.categoryName) criteria.category = req.query.categoryName;
  if (req.query.subCategoryName) criteria.subCategory = req.query.subCategoryName;
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.$or = [{ title: regexName }, { category: regexName }];
  }
  console.log("startDate", req.query.startDate, "endDate", req.query.endDate);
  if (req.query.startDate) criteria.insertDate = { $gte: parseInt(req.query.startDate) };
  if (req.query.endDate) criteria.insertDate = { $lte: parseInt(req.query.endDate) };
  if (req.query.startDate != null && req.query.endDate != null) {
    criteria.insertDate = {
      $gte: parseInt(req.query.startDate),
      $lte: parseInt(req.query.endDate),
    };
  }
  if (req.query.sort == "name") {
    sortOrder = { title: -1 };
  } else {
    sortOrder = { insertDate: -1 };

  }
  sortOrder = { title: 1 };

  var limit, offset;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);

  let productList = await Product.aggregate([
    { $match: criteria },
    { $sort: sortOrder },
    { $addFields: { productId: { $toString: "$_id" } } },
    // { $lookup: { from: "variants", localField: "productId", foreignField: "productId", as: "variants" } },
    {
      $lookup: {
        from: "toppings",
        let: { productId: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", criteria.isDeleted] }],
              },
            },
          },
          { $addFields: { toppingId: "$_id" } },
        ],
        as: "toppingData",
      },
    },
    { $skip: offset },
    { $limit: limit },
    {
      $project: { _id: 0, creationDate: 0, productCode: 0 },
    },
  ]);
  let totalCount = await Product.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, productList },
  });
});

//show topping details
router.get("/toppingDetails", identityManager(["user", "vendor"]), async (req, res) => {
  let criteria = {};
  if (req.query.isDeleted) criteria.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria.isDeleted = false;
  if (req.query.productId) criteria.productId = req.query.productId;
  if (req.query.toppingId) criteria._id = mongoose.Types.ObjectId(req.query.toppingId);
  var limit, offset;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  let toppingList = await Topping.aggregate([
    { $match: criteria },
    { $addFields: { toppingId: { $toString: "$_id" } } },
    // { $lookup: { from: "variants", localField: "productId", foreignField: "productId", as: "variants" } },
    // {
    //   $lookup: {
    //     from: "toppings",
    //     let: { productId: "$productId" },
    //     pipeline: [
    //       {
    //         $match: {
    //           $expr: {
    //             $and: [{ $eq: ["$productId", "$$productId"] }, { $eq: ["$isDeleted", criteria.isDeleted] }],
    //           },
    //         },
    //       },
    //       { $addFields: { toppingId: "$_id" } },
    //     ],
    //     as: "toppingData",
    //   },
    // },
    { $skip: offset },
    { $limit: limit },
    {
      $project: { _id: 0, creationDate: 0, insertDate: 0, productCode: 0 },
    },
  ]);
  let totalCount = await Topping.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, toppingList },
  });
});

// show the variants
router.get("/variantDetails", identityManager(["user", "vendor"]), async (req, res) => {
  var criteria = {};
  var criteria1 = {};
  var offset, limit;
  let userId = req.jwtData.userId;
  if (isNaN(parseInt(req.query.offset))) offset = 0;
  else offset = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limit = 500;
  else limit = parseInt(req.query.limit);
  if (req.query.categoryId) criteria.category = req.query.categoryId;
  if (req.query.subCategoryId) criteria.subCategory = req.query.subCategoryId;
  if (req.query.brand) criteria.brand = req.query.brand;
  // if(req.query.variantId)criteria1._id = req.query.variantId
  if (req.query.variantId) criteria1._id = mongoose.Types.ObjectId(req.query.variantId);
  if (req.query.productId) criteria1.productId = req.query.productId;
  // if (req.query.stockStatus && req.query.stockStatus == "inStock") criteria1.stock = { $gte: 10 }
  // if (req.query.stockStatus && req.query.stockStatus == "criticallyLow") criteria1.stock = { $lt: 10, $gt: 0 }
  // if (req.query.stockStatus && req.query.stockStatus == "outOfStock") criteria1.stock = { $eq: 0 }

  // if (req.query.isOutOfStock) criteria1.stock = req.query.isOutOfStock === "true" ? { $eq: 0 } : { $gt: 0 }
  if (req.query.isDeleted) criteria1.isDeleted = req.query.isDeleted === "true" ? true : false;
  else criteria1.isDeleted = false;
  if (req.query.minPrice) criteria1.price = { $gte: parseInt(req.query.minPrice) };
  if (req.query.maxPrice) criteria1.price = { $lte: parseInt(req.query.maxPrice) };
  if (req.query.minPrice != null && req.query.maxPrice != null)
    criteria1.price = {
      $gte: parseInt(req.query.minPrice),
      $lte: parseInt(req.query.maxPrice),
    };
  if (req.query.title) criteria.title = new RegExp(req.query.title, "i");
  let products = await Variant.aggregate([
    { $match: criteria1 },
    { $addFields: { productId: { $toObjectId: "$productId" } } },
    { $addFields: { variantId: { $toString: "$_id" } } },

    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "productData" } },

    {
      $addFields: {
        title: { $arrayElemAt: ["$productData.title", 0] },
        coverImage: { $arrayElemAt: ["$productData.coverImage", 0] },
        coverImages: { $arrayElemAt: ["$productData.coverImages", 0] },
        brand: { $arrayElemAt: ["$productData.brand", 0] },
        subCategory: { $arrayElemAt: ["$productData.subCategory", 0] },
        category: { $arrayElemAt: ["$productData.category", 0] },
        storeId: { $arrayElemAt: ["$productData.storeId", 0] },
        // imageUrl: { $arrayElemAt: ["$productData.imageUrl", 0] },
        description: { $arrayElemAt: ["$productData.description", 0] },

        // storeId: { $toObjectId: "$productData.storeId" },
      },
    },
    { $match: criteria },
    { $addFields: { storeId: { $toObjectId: { $arrayElemAt: ["$productData.storeId", 0] } } } },
    { $lookup: { from: "stores", localField: "storeId", foreignField: "_id", as: "storeData" } },
    {
      $addFields: {
        storeName: { $arrayElemAt: ["$storeData.storeName", 0] },
        storeAddress: { $arrayElemAt: ["$storeData.address", 0] },
      },
    },
    {
      $lookup: {
        from: "cartitems",
        let: { variantId: "$variantId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$items.variantId", "$$variantId"] }, { $eq: ["$userId", userId] }],
              },
            },
          },
        ],
        as: "cartItemData",
      },
    },
    {
      $addFields: {
        quantity: {
          $cond: [{ $ne: [{ $size: "$cartItemData" }, 0] }, "$cartItemData.quantity", [0]],
        },
      },
    },
    { $unwind: "$quantity" },
    {
      $facet: {
        totalCount: [{ $group: { _id: null, count: { $sum: 1 } } }],
        docs: [
          { $skip: offset },
          { $limit: limit },
          {
            $project: { productData: 0, storeData: 0, cartItemData: 0, _id: 0 },
          },
        ],
      },
    },

    { $addFields: { quantity: { $arrayElemAt: ["$cartItemData.quantity", 0] } } },
    {
      $project: { productData: 0, storeData: 0, cartItemData: 0 },
    },
  ]);
  let totalCount = products[0].totalCount.length > 0 ? products[0].totalCount[0].count : 0;
  products = products[0].docs;
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, products },
  });
});

router.put("/", identityManager(["vendor", "admin"]), async (req, res) => {
  var { error } = validateProductPut(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  // let product = await Product.findById(req.body.productId);
  let product = await Product.findOne({ _id: req.body.productId });
  if (!product)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PRODUCT_CONSTANTS.NOT_FOUND },
    });
  // to remove extra spaces around  
  if (req.body.subCategory) req.body.subCategory = req.body.subCategory.trim()
  if (req.body.category) req.body.category = req.body.category.trim()
  product.title = req.body.title || product.title;
  product.description = req.body.description || product.description;
  console.log("req.body.category", req.body.category, "productCategory", product.category);

  if (req.body.category && req.body.category != product.category) {
    console.log("inCatDa", req.body.subCategory, product.subCategory);

    console.log("inCat", product.subCategory, req.body.subCategory);

    if (!(product.subCategory != "N.A." && req.body.subCategory != product.subCategory && req.body.subCategory)) {
      console.log("inSubCat");
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: PRODUCT_CONSTANTS.SUBCATEGORY_REQUIRED },
      });
    }
  }
  product.category = req.body.category || product.category;

  product.oldPrice = req.body.oldPrice || product.oldPrice;
  if (req.body.price != product.price) {
    await CartItem.deleteMany({ "items.productId": product._id.toString() });
  }

  product.price = req.body.price || product.price;
  product.coverImages = req.body.coverImages || product.coverImages;
  product.subCategory = req.body.subCategory || product.subCategory;
  product.coverImage = req.body.coverImage || product.coverImage;
  product.thumbnailImages = req.body.thumbnailImages || product.thumbnailImages;
  product.blobImageObject = req.body.blobImageObject || product.blobImageObject;
  product.calories = req.body.calories == "" ? req.body.calories : req.body.calories || product.calories;
  product.weight = req.body.weight == "" ? req.body.weight : req.body.weight || product.weight;
  product.unit = req.body.unit == "" ? req.body.unit : req.body.unit || product.unit;
  product.offerText = req.body.offerText || product.offerText;
  product.quantityType = req.body.quantityType || product.quantityType;
  if (req.body.hasOwnProperty("isHidden")) product.isHidden = req.body.isHidden;
  if (req.body.hasOwnProperty("isSoldOut")) product.isSoldOut = req.body.isSoldOut;

  await product.save();
  product.productId = product._id;
  let response = _.pick(product, [
    "title",
    "productId",
    "price",
    "description",
    "oldPrice",
    "quantityType",
    "category",
    "subCategory",
    "coverImage",
    "offerText",
    "thumbnailImages",
    "unit",
    "weight",
    "calories",
    "isSoldOut",
  ]);
  // let variants = req.body.variants;
  // for (obj of variants) {
  //   if (req.body.isUpdated) {
  //     variant = await Variant.findOne({ _id: obj._id });
  //     variant.price = obj.price || variant.price;
  //     variant.imageUrl = obj.imageUrl || variant.imageUrl;
  //     variant.mrp = obj.mrp || variant.mrp;
  //     variant.stock = obj.stock || variant.stock;
  //     variant.offer = obj.offer || variant.offer;
  //     variant.weight = obj.weight || variant.weight;
  //     variant.unit = obj.unit || variant.unit;
  //     await variant.save();
  //   }
  // }
  // for (i = 0; i < req.body.variants.length; i++) {
  //   req.body.variants[i]["productId"] = product._id;
  //   console.log("idddd", product._id);
  //   req.body.variants[i]["variantCode"] = product.productCode + "_" + parseInt(i + 1);
  //   stock = stock + req.body.variants[i].stock;
  // }
  return res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: PRODUCT_CONSTANTS.UPDATED, response },
  });
});

router.delete("/:id", identityManager(["vendor", "admin"]), async (req, res) => {
  let criteria = {};
  criteria._id = req.params.id;
  let product = await Product.findOne({ _id: criteria });

  if (!product)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PRODUCT_CONSTANTS.NOT_FOUND },
    });
  product.isDeleted = true;
  await product.save();
  await CartItem.deleteMany({ "items.productId": product._id.toString() });

  await Topping.updateMany({ productId: criteria._id }, { isDeleted: true });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: PRODUCT_CONSTANTS.DELETED },
  });
});

router.post("/topping", identityManager(["vendor"]), async (req, res) => {
  var { error } = validateToppingPost(req.body);
  if (error)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let product = await Product.findById(req.body.productId);
  if (!product)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: PRODUCT_CONSTANTS.NOT_FOUND },
    });
  // let variant = await Variant.find({ productId: req.body.product.productId });
  let topping = new Topping(
    _.pick(req.body, [
      "productId",
      "toppingName",
      "lowerLimit",
      "upperLimit",
      "checkbox",
      "subtype",
      // "subCategory",
      // "coverImage",
      // "offerText",
      // "calories",
    ])
  );
  topping.vendorId = req.jwtData.userId;
  await topping.save();
  topping.toppingId = topping._id;
  let response = _.pick(topping, ["productId", "toppingId", "toppingName", "lowerLimit", "upperLimit", "checkbox", "subtype"]);
  // await topping.save();

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: {
      message: TOPPING_CONSTANTS.INSERTED,
      response,
    },
  });
});

router.put("/topping", identityManager(["vendor"]), async (req, res) => {
  var { error } = validateToppingPut(req.body);
  if (error)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  var topping = await Topping.findById(req.body.toppingId);
  if (!topping)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: TOPPING_CONSTANTS.NOT_FOUND },
    });

  topping.toppingName = req.body.toppingName || topping.toppingName;
  if (req.body.hasOwnProperty("lowerLimit")) {
    topping.lowerLimit = req.body.lowerLimit;
  }
  if (req.body.hasOwnProperty("lowerLimit")) {
    topping.upperLimit = req.body.upperLimit;
  }
  topping.checkbox = req.body.checkbox || topping.checkbox;
  topping.subtype = req.body.subtype || topping.subtype;
  await topping.save();
  topping.toppingId = topping._id;
  let response = _.pick(topping, ["productId", "toppingId", "toppingName", "lowerLimit", "upperLimit", "checkbox", "subtype"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: TOPPING_CONSTANTS.UPDATED, response },
  });
});

router.delete("/topping/:id", identityManager(["vendor"]), async (req, res) => {
  let topping = await Topping.findOne({ _id: req.params.id });
  console.log("ksf", topping);

  if (!topping) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: TOPPING_CONSTANTS.NOT_FOUND },
    });
  }

  topping.isDeleted = true;
  await topping.save();

  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: TOPPING_CONSTANTS.DELETED },
  });
});

router.put("/topping", identityManager(["vendor"]), async (req, res) => {
  var { error } = validateToppingPut(req.body);
  if (error)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  var topping = await Topping.findById(req.body.toppingId);
  if (!topping)
    return res.send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: TOPPING_CONSTANTS.NOT_FOUND },
    });

  topping.toppingName = req.body.toppingName || topping.toppingName;
  topping.lowerLimit = req.body.lowerLimit || topping.lowerLimit;
  topping.upperLimit = req.body.upperLimit || topping.upperLimit;
  topping.checkbox = req.body.price || topping.checkbox;
  topping.subtype = req.body.subtype || topping.subtype;
  await topping.save();
  topping.toppingId = topping._id;
  let response = _.pick(topping, ["productId", "toppingId", "toppingName", "lowerLimit", "upperLimit", "checkbox", "subtype"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: TOPPING_CONSTANTS.UPDATED, response },
  });
});

router.post("/payments", identityManager(["vendor", "public"]), async (req, res) => {
  let chargeObj = {
    tx_ref: req.body.tx_ref,
    amount: req.body.amount,
    currency: req.body.currency,
    redirect_url: req.body.redirect_url,
    payment_options: req.body.payment_options,
    meta: {
      consumer_id: req.body.meta.consumer_id,
      consumer_mac: req.body.meta.consumer_mac,
    },
    customer: {
      email: req.body.customer.email,
      phonenumber: req.body.customer.phonenumber,
      name: req.body.customer.name,
    },
    subaccounts: [
      {
        id: req.body.flutterwaveId,
        transaction_split_ratio: "10",

        transaction_charge: 1000,
        transaction_charge_type: "flat",
      },
    ],
    // customizations: {
    //   title: req.body.customizations.title,
    //   description: req.body.customizations.description,
    //   logo: req.body.customizations.logo,
    // },
  };
  // console.log("check");
  let response = await createTransaction(chargeObj);
  // let chargeObject = {
  //   token: req.body.cardToken,
  //   narration: config.get("narration"),
  //   tx_ref: req.body.tx_ref.toString(),
  //   amount: req.body.totalAmount || 10,
  //   currency: config.get("currency"),
  //   country: config.get("country"),
  //   email: "abc@zimblecode.com",
  //   subaccounts: [
  //     {
  //       id: req.body.flutterwaveId,
  //       transaction_split_ratio: "5",
  //       // transaction_charge_type: "flat_subaccount",
  //       // transaction_charge: req.body.amount,
  //     },
  //   ],
  //   phonenumber: req.body.mobile,
  //   first_name: req.body.first_name,
  //   last_name: req.body.last_name,
  // };
  // let response = await chargeWithToken(chargeObject);

  return res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { response },
  });
});

const uploadCsv = multer({ dest: "./csv_files/uploaded/" });

router.post("/bulkProduct", identityManager(["vendor"]), uploadCsv.single("csv"), async (req, res) => {
  var file = req.file;
  let products = await CsvToJson().fromFile(file.path);
  let reportData = [];
  for (product of products) {
    let reportObj = _.clone(product);
    var { error } = validateProductBulk(product);
    if (!error) {
      let newProduct = new Product(
        _.pick(product, ["title", "price", "coverImages", "oldPrice", "description", "category", "subCategory", "coverImage", "offerText", "calories", "weight", "unit"])
      );
      newProduct.vendorId = req.jwtData.userId;
      await newProduct.save();

      if (product.topping.length > 0) {
        let toppingArray = [];
        for (i = 0; i < product.topping.length; i++) {
          product.topping[i].productId = newProduct._id;
          if (product.topping[i].checkbox.toLowerCase == "false") {
            product.topping[i].checkbox = false;
          } else {
            product.topping[i].checkbox = true;
          }
          toppingArray.push(product.topping[i]);
        }
        await Topping.insertMany(toppingArray);
      }
      reportObj.status = "success";
      reportObj.message = "Product added successfully.";
    } else {
      reportObj.status = "failure";
      reportObj.message = valMsgFormatter(error.details[0].message);
    }
    reportData.push(reportObj);
  }
  const csv = new ObjectsToCsv(reportData);
  await csv.toDisk("./test.csv");
  // console.log("download", download);
  // res.download("./test.csv");
  return res.send({ statusCode: 200, message: "Success", data: { reportData } });

  // let data = await properData(successArray, failureArray);
  // console.log(".........", data);
  // console.log("222", properData.bulkSuccessData);
  // await generateBulkRequest(data.bulkSuccessData, data.bulkFailureData, data.status, "CREATE");
  // const csv = new ObjectsToCsv(bulkFailureData);
  // await csv.toDisk("./test.csv");
  // // console.log(await csv.toString());
  // res.send({
  //   addedProducts: successArray,
  //   rejectedProducts: failureArray
  // });
});
module.exports = router;

// TODO
// add category and unit
