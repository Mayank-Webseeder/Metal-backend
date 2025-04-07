const mongoose= require("mongoose");
const leadSchema= new mongoose.Schema({
    name:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:true,

    },
    status:{
        type:String,
        enum:["New","Contacted","Converted","Lost"],
        default:"New"


    },
    descriptions:{
        type:String
    }

    


},{timestamps:true});

module.exports= mongoose.model("Lead",leadSchema);