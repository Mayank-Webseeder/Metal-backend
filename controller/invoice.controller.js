const Invoice = require("../models/invoice.model");
const Order = require("../models/order.model");
const Customer = require("../models/customer.model");
const Address = require("../models/Address.model");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { convertToWords } = require("../utils/numberToWords");
const Log = require("../models/log.model")
const User = require('../models/user.models');

// Company details - could be moved to environment variables or database
const COMPANY_DETAILS = {
  name: "BLUE STAR COMMUNICATION",
  street: "21 Agarbatti Complex Sec A Sewer Road",
  city: "Indore",
  state: "MADHYA PRADESH",
  pincode: "",
  pan: "CYJPS9134H",
  gstin: "23CYJPS9134H1Z8",
  bankDetails: {
    accountNo: "1547049279",
    ifsc: "CODIRKBK005965",
    bank: "Kotak Mahindra Bank",
    branch: "LIG Square Indore"
  }
};

// Create new invoice
exports.createInvoice = async (req, res) => {
  try {
    const { orderId, items } = req.body;
    
    // Validate items are provided
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invoice items are required"
      });
    }
    
    // Find order and validate it exists and has status "accounts_paid"
    const order = await Order.findById(orderId).populate({
      path: "customer",
      populate: { path: "address" }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    
    if (order.status !== "accounts_paid" && order.status !== "order_completed"){
      return res.status(400).json({
        success: false,
        message: "Invoice can only be created for paid orders"
      });
    }
    
    const customer = order.customer;
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer information not found for this order"
      });
    }
    
    // Calculate invoice amounts
    const subtotal = items.reduce((total, item) => {
      return total + (item.rate * item.quantity);
    }, 0);
    
    const cgstRate = 9;
    const sgstRate = 9;
    const cgstAmount = (subtotal * cgstRate) / 100;
    const sgstAmount = (subtotal * sgstRate) / 100;
    const total = subtotal + cgstAmount + sgstAmount;
    
    // Convert total to words
    const amountInWords = convertToWords(Math.round(total));
    
    // Create invoice object
    const newInvoice = new Invoice({
      order: orderId,
      customer: customer._id,
      items: items.map(item => ({
        description: item.description,
        rate: item.rate,
        quantity: item.quantity,
        amount: item.rate * item.quantity
      })),
      subtotal,
      cgst: cgstRate,
      sgst: sgstRate,
      cgstAmount,
      sgstAmount,
      total,
      amountInWords,
      companyAddress: {
        name: COMPANY_DETAILS.name,
        street: COMPANY_DETAILS.street,
        city: COMPANY_DETAILS.city,
        state: COMPANY_DETAILS.state,
        pincode: COMPANY_DETAILS.pincode
      },
      customerAddress: {
        name: customer.name,
        street: customer.address?.street || "",
        city: customer.address?.city || "",
        state: customer.address?.state || "",
        pincode: customer.address?.pincode || "",
        gstin: customer.gstNo || "",  // Add customer GST number
        panNo: customer.panNo || ""   // Add customer PAN number
      },
      createdBy: req.user ? req.user._id : null
    });


    
    // Save invoice
    const savedInvoice = await newInvoice.save();

    // const user = req.user ? await User.findById(req.user._id) : null;
    const CurrentUser = await User.findById(order.assignedTo);
    await Log.create({
      orderId: order._id,
      changes: `Invoice created for Order by ${CurrentUser.name} role (${CurrentUser.accountType})`,
    });
    
    res.status(201).json({
      success: true,
      data: savedInvoice,
      message: "Invoice created successfully"
    });
    
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error creating invoice",
      error: error.message
    });
  }
};

// Get all invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("order")
      .populate("customer")
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message
    });
  }
};

// Get invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("order")
      .populate("customer");
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
      error: error.message
    });
  }
};

// Get invoices by order ID
exports.getInvoicesByOrderId = async (req, res) => {
  try {
    const invoices = await Invoice.find({ order: req.params.orderId })
      .populate("order")
      .populate("customer")
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message
    });
  }
};

// Download invoice as PDF
exports.downloadInvoice = async (req, res) => {
  try {
    console.log("Downloading invoice with ID:", req.params.id);
    console.log("tkennn ", req.params.token);
    const invoice = await Invoice.findById(req.params.id)
      .populate("order")
      .populate("customer");
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }
    
    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    
    // Pipe the PDF document to the response
    doc.pipe(res);
    
    // Generate PDF content
    generateInvoicePDF(doc, invoice);
    
    // Finalize the PDF and end the stream
    doc.end();
    
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading invoice",
      error: error.message
    });
  }
};


// Download invoice as PDF
exports.downloadInvoice = async (req, res) => {
  try {
    console.log("Downloading invoice with ID:", req.params.id);
    console.log("tkennn ", req.params.token);
    const invoice = await Invoice.findById(req.params.id)
      .populate("order")
      .populate("customer");
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }
    
    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    
    // Pipe the PDF document to the response
    doc.pipe(res);
    
    // Generate PDF content
    generateInvoicePDF(doc, invoice);
    
    // Finalize the PDF and end the stream
    doc.end();
    
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading invoice",
      error: error.message
    });
  }
};

function generateInvoicePDF(doc, invoice) {
  // Set font
  doc.font('Helvetica');
  
  // Add company and customer information
  doc.fontSize(12);
  
  // Create a table-like structure
  const tableTop = 100;
  const tableLeft = 50;
  const tableRight = 550;
  const rowHeight = 20;
  
  // Header section with company and customer info
  doc.rect(tableLeft, tableTop, tableRight - tableLeft, 150).stroke();
  
  // Vertical line dividing company and customer info - exactly in middle
  const middleDivider = 300;
  doc.moveTo(middleDivider, tableTop).lineTo(middleDivider, tableTop + 150).stroke();
  
  // Company info (left side)
  doc.fontSize(10)
    .text("To,", tableLeft + 10, tableTop + 10)
    .text(invoice.companyAddress.name, tableLeft + 10, tableTop + 30, {bold: true})
    .text(invoice.companyAddress.street, tableLeft + 10, tableTop + 50)
    .text(`Industrial Area behind Water Tank`, tableLeft + 10, tableTop + 70)
    .text(`Town/Distt-${invoice.companyAddress.city}, ${invoice.companyAddress.state}`, tableLeft + 10, tableTop + 90)
    .text(`state:${invoice.companyAddress.state}`, tableLeft + 10, tableTop + 110);
  
  // Invoice info (right side) - Split into label and value columns
  const labelColumnX = middleDivider + 10;
  const valueColumnX = middleDivider + 135; // Adding space for the label column
  const labelColumnWidth = 125;
  
  // Draw vertical line to separate labels and values
  doc.moveTo(valueColumnX - 10, tableTop).lineTo(valueColumnX - 10, tableTop + 150).stroke();
  
  let currentRowY = tableTop;
  const rowStep = 15;
  
  // Helper function to add a row with label and value columns with horizontal line
  function addHeaderRow(label, value, y) {
    // Label in left column
    doc.fontSize(10).text(label, labelColumnX, y + 3);
    
    // Value in right column (if provided)
    if (value) {
      doc.text(value, valueColumnX, y + 3);
    }
    
    // Draw horizontal line after this row
    doc.moveTo(middleDivider, y + rowStep).lineTo(tableRight, y + rowStep).stroke();
    
    return y + rowStep; // Return the next row position
  }
  
  // Invoice header rows with labels and values
  currentRowY = addHeaderRow("Invoice No. :", invoice.invoiceNumber, currentRowY);
  currentRowY = addHeaderRow("Invoice Date :", new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), currentRowY);
  currentRowY = addHeaderRow("Invoice Code :", "", currentRowY);
  currentRowY = addHeaderRow("Site Name :", "NONE", currentRowY);
  currentRowY = addHeaderRow("Site ID :", "NONE", currentRowY);
  currentRowY = addHeaderRow("P. O. No. :", "NONE", currentRowY);
  currentRowY = addHeaderRow("P.O. Date :", "NONE", currentRowY);
  currentRowY = addHeaderRow("PAN No. :", COMPANY_DETAILS.pan, currentRowY);
  currentRowY = addHeaderRow("GSTN (M.P.) :", COMPANY_DETAILS.gstin, currentRowY);
  currentRowY = addHeaderRow("State", invoice.customerAddress.state || "", currentRowY);
  
  // Customer info section
  const customerTop = tableTop + 150;
  doc.rect(tableLeft, customerTop, tableRight - tableLeft, 80).stroke();
  
  // Vertical line dividing customer sections
  doc.moveTo(middleDivider, customerTop).lineTo(middleDivider, customerTop + 80).stroke();
  
  // Customer address (left side)
  doc.fontSize(10)
    .text("To,", tableLeft + 10, customerTop + 6)
    .text(invoice.customerAddress.name, tableLeft + 10, customerTop + 21)
    .text(`${invoice.customerAddress.street || ""} ${invoice.customerAddress.city || ""} ${invoice.customerAddress.pincode || ""}` , tableLeft + 10, customerTop + 36)
    .text(`GST No. ${invoice.customer.gstNo}`, tableLeft + 10, customerTop + 51)
    .text(`state: ${invoice.customerAddress.state || ""}`, tableLeft + 10, customerTop + 66);
  
  // Customer tax info (right side) with separate columns for labels and values
  currentRowY = customerTop;
  
  // Draw vertical line to separate labels and values in the customer section
  doc.moveTo(valueColumnX - 10, customerTop).lineTo(valueColumnX - 10, customerTop + 80).stroke();
  
  // Customer tax info rows
  currentRowY = addHeaderRow("State Code :", getStateCode(invoice.customerAddress.state) || "", currentRowY);
  currentRowY = addHeaderRow("HSN :", "72104900", currentRowY);
  currentRowY = addHeaderRow("Vehicle No :", "", currentRowY);
  
  // Items table header
  const itemsTop = customerTop + 80;
  doc.rect(tableLeft, itemsTop, tableRight - tableLeft, 20).stroke();
  
  // Adjusted column widths and positions
  const srNoWidth = 30;  // Reduced width
  const descWidth = 220; // Reduced width for description
  const rateWidth = 80;  // Adjusted width for rate
  const qtyWidth = 70;   // Adjusted width for quantity
  const amtWidth = 100;  // Increased width for amount
  
  // Column positions
  const srNoPos = tableLeft;
  const descPos = srNoPos + srNoWidth;
  const ratePos = descPos + descWidth;
  const qtyPos = ratePos + rateWidth;
  const amtPos = qtyPos + qtyWidth;
  
  // Draw column dividers for header
  doc.moveTo(descPos, itemsTop).lineTo(descPos, itemsTop + 20).stroke();  // Sr.No
  doc.moveTo(ratePos, itemsTop).lineTo(ratePos, itemsTop + 20).stroke();  // Description
  doc.moveTo(qtyPos, itemsTop).lineTo(qtyPos, itemsTop + 20).stroke();    // Rate
  doc.moveTo(amtPos, itemsTop).lineTo(amtPos, itemsTop + 20).stroke();    // Quantity
  
  // Header text - adjusted positions
  doc.fontSize(10)
    .text("Sr.No", srNoPos + 3, itemsTop + 7)
    .text("Supply/Service Description", descPos + 20, itemsTop + 7) // Centered in column
    .text("RATE", ratePos + 25, itemsTop + 7)                      // Centered in column
    .text("QUANTITY", qtyPos + 10, itemsTop + 7)                   // Centered in column
    .text("Amount (INR)", amtPos + 15, itemsTop + 7);              // Centered in column
  
  // Items rows
  let currentPosition = itemsTop + 20;
  
  invoice.items.forEach((item, index) => {
    doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 20).stroke();
    
    // Draw column dividers for row with adjusted positions
    doc.moveTo(descPos, currentPosition).lineTo(descPos, currentPosition + 20).stroke();
    doc.moveTo(ratePos, currentPosition).lineTo(ratePos, currentPosition + 20).stroke();
    doc.moveTo(qtyPos, currentPosition).lineTo(qtyPos, currentPosition + 20).stroke();
    doc.moveTo(amtPos, currentPosition).lineTo(amtPos, currentPosition + 20).stroke();
    
    // Text with adjusted positions
    doc.text(index + 1, srNoPos + 10, currentPosition + 7)                // Sr. No (centered)
      .text(item.description, descPos + 5, currentPosition + 7)           // Description (left aligned)
      .text(item.rate.toFixed(2), ratePos + 25, currentPosition + 7)      // Rate (centered)
      .text(item.quantity.toFixed(1), qtyPos + 15, currentPosition + 7)   // Quantity (centered)
      .text(item.amount.toFixed(2), amtPos + 15, currentPosition + 7);    // Amount (centered)
    
    currentPosition += 20;
  });
  
  // Add empty row with just the amount repeated
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 20).stroke();
  doc.text(invoice.subtotal.toFixed(2), amtPos + 15, currentPosition + 7);
  currentPosition += 20;
  
  // CGST row
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 20).stroke();
  doc.text(`SGST ${invoice.sgst}%`, descPos + 5, currentPosition + 7)
     .text(invoice.sgstAmount.toFixed(2), amtPos + 15, currentPosition + 7);
  currentPosition += 20;
  
  // SGST row
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 20).stroke();
  doc.text(`CGST ${invoice.cgst}%`, descPos + 5, currentPosition + 7)
     .text(invoice.cgstAmount.toFixed(2), amtPos + 15, currentPosition + 7);
  currentPosition += 20;
  
  // Empty row
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 20).stroke();
  currentPosition += 20;
  
  // Sub Total row
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 20).stroke();
  doc.fontSize(10).text("Sub Total", ratePos, currentPosition + 7)
     .text(invoice.total.toFixed(2), amtPos + 15, currentPosition + 7);
  currentPosition += 20;
  
  // Grand Total row
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 30).stroke();
  doc.fontSize(12).text("GRAND TOTAL", ratePos, currentPosition + 10)
     .text(` ${Math.round(invoice.total)}`, amtPos + 15, currentPosition + 10);
  currentPosition += 30;
  
  // Amount in words row
  doc.rect(tableLeft, currentPosition, tableRight - tableLeft, 30).stroke();
  doc.fontSize(10).text("Amount in words (INR):", tableLeft + 10, currentPosition + 10)
     .text(`Rs. ${invoice.amountInWords}`, tableLeft + 150, currentPosition + 10);
  currentPosition += 30;
  
  // Footer section
  const footerSpace = 140;
  doc.moveTo(tableLeft, currentPosition + footerSpace).lineTo(tableRight, currentPosition + footerSpace).stroke();
  
  // Left side of footer
  doc.fontSize(10).text("For", tableLeft + 10, currentPosition + 10)
     .text("Authorized Signatory", tableLeft + 10, currentPosition + 110);
  
  // Right side of footer with bank details
  doc.fontSize(10)
     .text("Bank details", 310, currentPosition + 10)
     .text(COMPANY_DETAILS.name, 310, currentPosition + 25)
     .text(`Account no      ${COMPANY_DETAILS.bankDetails.accountNo}`, 310, currentPosition + 40)
     .text(`IFSC    ${COMPANY_DETAILS.bankDetails.ifsc}`, 310, currentPosition + 55)
     .text(`BRANCH        ${COMPANY_DETAILS.bankDetails.bank}`, 310, currentPosition + 70)
     .text(`            ${COMPANY_DETAILS.bankDetails.branch}`, 310, currentPosition + 85);
  
  // Subject line
  doc.fontSize(10).text("Subject to Indore Jurisdiction", tableLeft + 220, currentPosition + 130);
  
  // Draw the single outer border rectangle around the entire invoice
  doc.rect(tableLeft, tableTop, tableRight - tableLeft, currentPosition + footerSpace - tableTop).stroke();
}

// Helper function to get state code
function getStateCode(state) {
  const stateCodes = {
    "MADHYA PRADESH": "23",
    "MAHARASHTRA": "27",
    "Delhi": "07",
    // Add more states as needed
  };
  
  return stateCodes[state] || "";
}

// Preview invoice as PDF
exports.previewInvoice = async (req, res) => {
  try {
    console.log("Previewing invoice with ID:", req.params.id);
    
    const invoice = await Invoice.findById(req.params.id)
      .populate("order")
      .populate("customer");
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }
    
    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for inline viewing (not download)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=invoice-preview-${invoice.invoiceNumber}.pdf`);
    
    // Pipe the PDF document to the response
    doc.pipe(res);
    
    // Generate PDF content using the same function as download
    generateInvoicePDF(doc, invoice);
    
    // Finalize the PDF and end the stream
    doc.end();
    
  } catch (error) {
    console.error("Error previewing invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error previewing invoice",
      error: error.message
    });
  }
};


module.exports = exports;