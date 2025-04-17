const mongoose= require("mongoose");
const logSchema= new mongoose.Schema({
    orderId:{
        type:mongoose.Types.ObjectId,
        ref:'Order'
    },
    changes:{
        type:"String"

    },
    previmage:[
        {
            type:"String",
        },
    ]
    ,afterimage:[
        {
            type:"String",

        },

    ]
    
},{timestamps:true});
module.exports=mongoose.model("Log",logSchema);