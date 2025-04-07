const mongoose= require("mongoose");

const AddressSchema= new mongoose.Schema({
    street:{
        type:String
    },
    city:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    pincode:{
        type:String,
        required:true
    },
    additionalDetail:{
        type:String
    }
})
//comment added

module.exports=mongoose.model("Address",AddressSchema);