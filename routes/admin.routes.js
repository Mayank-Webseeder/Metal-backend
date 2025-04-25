const express= require("express");
const router = express.Router();
const multer = require('multer');
const {storage} = require("../config/cloudinary");
const upload = multer({ storage });


const {auth, isAdmin ,isGraphics, isSuperAdmin, isCutout, isGraphicsCutout, isCutoutAndAdmin , isViewer} = require("../middleware/auth");

const {adminController}= require("../controller/admin.controller");
const logController = require("../controller/log.controller");
const {
    createLead,
    updateLead,
    deleteLead,
    convertToCustomer,
    getAllLeads
    }= require('../controller/lead.controller');

const{ createCustomer, updateCustomer, deleteCustomer,
    getCustomerOrders, 
    getAllCustomers
    }= require("../controller/customer.controller")


const{
    createOrder,
    updateOrder,
    deleteOrder,
    getOrderById,
    getOrders,
    assignOrder,
    approveOrder

    }= require("../controller/order.controller")


const graphicController = require("../controller/graphics.controller");

const cutoutController = require("../controller/cutout.controller");

const accountController = require("../controller/accounts.controller");
const notificationController = require("../controller/notification.controller");
  
    
const{localFileUpload}= require("../utils/ImageUploader")


// router.get("/admin",auth,isAdmin,adminController);
router.post("/createLead",auth,isAdmin,createLead);
router.put("/updateLead/:id",auth,isAdmin,updateLead);
router.delete("/deleteLead/:id",auth,isAdmin,deleteLead);
router.post("/convertToCustomer/:id",auth,isAdmin,convertToCustomer);
router.get("/getAllLeads", auth, isAdmin, getAllLeads);

//create customer route
router.post("/createCustomer",auth,isAdmin,createCustomer);
router.put("/updateCustomer/:id",auth,isAdmin,updateCustomer);
router.delete("/deleteCustomer/:id",auth,isAdmin,deleteCustomer);
router.get("/getCustomerOrders/:id",auth,isAdmin,getCustomerOrders);
router.get("/getAllCustomers", auth, isAdmin, getAllCustomers);

//create Order
router.put("/updateOrder/:id",auth,isAdmin,updateOrder);
router.delete("/deleteOrder/:id",auth,isAdmin,deleteOrder);
router.get("/getOrderById/:id",auth,isAdmin,getOrderById,);
router.get("/getOrders",auth,getOrders);
router.put("/assignOrder/:id",auth,isAdmin,assignOrder);
router.put("/approveOrder",auth,isAdmin,approveOrder);


router.post('/createOrder/:id', auth, isAdmin, graphicController.createOrder);

// Get pending orders (for admin or graphics team)
router.get('/pending', auth, isAdmin, graphicController.getPendingOrders);

// Reassign unassigned orders (for admin)
router.put( '/reassign', auth, isAdmin, graphicController.reassignUnassignedOrders);

// Get user's assigned orders (for graphics team)
router.get('/assigned', auth, isGraphicsCutout, graphicController.getUserAssignedOrders);

router.post('/updateWorkQueue',auth,isGraphics,graphicController.updateWorkQueueStatus);

router.post('/fileupload',auth,isGraphics,graphicController.uploadFile);

// Keep existing route for backward compatibility
router.get('/files/download/:documentId/:fileIndex', auth, graphicController.downloadCadFile);

// Add new route for downloading all files as ZIP
router.get('/files/download-all/:documentId', auth, graphicController.downloadAllFiles);

// Optional route for downloading all files of a specific type
router.get('/files/download-all-type/:documentId', auth,  graphicController.downloadAllFilesOfType);
// Keep existing route for listing files
router.get('/files/order/:orderId', auth, graphicController.getFilesByOrder);
router.get('/file/order/:orderId', auth, isCutout, graphicController.getFilesByOrder);

//cutout routes
router.post("/cutout/assignOrder/:orderId",auth, cutoutController.assignOrderToCutout);
router.post("/cutout/changeStatus",auth,cutoutController.changeStatus);





// Extra routes for download  graphics
router.get('/file/download/:documentId/:fileIndex', auth,  cutoutController.downloadCadFile);
// Add new route for downloading all files as ZIP
router.get('/file/download-all/:documentId', auth,  cutoutController.downloadAllFiles);
// Optional route for downloading all files of a specific type
router.get('/file/download-all-type/:documentId', auth,  cutoutController.downloadAllFilesOfType);



router.post("/grpahics/deleteCadFile",auth,graphicController.deleteCadFileOrPhotoByIndex);
router.post("/cutout/getCadFilesAndPhoto",auth,cutoutController.getCadFilesByOrderAndAssignedUser);


//accounts section routes
router.post("/accounts/assignOrderToAccount/:orderId",auth,accountController.assignOrderToAccount);
router.post("/accounts/createBill",auth,accountController.createBill);
router.get("/accounts/getAssignedOrders",auth,accountController.getAssignedOrders);



//getting log routes
router.get("/getAllLog/:orderId",auth,logController.getAllLog)
//notification
router.get("/getNotification",auth,notificationController.fetchAllNotification);



module.exports= router