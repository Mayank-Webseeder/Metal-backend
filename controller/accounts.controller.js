const FinancialTransaction = require("../models/FinancialTransaction.model")
const Order = require("../models/order.model");
const User = require("../models/user.models");
// Notification sending function
// Update your sendAssignmentNotification function
const socketManager = require('../middlewares/socketmanager.js');
const{changeStatusByCutout} = require("../service/websocketStatus");

const Log= require("../models/log.model");

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


exports.assignOrderToAccount = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { accountUserId } = req.body;
      const changes = [];
      
  
      if (!orderId || !accountUserId) {
        throw new Error("Order ID and Account User ID are required");
      }
       

            
  
      const order = await Order.findOne({
        $or: [{ _id: orderId }, { orderId }]
      });
  
      if (!order) throw new Error("Order not found");
  
      const accountUser = await User.findById(accountUserId);
      if (!accountUser) throw new Error("Account user not found");
  
      // Check if order is in a valid state to be assigned to accounting
      if (order.status !== "Completed" && order.status !== "Billed" && order.status !== "ReadyForBilling") {
        return res.status(400).json({
          success: false,
          message: "Cannot assign to accounting for an order that is not completed or ready for billing"
        });
      }
  
      const previousAssignedTo = order.assignedTo;
      console.log("previousAssignedTo:", previousAssignedTo);

      const user1 = await User.findById(order.assignedTo);
            
      
      order.assignedTo = accountUserId;
      order.status = "InAccountSection";
      const user2 = await User.findById(order.assignedTo);
            changes.push(
              `Assigned to changed from ${user1.name} role:${user1.accountType} to ${user2.name} role:${user2.accountType}`
            );
      await order.save();
      if (changes.length > 0) {
                  for (const change of changes) {
                    await Log.create({
                      orderId: order._id,
                      changes: change,
                    });
                  }
                }
  
    
  
      const populatedOrder = await Order.findById(order._id)
        // .populate("customer", "name email")
        .populate({
            path: "customer",
            
          })
        .populate("assignedTo", "name email");
      
      // Send notification about the assignment
      sendAssignmentNotification(req, order);
  
      return res.status(200).json({
        success: true,
        message: "Order successfully assigned to accounting user",
        data: {
          order: populatedOrder,
        //   financialRecord
        }
      });
  
    } catch (error) {
      console.error("Error assigning order to accounting:", error);
      return res.status(500).json({
        success: false,
        message: "Order assignment to accounting failed",
        error: error.message
      });
    }
  };


 
  exports.getAssignedOrders = async (req, res) => {
    try {
      
      const userId = req.user.id;
  
      const populatedOrders = await Order.find({ 
        assignedTo: userId,
        status: { $nin: ['completed', 'paid'] }
      })
      .populate({
        path: "customer",
        populate: {
          path: "address"
        }
      })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
  
      
  
      res.status(200).json({
        success: true,
        count: populatedOrders.length,
        data: populatedOrders
      });
  
    } catch (error) {
      console.error("Error fetching assigned orders", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch assigned orders",
        error: error.message
      });
    }
  };
  


  
  exports.createBill = async (req, res) => {
    try {
      const { orderId } = req.body;
      let changes = [];
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "Order ID is mandatory",
        });
      }
      
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found"
        });
      }
      
      if (order.status !== 'Completed' && order.status !== 'InAccountSection') {
        return res.status(400).json({
          success: false,
          message: "Cannot create bill for an order that is not completed or ready for billing"
        });
      }
      
     
      
      // Find existing financial transaction or create new one
      let financialTransaction = await FinancialTransaction.findOne({ orderId });
      console.log("financial transaction is :",financialTransaction);
      
      if (financialTransaction) {
        financialTransaction.status = "Billed";
        financialTransaction.billedAt = new Date();
        financialTransaction.processedBy = req.user.id;
       
      } else {
        console.log("order id is",orderId)
        financialTransaction = new FinancialTransaction({
          orderId: orderId,
          status: "Billed",
          processedBy: req.user.id,
          billedAt: new Date()
        });
      }
      
      const savedBill = await financialTransaction.save();
      
      const populatedBill = await FinancialTransaction.findById(savedBill._id)
        .populate("orderId")
        .populate({
          path: "orderId",
          populate: {
            path: "customer",
            select: "name email"
          }
        });
        
      // Send billing notification
      sendBillingNotification(req, order);
      const previousStatus=order.status;
      console.log("previous status is:",previousStatus);
      order.status = "Billed";
      changes.push(`Status changed from "${previousStatus}" to "${order.status}"`);
      await order.save();
      changeStatusByCutout(req,order);

      if (changes.length > 0) {
        for (const change of changes) {
          await Log.create({
            orderId: orderId,
            changes: change,
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: "Billed successfully",
        data: {
          bill: populatedBill
        }
      });
      
    } catch (error) {
      console.error("Error in creating the bill:", error);
      return res.status(500).json({
        success: false,
        message: "Problem in creating the bill",
        error: error.message
      });
    }
  };


  
  

  
  // Helper function for sending billing notifications
  const sendBillingNotification = (req, order) => {
    // Implementation for sending notifications about billing
    console.log(`Billing notification for order ${order._id}`);
    // Additional notification logic here
  };

const updateBill = async(req,res)=>{
    try {
        const {billId} = req.params.id
        const status= req.body;

        const bill = await FinancialTransaction.findById(billId);
        if(!bill){
            return res.status(404).json({
                success:false,
                message:"this order does not found",
                
            })
        }

        bill.status= status;
        await bill.save();
        
        const updatedBill = await FinancialTransaction.findById(req.params.id)
        .populate('order', 'orderId customer')
        .populate({
          path: 'order',
          populate: { path: 'customer', select: 'name email' }
        })
        .populate('processedBy', 'name email');
      
      res.json(updatedTransaction);
    } 
    catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Transaction not found' });
      }
      res.status(500).send('Server error');
    }
  };


  exports.getAllBill =async(req,res)=>{
    try {
        const bills= await FinancialTransaction.find()
        .populate("orderId","orderId customer requirements dimensions status")
        .populate("processedBy","name email ");

        return res.status(200).json({
            success:true,
            messaage:"All bills has been fetched successfully",
            bills,
        });
        
    } catch (error) {
        console.log("problem in fetching all bills",error);
        return res.status(400).json({
            success:False,
            message:"problem in fetching alll data",
            error:error.message
        })
        
    }
  }







exports.accountController=async(req,res)=>{
    try {
        
        return res.status(200).json({
            success:true,
            message:"welcome to account section"
        })
    } catch (error) {
        return res.status(400).json({
            success:false,
            message:"error in account controller",
            error:error.message
        })
        
    }
}