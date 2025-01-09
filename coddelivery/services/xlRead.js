
const { uploadFileS3, uploadDirectFileS3 } = require("./s3Upload");
const { Category, SubCategory } = require("../models/category");
const { Product } = require("../models/product");



async function readImage(fileName) {
    const ExcelJS = require('exceljs');
    const fs = require('fs');
    const config = require('config');
    const workbook = new ExcelJS.Workbook();
    // const data = await workbook.xlsx.readFile('/Users/zimble/Downloads/Daarlorestaurantmenu1.xlsx');
    const data = await workbook.xlsx.readFile(fileName);
    const worksheet = workbook.worksheets[0];
    let imageArray = worksheet.getImages();
    console.log(imageArray, "imageArray");

    let excelTitles = [];
    let excelData = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 0) {
            let rowValues = row.values;
            rowValues.shift();
            if (rowNumber === 1) excelTitles = rowValues;
            else {
                let rowObject = {}
                for (let i = 0; i < excelTitles.length; i++) {
                    console.log(rowNumber)
                    let title = excelTitles[i];
                    let value = rowValues[i] ? rowValues[i] : '';
                    rowObject[title] = value;
                }
                excelData.push(rowObject);
            }
        }
    })

    for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        row.imageUrl = await getImage(i);
    }
    // console.log("excelData", excelData);


    async function getImage(index) {
        const image = imageArray[index];
        const img = workbook.model.media.find(m => m.index === image.imageId);

        const FileUrl = "https://s3." + config.get("S3_BUCKET_REGION") + ".amazonaws.com/" + config.get("S3_BUCKET_NAME") + "/";
        const Key = Math.round(new Date()).toString();
        var url = FileUrl + "daarlo/" + Key;

        try {
            await uploadDirectFileS3(Key, "daarlo", img.buffer, img.extension, "inlineDisplay");
        } catch (Ex) {
            console.log("Exception: ", Ex);
        }
        return url;
    }


    return excelData;
}

async function updateData() {
    let fileName = "/Users/zimble/Downloads/Daarlorestaurantmenu1.xlsx";
    let vendorId = "61b2ed27a6781f00160ed002";

    let excelDataRead = await readImage(fileName);
    console.log(excelDataRead, "excelDataRead");
    if (excelDataRead.length > 0) {
        for (let i = 0; i < excelDataRead.length; i++) {
            const element = excelDataRead[i];
            if (element.Category != "" && element.Subcategory != "" && element["Product Name"] != "" && element.imageUrl != "") {
                let checkCategory = await Category.findOne({ categoryName: element.Category.trim(), vendorId: vendorId });
                if (checkCategory) {
                    let checkSubCategory = await SubCategory.findOne({ categoryId: checkCategory._id, subCategoryName: element.Subcategory.trim(), vendorId: vendorId });
                    if (checkSubCategory) {
                        let checkProducts = await Product.findOne({ vendorId: vendorId, title: element["Product Name"].trim(), subCategory: checkSubCategory.subCategoryName, category: checkCategory.categoryName });
                        if (checkProducts) {
                            await Product.updateOne({ _id: checkProducts._id }, { $set: { coverImage: element.imageUrl }, $push: { thumbnailImages: element.imageUrl, coverImages: element.imageUrl } },);
                            console.log("success");
                        } else {
                            console.log("product update fail");
                        }

                    } else {
                        console.log("not get  subcategory");
                    }
                } else {
                    console.log("not get category");
                }

            }



        }


    }
}

module.exports.updateData = updateData;
