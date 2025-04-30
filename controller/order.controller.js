const Order = require("../models/order.model");
const WorkQueueItem = require("../models/workQueueItem.model");
const Counter = require("../models/counter");
const {
  uploadImageToCloudinary,
  localFileUpload,
} = require("../utils/ImageUploader");
const { notifyOrderUpdated } = require("../service/websocketStatus");
const Log = require("../models/log.model");
const User = require("../models/user.models");
const {assignOrderToCutOut} = require('./autoCutout.controller');

exports.assignOrder = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    let order = await Order.findById(req.params.id);
    console.log("order is :", order);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "All fields are mandatory",
      });
    }

    order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          assignedTo,
          status: "Assigned",
        },
      },
      { new: true }
    )
      .populate("customer", "name email")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    return res.status(200).json({
      success: true,
      message: "order assigned successfully",
      order,
    });
  } catch (error) {
    console.error("problem in assigning order", error);
    return res.status(402).json({
      success: false,
      message: "unable to assign order",
      error: error.message,
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { status, customer, assignedTo } = req.query;

    let query = {};
    if (status) query.status = status;
    if (customer) query.customer = customer;
    if (assignedTo) query.assignedTo = assignedTo;

    const orders = await Order.find(query)
      .populate("customer", "name email")
      .populate("assignedTo", "firstName lastName email accountType")
      .populate("approvedBy", "name email")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1, createdAt: -1 });

    // console.log("this is orders",orders);
    return res.status(200).json({
      success: true,
      message: "all orders has been fetched successfully",
      orders,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone")

      .populate("assignedTo", "firstName lastName email")
      .populate("approvedBy", "name email")
      .populate("createdBy", "name email");

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    res.status(200).json({
      success: true,
      message: "order has been fetched successfully",
      order,
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Order not found" });
    }
    res.status(500).send("Server error");
  }
};

// exports.updateOrder = async (req, res) => {
//   try {

//     const { requirements, dimensions,assignedTo,status} = req.body;

//     // Check if order exists
//     let order = await Order.findById(req.params.id);
//     if (!order) {
//       return res.status(404).json({ msg: 'Order not found' });
//     }

//     const updateFields = {};
//     if (requirements) updateFields.requirements = requirements;
//     if (dimensions) updateFields.dimensions = dimensions;
//     if (assignedTo) updateFields.assignedTo = assignedTo;
//     if (status) {
//       updateFields.status = status
//       changeStatusByAdmin(req,order);
//     }
//       ;

//     //check if new files are uploaded
//     if(req.files && req.files.images){
//       const files= req.files.images;
//      const filesArray = Array.isArray(files) ? files : [files];
//             const filesImage = await localFileUpload(
//                     files,

//                 );

//       //extract secure urls from the uploaded images
//       const imageUrls= filesImage.map((file)=>file.path);
//       updateFields.image=imageUrls;
//     console.log("imageUrl is:",imageUrls);
//     }

//     order = await Order.findByIdAndUpdate(
//       req.params.id,
//       { $set: updateFields },
//       { new: true }
//     ).populate('customer', 'name email')
//       .populate('assignedTo', 'name email')
//       .populate('approvedBy', 'name email')
//       .populate('createdBy', 'name email');

//     res.status(200).json({
//       success:true,
//       message:"order has been updated successfully",
//       order});
//   } catch (err) {
//     console.error(err.message);
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Order not found' });
//     }
//     res.status(500).send('Server error');
//   }
// };

// exports.updateOrder = async (req, res) => {
//   try {
//     const { requirements, dimensions, assignedTo, status } = req.body;

//     // Check if order exists
//     let order = await Order.findById(req.params.id);
//     if (!order) {
//       return res.status(404).json({ msg: 'Order not found' });
//     }

//     const updateFields = {};
//     if (requirements) updateFields.requirements = requirements;
//     if (dimensions) updateFields.dimensions = dimensions;
//     if (assignedTo) updateFields.assignedTo = assignedTo;
//     if (status) {
//       updateFields.status = status;
//     }

//     // Handle file uploads
//     if(req.files && req.files.images){
//       const files = req.files.images;
//       const filesArray = Array.isArray(files) ? files : [files];
//       const filesImage = await localFileUpload(files);
//       const imageUrls = filesImage.map((file) => file.path);
//       updateFields.image = imageUrls;
//     }

//     // Update the order
//     order = await Order.findByIdAndUpdate(
//       req.params.id,
//       { $set: updateFields },
//       { new: true }
//     ).populate('customer', 'name email')
//       .populate('assignedTo', 'name email')
//       .populate('approvedBy', 'name email')
//       .populate('createdBy', 'name email');

//     // Notify users about any changes (not just status)
//     notifyOrderUpdated(req, order, updateFields);

//     res.status(200).json({
//       success: true,
//       message: "Order has been updated successfully",
//       order
//     });
//   } catch (err) {
//     console.error(err.message);
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Order not found' });
//     }
//     res.status(500).send('Server error');
//   }
// };
// make sure the path is correct

exports.updateOrder = async (req, res) => {
  try {
    const { requirements, dimensions, assignedTo, status } = req.body;

    // Check if order exists
    let order = await Order.findById(req.params.id)
      .populate("customer", "name email")
      .populate("assignedTo", "name email")
      .populate("approvedBy", "name email")
      .populate("createdBy", "name email");

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    const updateFields = {};
    const changes = [];

    // Compare and collect changes
    if (requirements && requirements !== order.requirements) {
      updateFields.requirements = requirements;
      changes.push(
        `Requirements updated from "${order.requirements}" to "${requirements}"`
      );
    }

    if (dimensions && dimensions !== order.dimensions) {
      updateFields.dimensions = dimensions;
      changes.push(
        `Dimensions changed from "${order.dimensions}" to "${dimensions}"`
      );
    }

    if (assignedTo && assignedTo !== String(order.assignedTo)) {
      updateFields.assignedTo = assignedTo;
      const user1 = await User.findById(order.assignedTo);
      const user2 = await User.findById(assignedTo);
      changes.push(
        `Order Assigned has been changed from ${user1.name} role (${user1.accountType}) to ${user2.name} role (${user2.accountType})`
      );
    }

    // if (status && status !== order.status) {
    //   updateFields.status = status;
    //   changes.push(`Status changed from "${order.status}" to "${status}"`);
    // }
    
    if (status && status !== order.status) {
      if (status == "cutout_pending") {
        console.log("inside admin approved if ");
        updateFields.status = status;
        changes.push(`Order Status changed from "${order.status}" to "${status}"`);
        const { cutoutId, assignedTo: cutoutUser } = await assignOrderToCutOut(order._id, req);
        console.log("assigned to is:",assignedTo);
        const user1 = await User.findById(order.assignedTo);
        updateFields.assignedTo = cutoutId;
        const user2 = await User.findById(assignedTo);
        console.log("user2 is:",user2)
        changes.push(
          `Order was approved by Admin. It was initially assigned to ${user1.name} role (${user1.accountType}) and is now reassigned to ${user2.name} role(${user2.accountType})`
        );
      } else {
        updateFields.status = status;
        changes.push(`Order Status changed from "${order.status}" to "${status}"`);
      }
    }

    // Handle file uploads
    if (req.files && req.files.images) {
      const files = req.files.images;
      const filesArray = Array.isArray(files) ? files : [files];
      const filesImage = await localFileUpload(filesArray);
      const imageUrls = filesImage.map((file) => file.path);
      updateFields.image = imageUrls;
      console.log("imageUrls is:", imageUrls);
      await Log.create({
        orderId: req.params.id,
        previmage: order.image, afterimage: imageUrls
      })
    }

    // Update the order
    order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    )
      .populate("customer", "name email")
      .populate("assignedTo", "name email")
      .populate("approvedBy", "name email")
      .populate("createdBy", "name email");

    // Log each change separately
    if (changes.length > 0) {
      for (const change of changes) {
        await Log.create({
          orderId: req.params.id,
          changes: change,
        });
      }
    }

    // Notify users about any changes
    notifyOrderUpdated(req, order, updateFields);

    res.status(200).json({
      success: true,
      message: "Order has been updated successfully",
      order,
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Order not found" });
    }
    res.status(500).send("Server error");
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    // Remove related work queue items
    await WorkQueueItem.deleteMany({ order: req.params.id });

    // Remove order
    await order.deleteOne();

    res.json({ msg: "Order and related items removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Order not found" });
    }
    res.status(500).send("Server error");
  }
};

exports.approveOrder = async (req, res) => {
  try {
    // Check if order exists
    let order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        msg: "Order not found",
      });
    }

    // Check if order is in the right status
    if (order.status !== "PendingApproval") {
      return res
        .status(400)
        .json({ msg: "Order is not in pending approval status" });
    }

    // Update order status and add to work queue
    order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "InWorkQueue",
          approvedBy: req.user.id,
        },
      },
      { new: true }
    )
      .populate("customer", "name email")
      .populate("assignedTo", "name email")
      .populate("approvedBy", "name email")
      .populate("createdBy", "name email");

    // Create work queue item
    const workQueueItem = new WorkQueueItem({
      order: order._id,
      status: "graphics_pending",
    });

    await workQueueItem.save();

    res.status(200).json({
      success: true,
      message: "order approved",
      order,
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Order not found" });
    }
    res.status(500).send("Server error");
  }
};
