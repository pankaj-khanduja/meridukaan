const { CAT_CONSTANTS, VENDOR_CONSTANTS, SUB_CAT_CONSTANTS } = require("../config/constant.js");
const mongoose = require("mongoose");
const { Category, SubCategory, validateSubCategory, validateCategory, validateCategoryPut, validateSubCategoryPut } = require("../models/category");
const { Product } = require("../models/product");
const { identityManager } = require("../middleware/auth");
const express = require("express");
const _ = require("lodash");

const { Store } = require("../models/vendor.js");
const router = express.Router();

/*******************category ENDPOINTS*******************************/

router.post("/", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateCategory(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  let updatedName = await req.body.categoryName
    .toLowerCase()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ");
  let category = new Category({
    categoryName: updatedName,
    image: req.body.image,
    description: req.body.description,
  });
  category.vendorId = req.jwtData.userId;
  console.log("vendorId", category.userId);

  try {
    await category.save();
  } catch (Ex) {
    console.log(Ex);
    if (Ex.code === 11000)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "Category already exists." },
      });
    else {
      console.log(Ex);
      return res.send({ msg: "Something Failed" });
    }
  }
  category.categoryId = category._id;
  let response = _.pick(category, ["categoryId", "vendorId", "categoryName"]);

  // await category.save();
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: {
      message: CAT_CONSTANTS.CAT_CREATE,
      response,
    },
  });
});

router.get("/", identityManager(["vendor", "user", "public"]), async (req, res) => {
  // let category = await Category.find();
  let criteria = {};

  if (req.query.limit) {
    limit = parseInt(req.query.limit);
  } else limit = 500;
  if (req.query.offset) {
    offset = parseInt(req.query.offset);
  } else offset = 0;
  if (req.query.categoryId) {
    criteria._id = req.query.categoryId;
  }
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.category = regexName;
  }
  if (req.jwtData.role === "vendor") {
    criteria.vendorId = req.jwtData.userId;
  } else {
    if (req.query.vendorId) criteria.vendorId = req.query.vendorId;
  }
  let category = await Category.aggregate([
    { $match: criteria },
    { $skip: offset },
    { $limit: limit },

    {
      $addFields: {
        categoryId: { $toString: "$_id" },
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "categoryId",
        foreignField: "categoryId",
        as: "subcategories",
      },
    },
    { $addFields: { subcategoriesCount: { $size: "$subcategories" } } },

    { $project: { _id: 0, __v: 0, subcategories: 0 } },
  ]);
  let totalCount = await Category.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, category },
  });
});

router.put("/", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateCategoryPut(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  console.log("fkjjjjjjjjjjjjjj", req.body.categoryId);
  let category = await Category.findOne({ _id: req.body.categoryId });

  if (!category)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CAT_CONSTANTS.CAT_NOT_FOUND },
    });
  let oldCategoryName = category.categoryName;

  category.image = req.body.image || category.image;
  category.description = req.body.description || category.description;

  let updatedName = await req.body.categoryName
    .toLowerCase()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ");

  category.categoryName = updatedName || category.categoryName;
  try {
    await category.save();
  } catch (Ex) {
    if (Ex.code === 11000)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "Category already exists" },
      });
    else {
      return res.send({ message: "Something Failed" });
    }
  }
  category.categoryId = category._id;
  let response = _.pick(category, ["categoryId", "vendorId", "categoryName"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: CAT_CONSTANTS.CAT_UPDATE, response },
  });
  await Product.updateMany({ category: oldCategoryName, vendorId: category.vendorId }, { $set: { category: updatedName } });
});

router.delete("/:id", identityManager(["vendor"]), async (req, res) => {
  let criteria = {};
  criteria._id = req.params.id;
  let product = await Product.findOne({ category: criteria._id });
  if (product) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: {
        message: "Product with the same category exists. You need to edit or delete the product first",
      },
    });
  }
  let category = await Category.findOne({ _id: criteria });
  if (!category)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: CAT_CONSTANTS.CAT_NOT_FOUND },
    });
  // let vendorCode = req.header("vendorCode")
  // if (category.vendorCode !== vendorCode) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: VENDOR_CONSTANTS.UNAUTHORIZED_VENDOR },
  //   })
  // }
  await Category.deleteOne({ _id: criteria });

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: CAT_CONSTANTS.CAT_DELETED, category },
  });
  await Product.updateMany({ category: category.categoryName, vendorId: category.vendorId }, { $set: { isDeleted: true } });
  await SubCategory.deleteMany({ categoryId: criteria._id });
});

router.post("/subCategory", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateSubCategory(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });

  // let category = new Category(req.body);
  let subCategoryName = await req.body.subCategoryName
    .toLowerCase()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ");
  let subCategory = new SubCategory({
    subCategoryName: subCategoryName,
    categoryId: req.body.categoryId,
    // image: req.body.image,
    // description: req.body.description,
  });

  subCategory.vendorId = req.jwtData.vendorId;
  try {
    await subCategory.save();
  } catch (Ex) {
    console.log(Ex);
    if (Ex.code === 11000)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "Sub Category already exists." },
      });
    else {
      console.log(Ex);
      return res.send({ msg: "Something Failed" });
    }
  }
  subCategory.subCategoryId = subCategory._id;
  let response = _.pick(subCategory, ["categoryId", "subCategoryId", "subCategoryName"]);

  // await category.save();
  // await Product.updateMany({ subCategory: oldCategoryName, vendorId: category.vendorId }, { $set: { category: updatedName } });
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUB_CAT_CONSTANTS.SUB_CAT_CREATE, response },
  });
});

router.get("/subCategory", identityManager(["vendor", "user", "public"]), async (req, res) => {
  let criteria = {};
  let criteria1 = {};
  if (req.query.categoryId) {
    criteria.categoryId = req.query.categoryId;
  }
  // if (req.query.categoryName) {
  //   var regexName = new RegExp(req.query.categoryName, "i");

  //   criteria1.categoryName = regexName;
  // }
  if (req.query.subCategoryId) {
    criteria._id = req.query.subCategoryId;
  }

  if (req.query.limit) {
    limit = parseInt(req.query.limit);
  } else limit = 500;
  if (req.query.offset) {
    offset = parseInt(req.query.offset);
  } else offset = 0;
  let subCategory = await SubCategory.aggregate([
    { $match: criteria },

    { $skip: offset },
    { $limit: limit },
    { $addFields: { categoryId: { $toObjectId: "$categoryId" } } },
    { $lookup: { from: "categories", localField: "categoryId", foreignField: "_id", as: "categoryData" } },
    { $addFields: { categoryName: { $arrayElemAt: ["$categoryData.categoryName", 0] } } },
    // { $match: criteria1 },
    {
      $lookup: {
        from: "products",
        localField: "subCategoryName",
        foreignField: "subCategory",
        as: "productData",
      },
    },
    { $addFields: { productCount: { $size: "$productData" } } },
    {
      $project: {
        subCategoryId: "$_id",
        _id: 0,
        subCategoryName: 1,
        categoryId: 1,
        categoryName: 1,
        productCount: 1,
      },
    },
  ]);
  let totalCount = await SubCategory.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, subCategory },
  });
});

router.put("/subCategory", identityManager(["vendor"]), async (req, res) => {
  const { error } = validateSubCategoryPut(req.body);
  if (error)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: error.details[0].message },
    });
  let subCategory = await SubCategory.findOne({ _id: req.body.subCategoryId });
  if (!subCategory) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUB_CAT_CONSTANTS.SUB_CAT_NOT_FOUND },
    });
  }
  let oldSubCategoryName = subCategory.subCategoryName;

  let updatedName = await req.body.subCategoryName
    .toLowerCase()
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ");
  //  }
  subCategory.subCategoryName = updatedName || subCategory.subCategory;

  console.log("fdjsfn", updatedName);
  // subCategory._id = updatedName
  // } else {
  //   subCategory.image = req.body.image || subCategory.image
  //   subCategory.description = req.body.description || subCategory.description
  //   subCategory.categoryId = req.body.categoryId || subCategory.categoryId
  // }

  // subCategory.image = req.body.image || subCategory.image;

  try {
    await subCategory.save();
    // if (req.body.subCategoryId != subCategory._id) {
    //   await SubCategory.deleteOne({ _id: req.body.subCategoryId })
  } catch (Ex) {
    if (Ex.code === 11000)
      return res.status(400).send({
        apiId: req.apiId,
        statusCode: 400,
        message: "Failure",
        data: { message: "Sub Category already exists" },
      });
    else {
      return res.send({ message: "Something Failed" });
    }
  }
  subCategory.subCategoryId = subCategory._id;
  let response = _.pick(subCategory, ["categoryId", "subCategoryId", "subCategoryName"]);

  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUB_CAT_CONSTANTS.SUB_CAT_UPDATE, response },
  });
  await Product.updateMany({ subCategory: oldSubCategoryName }, { $set: { subCategory: updatedName } });
});

router.delete("/subCategory/:id", identityManager(["vendor"]), async (req, res) => {
  // let subCategory = await SubCategory.findOne({ _id: req.params.id });
  let criteria = {};
  criteria._id = req.params.id;
  let subCategory = await SubCategory.findOne({ _id: criteria });
  if (!subCategory)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: SUB_CAT_CONSTANTS.SUB_CAT_NOT_FOUND },
    });
  // let vendorCode = req.header("vendorCode")
  // if (subCategory.vendorCode !== vendorCode) {
  //   return res.status(400).send({
  //     apiId: req.apiId,
  //     statusCode: 400,
  //     message: "Failure",
  //     data: { message: VENDOR_CONSTANTS.UNAUTHORIZED_VENDOR },
  //   })
  // }
  let product = await Product.findOne({ subCategory: subCategory.subCategoryName });
  if (product) {
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: {
        message: "Product with the same Sub category exists. You need to edit or delete the product first",
      },
    });
  }

  await SubCategory.deleteOne({ _id: criteria });
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: SUB_CAT_CONSTANTS.SUB_CAT_DELETED, subCategory },
  });
  await Product.updateMany({ subCategory: oldSubCategoryName, vendorId: "subCategory.vendorId" }, { $set: { subCategory: updatedName } });
  await Product.updateMany({ category: subCategory.subCategoryName, vendorId: category.vendorId }, { $set: { isDeleted: true } });
});

module.exports = router;
