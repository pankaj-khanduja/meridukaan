const Joi = require("joi");
const config = require("config");
const mongoose = require("mongoose");
const { array } = require("joi");

const cartSchema = new mongoose.Schema({
  vendorId: String,
  deviceToken: { type: String, default: "" },
  userId: { type: String },
  subTotal: { type: Number, default: 0 },
  totalAmount: { type: Number },
  referralDiscount: { type: Number, default: 0 },
  cartDiscount: { type: Number, default: 0 },
  couponId: { type: String, default: "" },
  couponCode: { type: String, default: "" },
  totalItems: { type: Number },
  deliveryCharges: { type: Number, default: 0 },
  sendCartNotification: { type: Boolean, default: true },
  distance: Number,
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

const Cart = mongoose.model("Cart", cartSchema);

const cartItemSchema = new mongoose.Schema({
  cartId: { type: String },
  items: {
    productId: String,
    productPrice: { type: Number, default: 0 },

    subtypesTotal: { type: Number, default: 0 },

    uniqueItemId: { type: String, default: "" },
    subtypes: [
      {
        toppingName: String,
        toppingId: String,
        subtypeId: String,
        name: String,
        price: Number,
      },
    ],
  },
  quantity: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
  productDiscount: { type: Number, default: 0 },

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
const CartItem = mongoose.model("CartItem", cartItemSchema);
cartItemSchema.index({ cartId: 1, "items.productId": 1 }, { unique: true, partialFilterExpression: { "items.productId": { $exists: true } } });
function validateCreateCart(req) {
  const schema = Joi.object({
    deviceToken: Joi.string().required(),
  });
  return schema.validate(req);
}
function validateClearCart(req) {
  const schema = Joi.object({
    cartId: Joi.objectId().required(),
  });
  return schema.validate(req);
}
function validateViewCart(req) {
  const schema = Joi.object({
    cartId: Joi.string(),
    deviceToken: Joi.string().allow(""),
    lat1: Joi.number().required(),
    lon1: Joi.number().required(),
    // lat2: Joi.number().required(),
    // lon2: Joi.number().required(),
  });
  return schema.validate(req);
}
function validateAddItem(req) {
  const schema = Joi.object({
    cartId: Joi.objectId().required(),
    couponId: Joi.objectId(),
    lat1: Joi.number(),
    lon1: Joi.number(),
    productId: Joi.string().required(),
    vendorId: Joi.string().required(),
    subtypes: Joi.array(),
    quantity: Joi.number().required(),
  });
  return schema.validate(req);
}
function validateRemoveItem(req) {
  const schema = Joi.object({
    cartId: Joi.objectId().required(),
    couponId: Joi.objectId(),
    lat1: Joi.number(),
    lon1: Joi.number(),
    cartItemId: Joi.string().required(),
    vendorId: Joi.string().required(),
    isDeleteItem: Joi.boolean(),
  });
  return schema.validate(req);
}

async function createCart(deviceToken, userId) {
  let criteria;
  // if (userId) {
  //   criteria.userId
  // }
  let cart = await Cart.find({ $or: [{ userId: userId }, { deviceToken: deviceToken }] }).sort({ _id: 1 });
  console.log(cart);
  let cartId;
  if (cart.length > 1) {
    console.log("carrttt subTotal", cart[1].subTotal);
    if (cart[1].subTotal > 0) {
      cart[1].userId = userId;
      cart[1].deviceToken = deviceToken;
      if (userId && userId != "") {
        cart[1].deviceToken = "";
      }

      await cart[1].save();
      await Cart.deleteOne({ _id: cart[0]._id });
      await CartItem.deleteMany({ cartId: cart[0]._id.toString() });
      cartId = cart[1]._id.toString();
      console.log("cart iD with >1 subTotal > 0", cartId);
      return cartId;
    } else {
      cartId = cart[0]._id.toString();
      cart[0].userId = userId;
      cart[0].deviceToken = deviceToken;
      if (userId && userId != "") {
        cart[0].deviceToken = "";
      }
      await cart[0].save();
      console.log("cartIIIID", cartId);
      await Cart.deleteOne({ _id: cart[1]._id });
      await CartItem.deleteMany({ cartId: cart[1]._id.toString() });
      cartId = cart[0]._id.toString();

      return cartId;
    }
  } else if (cart.length == 1) {
    cartId = cart[0]._id.toString();
    cart[0].userId = userId;
    cart[0].deviceToken = deviceToken;
    if (userId && userId != "") {
      cart[0].deviceToken = "";
    }
    await cart[0].save();
    cartId = cart[0]._id.toString();
    console.log("cartIIIID length==1", cartId);

    return cartId;
  } else {
    cart = await new Cart({ deviceToken: deviceToken });
    cart.userId = userId;
    if (userId && userId != "") {
      cart.deviceToken = "";
    }
    await cart.save();
    cartId = cart._id.toString();
    console.log("first Time", cartId);
    return cartId;
  }
}

module.exports.Cart = Cart;
module.exports.CartItem = CartItem;
module.exports.createCart = createCart;
module.exports.validateCreateCart = validateCreateCart;
module.exports.validateClearCart = validateClearCart;
module.exports.validateAddItem = validateAddItem;
module.exports.validateRemoveItem = validateRemoveItem;

module.exports.validateViewCart = validateViewCart;
