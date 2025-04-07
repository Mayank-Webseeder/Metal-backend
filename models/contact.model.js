const mongoose= require('mongoose');

const contactSchema= new mongoose.Schema({
    name:{
        type:String,
        required:true

    },
    email:{
        type:String,
        required:true

    },
    address:{
        type:"String",
        
    },
    phoneNo:{
        type:Number,
        required:true
    },
    isCustomer:{
        type:boolean,
        default:false

    },
    description:{
        type:String
    },
    createdBy:{
        type:mongoose.Types.ObjectId,
        ref:'User'
    }
},{timeStamp:true})

module.exports= mongoose.model('Contact',contactSchema);

