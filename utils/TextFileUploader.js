const fileupload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

exports.textFileUpload = async (files) => {
    try {
        // Ensure `files` is always an array
        const filesArray = Array.isArray(files) ? files : [files];
        
        // Define the relative upload directory
        const uploadDir = path.join(__dirname, "../uploads/text");
        
        // Create the upload directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Text file extensions to accept
        const validExtensions = ['.txt', '.md', '.doc', '.docx', '.pdf', '.rtf', '.odt', '.lxd'];
        
        // Maximum file size (10MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        
        // Upload all files
        const uploadResults = await Promise.all(
            filesArray.map((file) => {
                return new Promise((resolve, reject) => {
                    // Validate file extension
                    const ext = path.extname(file.name).toLowerCase();
                    if (!validExtensions.includes(ext)) {
                        return reject(new Error(`Invalid file type: ${ext}. Only text document files are allowed.`));
                    }
                    
                    // Check file size
                    if (file.size > MAX_FILE_SIZE) {
                        return reject(new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`));
                    }
                    
                    // Generate safe filename
                    const safeFilename = `${Date.now()}_${path.basename(file.name, ext)}${ext}`.replace(/[^a-z0-9._-]/gi, '_');
                    const uploadPath = path.join(uploadDir, safeFilename);
                    const relativePath = `/uploads/text/${safeFilename}`;
                    
                    file.mv(uploadPath, (err) => {
                        if (err) reject(err);
                        else {
                            // Return file metadata along with path
                            resolve({ 
                                path: relativePath,
                                filename: safeFilename,
                                originalName: file.name,
                                size: file.size,
                                type: file.mimetype,
                                extension: ext,
                                uploadedAt: new Date()
                            });
                        }
                    });
                });
            })
        );
        
        return uploadResults;
    } catch (error) {
        console.error("Text file upload failed:", error.message);
        throw new Error(`Text file upload failed: ${error.message}`);
    }
};