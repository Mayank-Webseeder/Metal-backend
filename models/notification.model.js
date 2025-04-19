const mongoose= require("mongoose");
const notificationSchema= new mongoose.Schema({
    userId:[{
        type:mongoose.Types.ObjectId,
        ref:'User'
    }],
    text:{
        type:String
    }

    
},{timestamps:true});
module.exports=mongoose.model("notification",notificationSchema);