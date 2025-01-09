const mongoose = require("mongoose");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);

const productSchema = new mongoose.Schema({
  vendorId: String,
  title: String,
  subCategory: { type: String },
  category: { type: String },
  // vendor: { type: String },
  description: { type: String, default: "" },
  coverImage: { type: String, default: "" },
  price: Number,
  oldPrice: Number,
  offerText: String,
  calories: String,
  weight: String,
  unit: String,
  isHidden: { type: Boolean, default: false },
  itemsSold: { type: Number, default: 0 },
  isSoldOut: { type: Boolean, default: false },
  // isFeatured: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  thumbnailImages: { type: [String] },
  blobImageObject: { type: Object },
  quantityType: { type: String },
  coverImages: { type: Array },
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

const toppingSchema = new mongoose.Schema({
  vendorId: String,
  productId: { type: String },
  toppingName: { type: String },
  lowerLimit: { type: Number, default: 0 },
  upperLimit: { type: Number, default: 1 },
  checkbox: { type: Boolean, default: false },
  subtype: [
    {
      name: String,
      price: Number,
    },
  ],

  // mrp: { type: Number, default: 0 },
  // price: { type: Number, default: 0 },
  // discount: { type: Number, default: 0 },
  // itemsSold: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
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

const Product = mongoose.model("Product", productSchema);
const Topping = mongoose.model("Topping", toppingSchema);

function validateProductPost(product) {
  const schema = Joi.object({
    title: Joi.string().required(),
    price: Joi.number().required(),
    oldPrice: Joi.string(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    subCategory: Joi.string(),
    coverImage: Joi.string(),
    thumbnailImages: Joi.array(),
    offerText: Joi.string(),
    calories: Joi.string().allow(""),
    weight: Joi.string().allow(""),
    quantityType: Joi.string().allow(""),
    unit: Joi.string().allow(""),
    coverImages: Joi.array(),
    blobImageObject: Joi.object(),

    // offer: Joi.objectId(),
  });
  return schema.validate(product);
}

// function validateProductPut(product) {
//   const schema = Joi.object({
//     productId: Joi.string().required(),
//     title: Joi.string(),
//     // vendor: Joi.objectId(),
//     coverImage: Joi.string(),
//     // isDeleted:Joi.boolean(),
//     category: Joi.string(),
//     subCategory: Joi.string(),
//     brand: Joi.string(),
//     // unit: Joi.objectId()
//     // offer: Joi.objectId(),
//   });
//   return schema.validate(product);
// }
function validateProductPut(product) {
  const schema = Joi.object({
    productId: Joi.objectId(),
    title: Joi.string(),
    price: Joi.number(),
    oldPrice: Joi.string(),
    description: Joi.string().allow(""),
    category: Joi.string(),
    isHidden: Joi.boolean(),
    isSoldOut: Joi.boolean(),
    subCategory: Joi.string(),
    coverImage: Joi.string(),
    offerText: Joi.string(),
    calories: Joi.string().allow(""),
    weight: Joi.string().allow(""),
    unit: Joi.string().allow(""),
    coverImages: Joi.array(),
    quantityType: Joi.string().allow(""),
    thumbnailImages: Joi.array(),
    blobImageObject: Joi.object(),


    // offer: Joi.objectId(),
  });

  return schema.validate(product);
}

function validateToppingPost(topping) {
  const schema = Joi.object({
    productId: Joi.objectId().required(),
    // toppings: Joi.array().items(
    //   Joi.object({
    toppingName: Joi.string().required(),
    lowerLimit: Joi.number(),
    upperLimit: Joi.number(),
    checkbox: Joi.boolean(),
    subtype: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        price: Joi.number().required(),
      })
    ),
  });
  return schema.validate(topping);
}

function validateToppingPut(variant) {
  const schema = Joi.object({
    toppingId: Joi.string().required(),
    toppingName: Joi.string(),
    lowerLimit: Joi.number(),
    upperLimit: Joi.number(),
    checkbox: Joi.boolean(),
    subtype: Joi.array().items(
      Joi.object({
        name: Joi.string(),
        price: Joi.number(),
      })
    ),
  });
  return schema.validate(variant);
}
function validateProductBulk(product) {
  const schema = Joi.object({
    // product: Joi.object({
    title: Joi.string().required(),
    price: Joi.number().required(),
    oldPrice: Joi.string(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    subCategory: Joi.string(),
    coverImage: Joi.string(),
    coverImages: Joi.array(),
    quantityType: Joi.boolean(),
    thumbnailImages: Joi.array(),
    offerText: Joi.string().allow(""),
    calories: Joi.string().allow(""),
    weight: Joi.string().allow(""),
    unit: Joi.string().allow(""),
    // }),

    topping: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().allow(""),
          toppingName: Joi.string().required(),
          lowerLimit: Joi.number(),
          upperLimit: Joi.number(),
          checkbox: Joi.boolean(),
          subtype: Joi.array().items(
            Joi.object({
              name: Joi.string().required(),
              price: Joi.number().required(),
            })
          ),
        })
      )
      .min(1),
  });
  return schema.validate(product);
}
module.exports.Product = Product;
module.exports.Topping = Topping;
module.exports.validateProductBulk = validateProductBulk;
// module.exports.validateProductBulkUpdate = validateProductBulkUpdate
module.exports.validateProductPost = validateProductPost;
module.exports.validateProductPut = validateProductPut;
module.exports.validateToppingPost = validateToppingPost;
module.exports.validateToppingPut = validateToppingPut;
