const mongoose = require("mongoose");
const Order = require("../models/order.model");
const WorkQueue = require("../models/workQueueItem.model");
const User = require("../models/user.models");

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

exports.assignOrderToDisplay = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { displayUserId } = req.body;
  
      if (!orderId || !displayUserId) {
        throw new Error("Order ID and Display User ID are required");
      }
  
      const order = await Order.findOne({
        $or: [{ _id: orderId }, { orderId }]
      });
  
      if (!order) throw new Error("Order not found");
  
      const displayUser = await User.findById(displayUserId);
      if (!displayUser) throw new Error("Display user not found");
  
      const previousAssignedTo = order.assignedTo;
      console.log("previousAssignedTo")
      order.assignedTo = displayUserId;
      if (order.status !== "InWorkQueue") order.status = "InWorkQueue";
      await order.save();
  
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
  
