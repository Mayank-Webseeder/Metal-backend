const socketManager = require('../middlewares/socketmanager');
const {getAllAdmin}= require("../controller/user.controller");
const notification = require("../models/notification.model");
const Order = require("../models/order.model");
exports.changeStatus=async(req, workQueueItem)=> {
  try {
    const adminUsers = await getAllAdmin(); 
    const userIds = new Set(
      adminUsers.map((admin) => admin._id.toString())
    );
    const otherId = new Set(
      adminUsers.map((admin) => admin._id.toString())
    );
    userIds.add(workQueueItem.assignedTo.toString());
    const userIdArray = Array.from(otherId); 
    
    const io = req.app.get("io");
    if (!io) {
      console.error("IO instance not found");
      return;
    }
    const order = await Order.findById(workQueueItem.order)
    await notification.create({text:`order of ${order.orderId} status has been changed to ${workQueueItem.status}`,userId:userIdArray})

    for (const userId of userIds) {
      const socketId = socketManager.getUserSocket(userId);
      if (socketId) {
        console.log(`Emitting to socket: ${socketId}`);
        io.to(socketId).emit("changeStatus", {
          orderId: workQueueItem.order,
          status: workQueueItem.status,
        });
      } else {
        console.log(`error sending websocket`);
      }
    }
    for (const userId of otherId) {
      const socketId = socketManager.getUserSocket(userId);
      if (socketId) {
        io.to(socketId).emit("newNotification");
      } else {
        console.log(`error sending websocket`);
      }
    }
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

exports.changeStatusByCutout=async(req,order)=> {
  try {
    
    // Get admin users
    const adminUsers = await getAllAdmin(); // Make sure this returns an array of user objects
    

    // Extract all user IDs (admin + assignedTo)
    const userIds = new Set(
      adminUsers.map((admin) => admin._id.toString())
    );

    const otherId = new Set(
      adminUsers.map((admin) => admin._id.toString())
    );

    userIds.add(order.assignedTo.toString()); // Add assigned user

    const userIdArray = Array.from(otherId);

    const io = req.app.get("io");
    if (!io) {
      console.error("IO instance not found");
      return;
    }

    
    await notification.create({text:`order of ${order.orderId} status has been changed to ${order.status}`,userId:userIdArray})

    for (const userId of userIds) {
      const socketId = socketManager.getUserSocket(userId);
      if (socketId) {
        console.log(`Emitting to socket: ${socketId}`);
        io.to(socketId).emit("changeStatus", {
          orderId: order._id,
          status: order.status,
        });
      } else {
        console.log(`error sending websocket`);
      }
    }

    for (const userId of otherId) {
      const socketId = socketManager.getUserSocket(userId);
      if (socketId) {
        io.to(socketId).emit("newNotification");
      } else {
        console.log(`error sending websocket`);
      }
    }



  } catch (error) {
    console.error("Error sending notification:", error);
  }
}


exports.notifyOrderUpdated = async(req, order, changedFields) => {
  try {
    // Get assigned user ID
    const assignedUserId = order.assignedTo ? order.assignedTo._id.toString() : null;
    console.log("assignedUer is id is",assignedUserId);
    if (!assignedUserId) {
      console.log("No assigned user to notify");
      return;
    }

  
    const userIdArray =  [assignedUserId];
    console.log("userId array is:",userIdArray)
    
    // Get the io instance
    const io = req.app.get("io");
    if (!io) {
      console.error("IO instance not found");
      return;
    }

    await notification.create({text:`order of ${order.orderId} has been edited by admin `,userId:userIdArray})
    
    // Get the socket ID for the assigned user
    const socketId = socketManager.getUserSocket(assignedUserId);
    if (socketId) {
      console.log(`Emitting order update to assigned user socket: ${socketId}`);
      
      // Prepare a list of what changed
      const changedFieldNames = Object.keys(changedFields);
      console.log("changed field names is:",changedFieldNames);
      
      // Send the notification with the updated order and details about what changed
      io.to(socketId).emit("orderUpdated", {
        orderId: order._id,
        order: {
          _id: order._id,
          requirements: order.requirements,
          dimensions: order.dimensions,
          status: order.status,
          image: order.image,
          orderId:order.orderId
        },
        changedFields: changedFieldNames,
        message: `Order #${order.orderId} has been updated by admin`
        
      });
    
    } else {
      console.log(`No active socket connection for assigned user: ${assignedUserId}`);
    }

    for (const userId of userIdArray) {
      const socketId = socketManager.getUserSocket(userId);
      if (socketId) {
        io.to(socketId).emit("newNotification");
      } else {
        console.log(`error sending websocket`);
      }
    }
  } catch (error) {
    console.error("Error sending order update notification:", error);
  }
};

// Update your getSockets function
exports.getSockets = (users = []) => {
    return socketManager.getMultipleUserSockets(users);
};