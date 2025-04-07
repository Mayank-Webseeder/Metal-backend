const mongoose = require('mongoose');
const Order = require('../models/order.model');
const WorkQueue = require('../models/workQueueItem.model');
const User = require('../models/user.models');
const { uploadImageToCloudinary,localFileUpload } = require("../utils/ImageUploader");
const Agenda = require('agenda');
const dotenv= require("dotenv");
const moment = require('moment-timeZone'); // To format date & time
dotenv.config();
const {getSockets}=require("../lib/helper.js");

const agenda = new Agenda({ db: { address: process.env.MONGODB_URL } });

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
                                        { $in: ['$status', ['Pending', 'InProgress']] }
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
            status: 'InWorkQueue',
            assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
        });

        // Save order
        const order = await newOrder.save({ session });

        // Create Work Queue Item
        const workQueueItem = new WorkQueue({
            order: order._id,
            status: 'Pending',
            assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null,
            priority: calculatePriority(requirements),
            estimatedCompletionTime: calculateEstimatedCompletion(),
            processingSteps: [
                {
                    stepName: 'Graphics Processing',
                    status: 'Pending',
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

        console.log("assignedOrders is",assignedOrders);

        // const filteredOrders = assignedOrders.map(({customer,createdBy,assignedTo,...rest})=>rest);

        const filteredOrders = assignedOrders.map(order => {
            const obj = order.toObject();  // Convert Mongoose document to a plain object
            const { customer, createdBy, assignedTo, ...rest } = obj;
            return rest;
        });
        
        console.log("fileredOrders is:",filteredOrders);

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
const allowedStatuses = ["Pending", "InProgress", "Completed", "Failed", "Paused"];

exports.updateWorkQueueStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Destructure workQueueId and new status from the request body
        const { workQueueId, status } = req.body;
        console.log("status is:",status);
        

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

        if (status === "InProgress") {
              workQueueItem.startedAt = istTime; // Capture start time
          } else if (status === "Completed") {
              workQueueItem.completedAt = istTime; // Capture completion time
          }



        const updatedWorkQueueItem = await workQueueItem.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

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
