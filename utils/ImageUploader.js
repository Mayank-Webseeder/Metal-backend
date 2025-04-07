
const fileupload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

exports.localFileUpload = async (files) => {
    try {
        // Ensure `files` is always an array
        const filesArray = Array.isArray(files) ? files : [files];

        // Define the relative upload directory (e.g., "/uploads")
        const uploadDir = path.join(__dirname, "../uploads");  // Move outside 'utils'

        // Create the upload directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Upload all files
        const uploadResults = await Promise.all(
            filesArray.map((file) => {
                return new Promise((resolve, reject) => {
                    const filename = `${Date.now()}_${file.name}`;
                    const uploadPath = path.join(uploadDir, filename); // Full path for saving
                    const relativePath = `/uploads/${filename}`; // Store relative path

                    file.mv(uploadPath, (err) => {
                        if (err) reject(err);
                        else resolve({ path: relativePath }); // Return relative path
                    });
                });
            })
        );

        return uploadResults;

    } catch (error) {
        console.error("File upload failed:", error.message);
        throw new Error("File upload failed");
    }
};

