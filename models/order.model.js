const mongoose = require("mongoose");
const Counter = require("../models/counter");
const Log = require("./log.model");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  requirements: {
    type: String,
  },
  dimensions: {
    type: String,
  },
  // status: {
  //   type: String,
  //   enum: [
  //     "New",
  //     "Assigned",
  //     "InProgress",
  //     "PendingApproval",
  //     "Approved",
  //     "InWorkQueue",
  //     "Completed",
  //     "InAccountSection",
  //     "Billed",
  //     "Paid",
  //   ],
  //   default: "New",
  // },
  status: {
    type: String,
    enum: [
      "graphics_pending",
      "graphics_in_progress",
      "graphics_completed",
      "admin_review",
      "admin_approved",
      "admin_rejected",
      "cutout_pending",
      "cutout_in_progress",
      "cutout_completed",
      "accounts_pending",
      "accounts_billed",
      "accounts_paid",
      "order_completed",
    ],
    default: "graphics_pending",
  },
  
  image: [
    {
      type: String,
    },
  ],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  customerName: {
    type: String,
  },
  created: {
    type: String,
    required: true,
    default: () => new Date().toISOString().split("T")[0],
  },
}, { timestamps: true }); // ✅ Corrected spelling

// // ✅ Pre-save hook to auto-generate orderId
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { name: "order" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const paddedSeq = String(counter.seq).padStart(5, "0");
      this.orderId = `ORD${paddedSeq}`;
      next();
    } catch (err) {
      next(err); // pass error to Mongoose
    }
  } else {
    next();
  }
});






module.exports = mongoose.model("Order", orderSchema);
