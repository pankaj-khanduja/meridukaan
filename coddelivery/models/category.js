const Joi = require("joi");
const mongoose = require("mongoose");
Joi.objectId = require("joi-objectid")(Joi);

const catSchema = new mongoose.Schema({
  vendorId: String,
  categoryName: { type: String },
  image: { type: String },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    }
  },
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  }
});
// catSchema.index({ categoryName: 1, vendorId: 1 }, { unique: true });

const subCatSchema = new mongoose.Schema({
  vendorId: String,
  categoryId: { type: String },
  subCategoryName: { type: String },
  image: { type: String },
  description: { type: String },
  insertDate: {
    type: Number,
    default: () => {
      return Math.round(new Date() / 1000);
    }
  },
  creationDate: {
    type: Date,
    default: () => {
      return new Date();
    }
  }
});
// subCatSchema.index({ subCategoryName: 1, categoryId: 1 }, { unique: true });

// const unitSchema = new mongoose.Schema({
//   unit:{type:String}
// })

const Category = mongoose.model("Category", catSchema);
const SubCategory = mongoose.model("SubCategory", subCatSchema);
// const Unit = mongoose.model("Unit", unitSchema);

function validateCategory(cat) {
  const schema = Joi.object({
    categoryName: Joi.string().min(2).max(50).required(),
    image: Joi.string(),

  });
  return schema.validate(cat);
}
function validateCategoryPut(cat) {
  const schema = Joi.object({
    categoryName: Joi.string().min(2).max(50),
    categoryId: Joi.objectId().required(),
    image: Joi.string(),
  });
  return schema.validate(cat);
}
function validateSubCategory(subCat) {
  const schema = Joi.object({
    subCategoryName: Joi.string().min(2).max(50).required(),
    categoryId: Joi.objectId()
      .required()
      .error(() => {
        return {
          message: "Category is not allowed to empty."
        };
      })

    // store:Joi.objectId().required(),
    // vendorId:Joi.objectId().required(),
  });

  return schema.validate(subCat);
}
function validateSubCategoryPut(subCat) {
  const schema = Joi.object({
    subCategoryName: Joi.string().min(2).max(50),
    subCategoryId: Joi.string().required()
  });
  return schema.validate(subCat);
}

exports.Category = Category;
exports.SubCategory = SubCategory;
// exports.Unit = Unit;
exports.validateSubCategory = validateSubCategory;
exports.validateCategory = validateCategory;
exports.validateSubCategoryPut = validateSubCategoryPut;
exports.validateCategoryPut = validateCategoryPut;
