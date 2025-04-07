const express= require("express");
const router = express.Router();

const {auth,isSuperAdmin} = require("../middleware/auth");

const {superAdminController}= require("../controller/superadmin.controller");


router.get("/superAdmin",auth,isSuperAdmin,superAdminController);

module.exports= router