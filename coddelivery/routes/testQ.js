// // const fs = require('fs');
// // const AWS = require('aws-sdk');
// // let blob = Buffer(['https://s3.us-east-2.amazonaws.com/waive/waive/1701347581440_blob'], { type: 'text/plain' });
// // console.log(blob);

// const AWS = require('aws-sdk');

// // Configure AWS with your credentials and region
// AWS.config.update({
//   accessKeyId: 'AKIARQTORDLLSU74VEFC',
//   secretAccessKey: 'Pq+5O2h9tjzThV8cf/gFZI4UT60eWM77J2Qa8A8w',
//   region: 'us-east-2'
// });


// // Create an S3 instance
// const s3 = new AWS.S3();

// // Function to get an S3 object as a buffer using the URL
// const getS3ObjectFromUrl = async (s3Url) => {
//   const urlParts = s3Url.split('/');
//   const bucketName = urlParts[3]; // Extracting bucket name
//   const objectKey = urlParts.slice(4).join('/'); // Extracting object key

//   const params = {
//     Bucket: bucketName,
//     Key: objectKey
//   };

//   try {
//     const data = await s3.getObject(params).promise();
//     return data.Body;
//   } catch (error) {
//     console.error(`Error fetching S3 object: ${error}`);
//     return null;
//   }
// };

// // Replace 'YOUR_ACCESS_KEY_ID', 'YOUR_SECRET_ACCESS_KEY', and 'YOUR_REGION' with your AWS credentials and region
// const s3Url = 'https://s3.us-east-2.amazonaws.com/waive/waive/1701347581440_blob';

// // Fetch S3 object as a buffer using the URL
// getS3ObjectFromUrl(s3Url)
//   .then(buffer => {
//     if (buffer) {
//       let buf = buffer;
//       console.log(buf.toString('hex'), "tttteeeessssttt");

//       // console.log(buf.toString('base64')); 
//     } else {
//       console.log('Buffer is null. Object not found or error occurred.');
//     }
//   })
//   .catch(error => {
//     console.error('Error:', error);
//   });



// function test() {

//   // [1, 2, 3] -> [1, 2, 4]
//   let array = [1, 2, 3];
//   let reduceNo = array.reduce((acc, val) => acc + val, '');

//   reduceNo = result + 1;
//   let result = Array.from(String(reduceNo), Number);

//   console.log(result, "result");



// }



const bodyParser = require("body-parser");

var x;
x = bodyParser.toString(123456789123456789)
console.log(x, "xs");