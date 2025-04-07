const mongoose= require("mongoose");
const GalleryItemSchema = new mongoose.Schema({
    title:{
        type:String,
        required:true
    },
    descriptions:{
        type:String,
        
    },
    image:{
        type:String,
        required:true
    },
    order:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Order'
    },
    uploadedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    }


},{timeStamp:true})

module.exports = mongoose.model("GalleryItem",GalleryItemSchema);