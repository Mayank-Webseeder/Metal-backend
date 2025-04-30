
const Order = require('../models/order.model');
const User = require('../models/user.models');
const Log = require("../models/log.model")

const sendAssignmentNotification=()=>{
  console.log("Notification sent");

}

// Helper function for auto-assignment to cutout users when status is admin_approved
exports.assignOrderToCutOut = async (orderId, req) => {
  try {
    console.log("assign order to cutout called");
    // Find all users with accountType "Cutout" and who are active
    const cutoutUsers = await User.find({ 
      accountType: "Cutout", 
      isActive: true 
    });
    
    if (!cutoutUsers || cutoutUsers.length === 0) {
      throw new Error("No active cutout users found");
    }

    // For each cutout user, count their assigned orders that aren't completed
    const userOrderCounts = await Promise.all(
      cutoutUsers.map(async (user) => {
        const count = await Order.countDocuments({ 
          assignedTo: user._id,
          status: { $nin: ['cutout_completed', 'accounts_pending', 'accounts_billed', 'accounts_paid', 'order_completed'] }
        });
        
        return {
          userId: user._id,
          name: user.name,
          orderCount: count
        };
      })
    );

    // Sort by order count (ascending) and get the user with the least orders
    const sortedUsers = userOrderCounts.sort((a, b) => a.orderCount - b.orderCount);
    
    if (sortedUsers.length === 0) {
      throw new Error("Could not find a suitable cutout user for assignment");
    }

    const cutoutUserId = sortedUsers[0].userId;
    const cutoutUser = await User.findById(cutoutUserId);
    
    const order = await Order.findOne({
      $or: [{ _id: orderId }, { orderId }]
    });
    
    const changes = [];
    
    // Create log entry for the change
    if (order.assignedTo) {
      const previousUser = await User.findById(order.assignedTo);
      const newUser = cutoutUser;
      console.log("aaaaaaaaaaaaaaaadjshdjdfhduasssaaaaa")
      console.log("newUSer is:",newUser);
      
      if (previousUser) {
        changes.push(
          `Assigned to changed from ${previousUser.name} role (${previousUser.accountType}) to ${newUser.name} role (${newUser.accountType})`
        );
      } else {
        changes.push(
          `Order assigned to ${newUser.name} role (${newUser.accountType})`
        );
      }
    } else {
      changes.push(
        `Order assigned to ${cutoutUser.name} role (${cutoutUser.accountType})`
      );
    }
    
    // Update the order
    order.assignedTo = cutoutUserId;
    order.status = "cutout_pending";
    await order.save();
    
    // Create logs for the changes
    if (changes.length > 0) {
      for (const change of changes) {
        await Log.create({
          orderId: order._id,
          changes: change,
        });
      }
    }

    // Get the populated order to return in response
    const populatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("assignedTo", "name email");
    
    // Send notification about the assignment
    sendAssignmentNotification(req, order);

    return {
      success: true,
      message: "Order successfully assigned to Cutout user",
      data: {
        order: populatedOrder
      }
    };

  } catch (error) {
    console.error("Error auto-assigning order to cutout:", error);
    return res.status(500).json({
      success: false,
      message: "Auto-assignment to Cutout failed",
      error: error.message
    });
  }
};