// const cloudinary = require("cloudinary").v2; //! Cloudinary is being required

// exports.cloudinaryConnect = () => {
// 	try {
// 		cloudinary.config({
// 			//!    ########   Configuring the Cloudinary to Upload MEDIA ########
// 			cloud_name: process.env.CLOUD_NAME,
// 			api_key: process.env.API_KEY,
// 			api_secret: process.env.API_SECRET,
// 		});
// 	} catch (error) {
//         console.log("cloudinary connect mein error aa raha h");
// 		console.log(error);
// 	}
// };

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'samples', // Folder in Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});
const upload = multer({ storage });

module.exports = { storage, upload };