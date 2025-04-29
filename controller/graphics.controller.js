const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Order = require('../models/order.model');
const Cad= require("../models/cad.model");
const WorkQueue = require('../models/workQueueItem.model');
const User = require('../models/user.models');
const { localFileUpload } = require("../utils/ImageUploader");
const Agenda = require('agenda');
const dotenv= require("dotenv");
const moment = require('moment-timezone'); // To format date & time
dotenv.config();
const {getSockets}=require("../lib/helper.js");

const agenda = new Agenda({ db: { address: process.env.MONGODB_URL } });

const {changeStatus} =require("../service/websocketStatus");
const notification = require("../models/notification.model");

exports.graphicsController= async(req,res)=>{
    console.log("this is route for graphics controller")
}

// Helper function to find and assign an available Graphics user
async function findAvailableGraphicsUser() {
    console.log("findiing available graphics user");
    try {
        const graphicsUsers = await User.aggregate([
            { 
                $match: { 
                    accountType: 'Graphics', 
                    isActive: true 
                } 
            },
            {
                $lookup: {
                    from: 'workqueues',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$assignedTo', '$$userId'] },
                                        { $in: ['$status', ['graphics_pending', 'InProgress']] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'activeOrders'
                }
            },
            {
                $addFields: {
                    activeOrderCount: { $size: '$activeOrders' }
                }
            },
            { $sort: { activeOrderCount: 1 } }
        ]);

        return graphicsUsers.length > 0 ? graphicsUsers[0] : null;
    } catch (error) {
        console.error('Error finding available Graphics user', error);
        return null;
    }
}

// Notification sending function
// Update your sendAssignmentNotification function
const socketManager = require('../middlewares/socketmanager.js');

async function sendAssignmentNotification(req, order) {
    try {

      const assignedUserId = order.assignedTo ? order.assignedTo._id.toString() : null;

      if (!assignedUserId) {
        console.log("No assigned user to notify");
        return;
      }

      const userIdArray =  [assignedUserId];


      console.log(`Sending notification for order ${order._id}`);
      const io = req.app.get("io");
      
      if (!io) {
        console.error("IO instance not found");
        return;
      }

      await notification.create({text:`Order ${order.orderId} has been assigned to you`,userId:userIdArray})
      
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

// Update your getSockets function
exports.getSockets = (users = []) => {
    return socketManager.getMultipleUserSockets(users);
};

// Calculate priority based on requirements
function calculatePriority(requirements) {
    const complexityFactors = requirements.split(',').length;
    return Math.min(5, Math.max(1, Math.ceil(complexityFactors)));
}

// Calculate estimated completion time
function calculateEstimatedCompletion() {
    const estimatedCompletionTime = new Date();
    estimatedCompletionTime.setDate(estimatedCompletionTime.getDate() + 3);
    return estimatedCompletionTime;
}

// Order Creation Controller
exports.createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    

    try {
        const { requirements, dimensions,assignedTo } = req.body;
        const files = req.files.images;
        const customerId = req.params.id;
        // console.log("customerId is:",customerId);
        // console.log("assigned to is:",assignedTo);
    
        

        // Validate input
        if (!requirements || !dimensions || !files) {
            return res.status(400).json({
                success: false,
                message: "All fields are mandatory"
            });
        }
        console.log("data validate successfully in create order controller");

    

        console.log("print  ");
        //upload file locally
        const filesArray = Array.isArray(files) ? files : [files];
        const filesImage = await localFileUpload(
                files,
                
            );
            
        const imageUrls = filesImage.map((file) => file.path);
        // console.log("imageUrls is:",imageUrls);
        // console.log("files image in create order controller",filesImage);



        // Find an available Graphics user
        let assignedGraphicsUser 
        // console.log("before any initialisation of assignedTo",assignedGraphicsUser);

        if(assignedTo!=='undefined'){
            assignedGraphicsUser={
                _id:assignedTo,
            }
            // console.log("assignedGraphicsUser value if assignedTo present",assignedTo);
        }
        else{
            assignedGraphicsUser=await findAvailableGraphicsUser();
            // console.log("assignedGraphicsUser is if assignedTo absent:",assignedGraphicsUser);
        }
        

        // Create new order
        const newOrder = new Order({
            customer: customerId,
            requirements,
            dimensions,
            image: imageUrls,
            createdBy: req.user.id,
            status: 'graphics_pending',
            assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
        });

        // Save order
        const order = await newOrder.save({ session });

        // Create Work Queue Item
        const workQueueItem = new WorkQueue({
            order: order._id,
            status: 'graphics_pending',
            assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null,
            priority: calculatePriority(requirements),
            estimatedCompletionTime: calculateEstimatedCompletion(),
            processingSteps: [
                {
                    stepName: 'Graphics Processing',
                    status: 'graphics_pending',
                    assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
                }
            ]
        });

        // Save Work Queue Item
        await workQueueItem.save({ session });

        // Schedule order processing job
        await agenda.schedule('in 1 minute', 'process-order', {
            orderId: order._id,
            workQueueId: workQueueItem._id,
            assignedUserId: assignedGraphicsUser ? assignedGraphicsUser._id : null
        });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Populate and return order details
        const populatedOrder = await Order.findById(order._id)
            .populate("customer", "name email")
            
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email");

        // Send notification to assigned user if exists
        if (assignedGraphicsUser) {
            await sendAssignmentNotification(req,order);
        }

        res.status(201).json({
            success: true,
            message: assignedGraphicsUser 
                ? "Order created and assigned to Graphics user" 
                : "Order created, awaiting Graphics user assignment",
            data: {
                order: populatedOrder,
                assignedUser: assignedGraphicsUser ? {
                    _id: assignedGraphicsUser._id,
                    name: assignedGraphicsUser.name,
                    email: assignedGraphicsUser.email
                } : null
            }
        });

    } catch (error) {
         // Abort transaction
        // await session.abortTransaction();
        // session.endSession();
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error("Error creating order", error);
        return res.status(400).json({
            success: false,
            message: "Problem in creating the order",
            error: error.message
        });

    }
};

// Get Pending Orders
exports.getPendingOrders = async (req, res) => {
    try {
        const pendingOrders = await Order.find({ 
            status: { $in: ['New', 'InWorkQueue'] } 
        })
        .populate('customer', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            count: pendingOrders.length,
            data: pendingOrders
        });
    } catch (error) {
        console.error('Error fetching pending orders', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending orders',
            error: error.message
        });
    }
};

// Reassign Unassigned Orders
exports.reassignUnassignedOrders = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find unassigned orders
        const unassignedOrders = await Order.find({
            status: 'InWorkQueue',
            assignedTo: null
        });

        // Reassign orders
        const reassignedOrders = [];
        for (let order of unassignedOrders) {
            // Find available Graphics user
            const availableUser = await findAvailableGraphicsUser();

            if (availableUser) {
                // Update order assignment
                order.assignedTo = availableUser._id;
                order.status = 'Assigned';
                await order.save({ session });

                // Update corresponding work queue item
                await WorkQueue.findOneAndUpdate(
                    { order: order._id },
                    { 
                        assignedTo: availableUser._id,
                        status: 'Pending',
                        $push: {
                            processingSteps: {
                                stepName: 'Reassignment',
                                status: 'Pending',
                                assignedTo: availableUser._id
                            }
                        }
                    },
                    { session }
                );

                reassignedOrders.push(order);
            }
        }

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: 'Unassigned orders reassigned',
            reassignedCount: reassignedOrders.length,
            orders: reassignedOrders
        });
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();

        console.error('Error reassigning orders', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reassign orders',
            error: error.message
        });
    }
};

// Get User's Assigned Orders
exports.getUserAssignedOrders = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming authenticated user

        const assignedOrders = await Order.find({ 
            assignedTo: userId,
            status: { $nin: ['completed', 'paid'] }
        })
        .populate('customer', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

        

        // const filteredOrders = assignedOrders.map(({customer,createdBy,assignedTo,...rest})=>rest);

        const filteredOrders = assignedOrders.map(order => {
            const obj = order.toObject();  // Convert Mongoose document to a plain object
            const { customer, createdBy, assignedTo, ...rest } = obj;
            return rest;
        });
        
       

        res.status(200).json({
            success: true,
            count: assignedOrders.length,
            data: filteredOrders
        });
    } catch (error) {
        console.error('Error fetching assigned orders', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assigned orders',
            error: error.message
        });
    }
};

// Agenda Order Processing Job
agenda.define('process-order', async (job) => {
    const { orderId, workQueueId, assignedUserId } = job.data;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Fetch the order and work queue item
        const order = await Order.findById(orderId);
        const workQueueItem = await WorkQueue.findById(workQueueId);

        if (!order || !workQueueItem) {
            throw new Error('Order or Work Queue Item not found');
        }

        // Update order
        order.status = 'InProgress';
        await order.save({ session });

        // Update Work Queue Item
        workQueueItem.status = 'InProgress';
        workQueueItem.startedAt = new Date();
        
        // Update first processing step
        const initialStep = workQueueItem.processingSteps[0];
        initialStep.status = 'InProgress';
        initialStep.startedAt = new Date();

        await workQueueItem.save({ session });

        // Perform processing steps
        await processOrderSteps(order, workQueueItem, session);

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        console.log(`Order ${orderId} processed successfully`);

    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();

        // Handle processing errors
        console.error(`Order processing failed for order ${orderId}`, error);

        // Update order and work queue item status
        await Order.findByIdAndUpdate(orderId, {
            status: 'New',
            processingError: error.message
        });

        await WorkQueue.findByIdAndUpdate(workQueueId, {
            status: 'Failed',
            $push: { 
                errorLog: { 
                    message: error.message 
                } 
            }
        });

        // Throw error to trigger retry mechanism
        throw error;
    }
});

// Process order steps
async function processOrderSteps(order, workQueueItem, session) {
    const processingSteps = workQueueItem.processingSteps;

    for (let step of processingSteps) {
        // Simulate step processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        step.status = 'Completed';
        step.completedAt = new Date();
    }

    // Update final status
    order.status = 'completed';
    workQueueItem.status = 'Completed';
    workQueueItem.completedAt = new Date();

    await order.save({ session });
    await workQueueItem.save({ session });
}

// Agenda Event Handlers
agenda.on('ready', () => {
    console.log('Agenda jobs are ready');
    agenda.start();
});

agenda.on('error', (error) => {
    console.error('Agenda encountered an error:', error);
});

// Graceful shutdown
async function gracefulShutdown() {
    await agenda.stop();
    process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);



// Allowed status values defined in your WorkQueue schema
const allowedStatuses = ["graphics_pending", "graphics_in_progress", "graphics_completed"];

exports.updateWorkQueueStatus = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Destructure workQueueId and new status from the request body
        const { workQueueId, status } = req.body;
       
        

        // Validate that both workQueueId and status are provided
        if (!workQueueId || !status) {
            return res.status(400).json({
                success: false,
                message: 'WorkQueue ID and status are required'
            });
        }

        // Validate that the provided status is allowed
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status provided. Allowed statuses: ${allowedStatuses.join(', ')}`
            });
        }

        // Fetch the WorkQueue document within the session
        // const workQueueItem = await WorkQueue.findById(workQueueId).session(session);
        const workQueueItem = await WorkQueue.findOne({ order: workQueueId }).session(session);
        if (!workQueueItem) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'WorkQueue item not found'
            });
        }

        // Update the WorkQueue item's status
        workQueueItem.status = status;
        // Saving the document will trigger your pre('save') middleware that updates the Order status.


          // Update status and timestamps
         const istTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"); 

        if (status === "graphics_in_progress") {
              workQueueItem.startedAt = istTime; // Capture start time
          } else if (status === "graphics_completed") {
              workQueueItem.completedAt = istTime; // Capture completion time
          }



        const updatedWorkQueueItem = await workQueueItem.save({ session });
        

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
        
        changeStatus(req,workQueueItem);

        res.status(200).json({
            success: true,
            message: 'WorkQueue status updated successfully, and Order status updated accordingly.',
            data: updatedWorkQueueItem
        });
    } catch (error) {
        // Abort the transaction if any error occurs
        await session.abortTransaction();
        session.endSession();

        console.error('Error updating WorkQueue status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


const{cadFileUpload } = require('../utils/CadFileUploader');



exports.uploadFile = async (req, res) => {
  try {
    const { orderId } = req.body; // Get the order ID from request body
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const { files } = req;
    
    // Check if files were provided
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded"
      });
    }
    
    // Process CAD files
    const cadFiles = files.cadFiles ? 
      (Array.isArray(files.cadFiles) ? files.cadFiles : [files.cadFiles]) :
      [];
    
    // Process image files
    const imageFiles = files.images ?
      (Array.isArray(files.images) ? files.images : [files.images]) :
      [];
    
    // Check if both types of files are present
    if (cadFiles.length === 0 || imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Both CAD files and images are required"
      });
    }
    
    // Upload CAD files
    const cadUploadResults = await cadFileUpload(cadFiles);
    
    // Upload image files
    const imageUploadResults = await localFileUpload(imageFiles);
    
    // Extract file paths from upload results
    const cadFilePaths = cadUploadResults.map(file => file.path);
    const imagePaths = imageUploadResults.map(file => file.path);
    
    // Create new CAD document in the database
    const newCadEntry = await Cad.create({
      order: orderId,
      photo: imagePaths,
      CadFile: cadFilePaths
    });
    
    // Return success response with created document
    return res.status(201).json({
      success: true,
      message: "Files uploaded and saved successfully",
      data: newCadEntry
    });
    
  } catch (error) {
    console.error("Error in uploadFile controller:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading files",
      error: error.message
    });
  }
};




const archiver = require('archiver'); // You'll need to install this package


// Original controller to download single file (kept for backward compatibility)
exports.downloadCadFile = async (req, res) => {
  try {
    const { documentId, fileIndex } = req.params;
   
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }
    
    // Find the CAD document by ID
    const cadDocument = await Cad.findById(documentId);
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
    const cadDocument = await Cad.findById(documentId);
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
    const cadDocument = await Cad.findById(documentId);
    
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
    console.error(`Error downloading ${fileType} files:`, error);
    return res.status(500).json({
      success: false,
      message: `Error downloading ${fileType} files`,
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


exports.removeFromWorkQueue = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
      const { workQueueId } = req.params;
      const { reason, completionNotes } = req.body;

      // Validate input
      if (!workQueueId) {
          return res.status(400).json({
              success: false,
              message: "Work Queue ID is required"
          });
      }

      console.log("Data validated successfully in remove from work queue controller");

      // Find the work queue item
      const workQueueItem = await WorkQueue.findById(workQueueId).session(session);

      if (!workQueueItem) {
          return res.status(404).json({
              success: false,
              message: "Work Queue item not found"
          });
      }

      // Find the associated order
      const order = await Order.findById(workQueueItem.order).session(session);
      
      if (!order) {
          return res.status(404).json({
              success: false,
              message: "Associated order not found"
          });
      }

      // Update order status
      order.status = 'Completed';
      order.completionNotes = completionNotes || '';
      order.completedAt = new Date();
      order.completedBy = req.user.id;
      await order.save({ session });

      // Update work queue item
      workQueueItem.status = 'Completed';
      workQueueItem.completionReason = reason || 'Task Completed';
      workQueueItem.completedAt = new Date();
      
      // Update all pending processing steps to completed
      workQueueItem.processingSteps.forEach(step => {
          if (step.status === 'Pending') {
              step.status = 'Completed';
              step.completedAt = new Date();
              step.completedBy = req.user.id;
          }
      });

      await workQueueItem.save({ session });

      // Cancel any scheduled jobs for this order if they exist
      await agenda.cancel({ 'data.workQueueId': workQueueItem._id });

      // Notify the customer that their order is complete
      await sendOrderCompletionNotification(req, order);

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Populate and return updated order details
      const populatedOrder = await Order.findById(order._id)
          .populate("customer", "name email")
          .populate("assignedTo", "name email")
          .populate("createdBy", "name email")
          // .populate("completedBy", "name email");

      res.status(200).json({
          success: true,
          message: "Item successfully removed from work queue",
          data: {
              order: populatedOrder,
              workQueue: workQueueItem
          }
      });

  } catch (error) {
      // Abort transaction
      if (session.inTransaction()) {
          await session.abortTransaction();
      }
      session.endSession();

      console.error("Error removing from work queue", error);
      return res.status(400).json({
          success: false,
          message: "Problem removing the item from work queue",
          error: error.message
      });
  }
};


// Helper function to send notification to customer when order is complete
const sendOrderCompletionNotification = async (req, order) => {
  try {
      // Find customer details
      const customer = await User.findById(order.customer);
      
      if (!customer) {
          console.error("Customer not found for notification");
          return;
      }

      // Create notification
      const notification = new Notification({
          recipient: customer._id,
          title: "Order Completed",
          message: `Your order #${order._id} has been completed.`,
          type: "order_completion",
          metadata: {
              orderId: order._id
          }
      });

      await notification.save();

      // If you have real-time notifications (like Socket.io), emit here
      // io.to(customer._id).emit('new_notification', notification);

      // Optionally, send an email notification
      // await sendEmail(customer.email, "Order Completed", `Your order #${order._id} has been completed.`);

      console.log(`Completion notification sent to customer: ${customer._id}`);
  } catch (error) {
      console.error("Error sending completion notification:", error);
  }
};


exports.deleteCadFileOrPhotoByIndex = async (req, res) => {
  try {
    const { orderId, type, index } = req.body; // type = 'photo' or 'CadFile'
    const userId = req.user.id;

    

    // Step 1: Validate order and user
    const order = await Order.findOne({
      _id: orderId,
      assignedTo: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or not assigned to this user",
      });
    }

    // Step 2: Fetch all CAD docs for this order
    const cadDocs = await Cad.find({ order: orderId });

    if (!cadDocs || cadDocs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No CAD entries found for this order",
      });
    }

    // Step 3: Validate type
    if (!['photo', 'CadFile'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'photo' or 'CadFile'.",
      });
    }

    // Step 4: Count total files of that type across all documents
    let totalFiles = cadDocs.reduce((sum, doc) => sum + (doc[type]?.length || 0), 0);

    if (totalFiles <= 1) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete the last remaining ${type}. At least one must remain.`,
      });
    }

    // Step 5: Locate the document and remove the file at the given index
    let currentIndex = 0;
    for (const doc of cadDocs) {
      const filesArray = doc[type];
      if (index < currentIndex + filesArray.length) {
        const relativeIndex = index - currentIndex;
        const removedFile = filesArray.splice(relativeIndex, 1);
        await doc.save();

        return res.status(200).json({
          success: true,
          message: `${type} at index ${index} deleted successfully`,
          removed: removedFile[0],
          updatedCad: doc,
        });
      }
      currentIndex += filesArray.length;
    }

    // If we reach here, index was out of bounds
    return res.status(400).json({
      success: false,
      message: "Invalid index for deletion",
    });

  } catch (error) {
    console.error("Error deleting CAD file or photo:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
