const express= require("express");
const router = express.Router();

const {auth,isGraphics} = require("../middleware/auth");

const {graphicsController}= require("../controller/graphics.controller");


router.get("/graphics",auth,isGraphics,graphicsController);

module.exports= router