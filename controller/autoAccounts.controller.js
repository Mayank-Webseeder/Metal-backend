
const Order = require('../models/order.model');
const User = require('../models/user.models');
const Log = require("../models/log.model")

const sendAssignmentNotification=()=>{
  console.log("Notification sent");

}


// Helper function for auto-assignment to accounts users when status is cutout_complete
// Helper function for auto-assignment to accounts users when status is cutout_completed
exports.assignToAccounts = async (orderId, req) => {
    try {
      console.log("assign order to accounts called");
      // Find all users with accountType "Accounts" and who are active
      const accountsUsers = await User.find({ 
        accountType: "Accounts", 
        isActive: true 
      });
      
      if (!accountsUsers || accountsUsers.length === 0) {
        throw new Error("No active accounts users found");
      }
  
      // For each accounts user, count their assigned orders that aren't completed
      const userOrderCounts = await Promise.all(
        accountsUsers.map(async (user) => {
          const count = await Order.countDocuments({ 
            assignedTo: user._id,
            status: { $nin: ['accounts_billed', 'accounts_paid', 'order_completed'] }
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
        throw new Error("Could not find a suitable accounts user for assignment");
      }
  
      const accountsUserId = sortedUsers[0].userId;
      const accountsUser = await User.findById(accountsUserId);
      
      const order = await Order.findOne({
        $or: [{ _id: orderId }, { orderId }]
      });
      
      const changes = [];
      
      // Create log entry for the change
      if (order.assignedTo) {
        const previousUser = await User.findById(order.assignedTo);
        const newUser = accountsUser;
        
        if (previousUser) {
          changes.push(
            `Order Assigned has been changed from ${previousUser.name} role (${previousUser.accountType}) to ${newUser.name} role (${newUser.accountType})`
          );
        } else {
          changes.push(
            `Order assigned to ${newUser.name} role (${newUser.accountType})`
          );
        }
      } else {
        changes.push(
          `Order assigned to ${accountsUser.name} role (${accountsUser.accountType})`
        );
      }
      
      // Update the order
      order.assignedTo = accountsUserId;
      order.status = "accounts_pending";
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
        message: "Order successfully assigned to Accounts user",
        cutoutId: accountsUserId,  
        assignedTo: accountsUser
      };
  
    } catch (error) {
      console.error("Error auto-assigning order to accounts:", error);
      throw error;
    }
  };