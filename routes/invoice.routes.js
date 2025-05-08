const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoice.controller");
const { auth} = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(auth);

// Create a new invoice
router.post("/create", invoiceController.createInvoice);

// Get all invoices
router.get("/", invoiceController.getAllInvoices);

// Get invoice by ID
router.get("/:id", invoiceController.getInvoiceById);

// Get invoices by order ID
router.get("/order/:orderId", invoiceController.getInvoicesByOrderId);

// Download invoice as PDF
router.get("/download/:id", invoiceController.downloadInvoice);

router.get("/preview/:id", invoiceController.previewInvoice);

module.exports = router;