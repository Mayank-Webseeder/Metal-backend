const express=require("express");
const router= express.Router();
const {auth, isSuperAdmin} = require("../middleware/auth");
const {getUser, getAllUsers} = require("../controller/user.controller");
const userController = require("../controller/user.controller");

router.post("/signup", userController.signUp);
router.post("/create-account",auth, isSuperAdmin, userController.createAccount);
router.post("/login",userController.login)
router.get("/getUser", auth, getUser);
router.post("/change-password", auth, userController.changePassword);
router.get("/getAllUsers", auth, getAllUsers);
router.delete("/deleteUser/:userId", auth, isSuperAdmin, userController.deleteUser);

router.put("/updateUser/:userId", auth, userController.updateUser);

module.exports= router;