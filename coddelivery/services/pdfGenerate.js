const PDFDocument = require("pdfkit");
const fs = require("fs");
const pdf = require("html-pdf");
const options = { format: "Letter" };

function buildPDF1(dataCallback, endCallback) {
  const doc = new PDFDocument({ bufferPages: true, font: "Courier" });

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  doc.fontSize(20).text(`A heading`);

  doc.fontSize(12).text(`Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maiores, saepe.`);
  doc.end();
}

async function generatePdf() {
  const pdfBuffer = await new Promise((resolve) => {
    const doc = new PDFDocument();
    doc.fontSize(20).text(`A heading`);

    doc.fontSize(12).text(`Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maiores, saepe.`);
    doc.end();

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
  });

  return {
    body: pdfBuffer
  };
}

const generateHtmlToPdf = function (template) {
  return new Promise((resolve, reject) => {
    // let html1 = "<h1>hello</h1>";
    pdf.create(template, options).toBuffer(function (err, buffer) {
      if (err) {
        reject(new Error("File upload failed"));
      }
      resolve(buffer);
    });
  });
};

module.exports.generateHtmlToPdf = generateHtmlToPdf;
module.exports.generatePdf = generatePdf;
// module.exports = { generatePdf };
