const express= require("express");
const router = express.Router();

const {auth,isAccount} = require("../middleware/auth");

const {accountController}= require("../controller/accounts.controller");


router.get("/accounts",auth,isAccount,accountController);

module.exports= router