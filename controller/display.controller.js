
const Order = require("../models/order.model");
const WorkQueue = require("../models/workQueueItem.model");
const User = require("../models/user.models");
const Cad = require("../models/cad.model");

const socketManager = require('../middlewares/socketmanager.js');
const archiver = require('archiver');

const path = require('path');
const fs = require('fs');


const { localFileUpload } = require("../utils/ImageUploader");
const Agenda = require('agenda');
const dotenv= require("dotenv");
const moment = require('moment-timezone'); 
dotenv.config();
const {getSockets}=require("../lib/helper.js");
const Log= require("../models/log.model");
const {changeStatusByCutout} = require("../service/websocketStatus")

async function sendAssignmentNotification(req, order) {
    try {
      console.log(`Sending notification for order ${order._id}`);
      const io = req.app.get("io");
      
      if (!io) {
        console.error("IO instance not found");
        return;
      }
      
      // Get the socket ID for the assigned user
      const assignedUserSocketId = socketManager.getUserSocket(order.assignedTo.toString());
      
      if (assignedUserSocketId) {
        console.log(`Emitting to socket: ${assignedUserSocketId}`);
        io.to(assignedUserSocketId).emit("assignment", {
          orderId: order._id,
          message: `Order ${order.orderId} has been assigned to you`
        });
        console.log(`Notification sent for order ${order._id}`);
      } else {
        console.log(`User ${order.assignedTo} is not connected`);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

exports.assignOrderToCutout = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { displayUserId } = req.body;

      const changes = [];
  
      if (!orderId || !displayUserId) {
        throw new Error("Order ID and Display User ID are required");
      }
  
      const order = await Order.findOne({
        $or: [{ _id: orderId }, { orderId }]
      });
  
      if (!order) throw new Error("Order not found");
  
      const displayUser = await User.findById(displayUserId);
      if (!displayUser) throw new Error("Display user not found");
  
      
      const user1 = await User.findById(order.assignedTo);
      const user2 = await User.findById(displayUser);
      changes.push(
        `Assigned to changed from ${user1.name} role:${user1.accountType} to ${user2.name} role:${user2.accountType}`
      );

      console.log("changes is:",changes);
      
      
      order.assignedTo = displayUserId;
      if (order.status !== "InWorkQueue") order.status = "InWorkQueue";
      await order.save();
      console.log("order is,",order);

        if (changes.length > 0) {
            for (const change of changes) {
              await Log.create({
                orderId: order._id,
                changes: change,
              });
            }
          }
      
  
      const populatedOrder = await Order.findById(order._id)
        .populate("customer", "name email")
        .populate("assignedTo", "name email");
        sendAssignmentNotification(req,order);
  
      return res.status(200).json({
        success: true,
        message: "Order successfully assigned to display user",
        data: {
          order: populatedOrder
        }
        
      });
  
    } catch (error) {
      console.error("Error assigning order:", error);
      return res.status(500).json({
        success: false,
        message: "Order assignment to display failed",
        error: error.message
      });
    }
  };

exports.changeStatus= async(req,res)=>{
    try {
      const {orderId,status}= req.body;
      
      const order = await Order.findOne({_id:orderId});
     
      if(!order){
        return res.status(404).json({
          success:false,
          message:"order not found"
        })
      }
      order.status= status;
      await order.save();
      changeStatusByCutout(req,order);
      
      return res.status(200).json({
        success:true,
        message:"order has been updated successfully"
      })


      
    } catch (error) {
      console.log("error",error);
      return res.status(400).json({
        success:false,
        message:error.message
      })
      
    }
  }
  
  

  exports.getCadFilesByOrderAndAssignedUser = async (req, res) => {
    try {
      
      const { orderId } = req.body;
      const assignedTo = req.user.id;
  
      
  
      // Step 1: Validate if the order exists and is assigned to the given user
      const order = await Order.findOne({
        _id: orderId,
        assignedTo: assignedTo,
      });
  
      
  
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found or not assigned to this user",
        });
      }
  
      // Step 2: Find all CAD entries related to the order
      const cadFiles = await Cad.find({ order: orderId });
      
  
      if (!cadFiles || cadFiles.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No CAD data found for this order",
        });
      }
  
      // Step 3: Send all CAD data (e.g., photo and CadFile)
      const formattedCadFiles = cadFiles.map((cad) => ({
        photo: cad.photo,
        CadFile: cad.CadFile,
      }));

      
  
      return res.status(200).json({
        success: true,
        data: formattedCadFiles,
      });
  
    } catch (error) {
      console.error("Error fetching CAD files:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
  




// Original controller to download single file (kept for backward compatibility)
exports.downloadCadFile = async (req, res) => {
  try {
    const { documentId, fileIndex } = req.params;
    console.log("documentId is:",documentId);
    console.log("file index is:",fileIndex);
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }
    
    // Find the CAD document by ID
    const cadDocument = await Cad.findOne({ order: documentId });
    console.log("cad Document is :",cadDocument);
    
    if (!cadDocument) {
      return res.status(404).json({
        success: false,
        message: "CAD document not found"
      });
    }
    
    // Get the file path based on type and index
    const index = parseInt(fileIndex);
    
    if (isNaN(index)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file index"
      });
    }
    
    const fileType = req.query.type || 'cad'; // Default to CAD file if not specified
    let relativePath;
    
    if (fileType === 'cad') {
      if (index < 0 || index >= cadDocument.CadFile.length) {
        return res.status(404).json({
          success: false,
          message: "CAD file index out of range"
        });
      }
      relativePath = cadDocument.CadFile[index];
    } else if (fileType === 'image') {
      if (index < 0 || index >= cadDocument.photo.length) {
        return res.status(404).json({
          success: false,
          message: "Image file index out of range"
        });
      }
      relativePath = cadDocument.photo[index];
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Must be 'cad' or 'image'"
      });
    }
    
    // Convert relative path to absolute file path
    // Remove leading slash if it exists
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    const absolutePath = path.join(__dirname, '..', cleanPath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server"
      });
    }
    
    // Get filename from path
    const filename = path.basename(absolutePath);
    
    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    
    if (fileType === 'cad') {
      switch(ext) {
        case '.dwg':
          res.setHeader('Content-Type', 'application/acad');
          break;
        case '.dxf':
          res.setHeader('Content-Type', 'application/dxf');
          break;
        case '.step':
        case '.stp':
          res.setHeader('Content-Type', 'application/step');
          break;
        case '.stl':
          res.setHeader('Content-Type', 'application/vnd.ms-pki.stl');
          break;
        default:
          res.setHeader('Content-Type', 'application/octet-stream');
      }
    } else if (fileType === 'image') {
      switch(ext) {
        case '.jpg':
        case '.jpeg':
          res.setHeader('Content-Type', 'image/jpeg');
          break;
        case '.png':
          res.setHeader('Content-Type', 'image/png');
          break;
        case '.gif':
          res.setHeader('Content-Type', 'image/gif');
          break;
        case '.webp':
          res.setHeader('Content-Type', 'image/webp');
          break;
        default:
          res.setHeader('Content-Type', 'image/jpeg');
      }
    }
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error("Error downloading file:", error);
    return res.status(500).json({
      success: false,
      message: "Error downloading file",
      error: error.message
    });
  }
};

// New controller to download all files in a ZIP archive
exports.downloadAllFiles = async (req, res) => {
  console.log("this is download all files controller", req.params);
  
  try {
    const { documentId } = req.params;
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }
    
    // Find the CAD document by ID
    const cadDocument = await Cad.findOne({ order: documentId });
    console.log("this is download all files contr", req.cadDocument);
    
    
    if (!cadDocument) {
      return res.status(404).json({
        success: false,
        message: "CAD document not found"
      });
    }
    
    // Check if we have files to download
    if (cadDocument.CadFile.length === 0 && cadDocument.photo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files found in this document"
      });
    }
    
    // Set response headers for ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=cad_files_${documentId}.zip`);
    
    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add all CAD files to archive
    for (let i = 0; i < cadDocument.CadFile.length; i++) {
      const relativePath = cadDocument.CadFile[i];
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(__dirname, '..', cleanPath);
      
      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        const filename = path.basename(absolutePath);
        // Add file to zip with path: /cad/filename
        archive.file(absolutePath, { name: `cad/${filename}` });
      } else {
        console.warn(`CAD file not found: ${absolutePath}`);
      }
    }
    
    // Add all image files to archive
    for (let i = 0; i < cadDocument.photo.length; i++) {
      const relativePath = cadDocument.photo[i];
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(__dirname, '..', cleanPath);
      
      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        const filename = path.basename(absolutePath);
        // Add file to zip with path: /images/filename
        archive.file(absolutePath, { name: `images/${filename}` });
      } else {
        console.warn(`Image file not found: ${absolutePath}`);
      }
    }
    
    // Finalize archive
    archive.finalize();
    
  } catch (error) {
    console.error("Error downloading files:", error);
    return res.status(500).json({
      success: false,
      message: "Error downloading files",
      error: error.message
    });
  }
};

// Optionally - download all files of a specific type
exports.downloadAllFilesOfType = async (req, res) => {
  try {
    const { documentId } = req.params;
    const fileType = req.query.type || 'cad'; // Default to CAD files
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }
    
    // Find the CAD document by ID
    const cadDocument = await Cad.findOne({ order: documentId });
    
    if (!cadDocument) {
      return res.status(404).json({
        success: false,
        message: "CAD document not found"
      });
    }
    
    // Determine file array based on requested type
    let filePaths = [];
    let folderName = '';
    
    if (fileType === 'cad') {
      filePaths = cadDocument.CadFile;
      folderName = 'cad_files';
    } else if (fileType === 'image') {
      filePaths = cadDocument.photo;
      folderName = 'images';
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Must be 'cad' or 'image'"
      });
    }
    
    // Check if we have files to download
    if (filePaths.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No ${fileType} files found in this document`
      });
    }
    
    // Set response headers for ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${folderName}_${documentId}.zip`);
    
    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add all files to archive
    for (let i = 0; i < filePaths.length; i++) {
      const relativePath = filePaths[i];
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(__dirname, '..', cleanPath);
      
      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        const filename = path.basename(absolutePath);
        // Add file to zip
        archive.file(absolutePath, { name: filename });
      } else {
        console.warn(`File not found: ${absolutePath}`);
      }
    }
    
    // Finalize archive
    archive.finalize();
    
  } catch (error) {
    //console.error(`Error downloading ${fileType} files:`, error);
    return res.status(500).json({
      success: false,
      message: `Error downloading files`,
      error: error.message
    });
  }
};

// Get all files for a specific order (updated to include download all links)
exports.getFilesByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }
    
    // Find CAD documents by order ID
    const cadDocuments = await Cad.find({ order: orderId });
    
    if (!cadDocuments || cadDocuments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files found for this order"
      });
    }
    
    // Format response with file information
    const result = cadDocuments.map(doc => {
      return {
        id: doc._id,
        cadFiles: doc.CadFile.map((path, index) => ({
          index,
          path,
          filename: path.split('/').pop(),
          downloadUrl: `/api/files/download/${doc._id}/${index}?type=cad`
        })),
        images: doc.photo.map((path, index) => ({
          index,
          path,
          filename: path.split('/').pop(),
          downloadUrl: `/api/files/download/${doc._id}/${index}?type=image`
        })),
        createdAt: doc.createdAt,
        // Add links to download all files
        downloadAllFilesUrl: `/api/files/download-all/${doc._id}`,
        downloadAllCadFilesUrl: `/api/files/download-all/${doc._id}?type=cad`,
        downloadAllImagesUrl: `/api/files/download-all/${doc._id}?type=image`
      };
    });
    
    return res.status(200).json({
      success: true,
      count: cadDocuments.length,
      data: result
    });
    
  } catch (error) {
    console.error("Error fetching files:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching files",
      error: error.message
    });
  }
};
  
  
  

 