const mongoose = require("mongoose");
const Counter = require("./cnt");

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    required: true,
  },
  order: {
    type: mongoose.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  customer: {
    type: mongoose.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
  },
  items: [
    {
      description: {
        type: String,
        required: true,
      },
      rate: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
    },
  ],
  subtotal: {
    type: Number,
    required: true,
  },
  cgst: {
    type: Number,
    required: true,
    default: 9, // percentage
  },
  sgst: {
    type: Number,
    required: true,
    default: 9, // percentage
  },
  cgstAmount: {
    type: Number,
    required: true,
  },
  sgstAmount: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  amountInWords: {
    type: String,
    required: true,
  },
  companyAddress: {
    name: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
  },
  customerAddress: {
    name: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    gstin: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

// Pre-save hook to auto-generate invoiceNumber
invoiceSchema.pre("validate", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { name: "invoice" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const seq = String(counter.seq).padStart(5, "0");
      
      this.invoiceNumber = `BSCS-${year}-${month}-${seq}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model("Invoice", invoiceSchema);