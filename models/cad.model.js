const mongoose= require("mongoose");
const cadSchema= new mongoose.Schema({
    order:{
        type:mongoose.Types.ObjectId,
        ref:"Order"
    },
    photo:[{
        type:String,
        
    }],
    CadFile:[{
        type:String,
        
    }],
    textFiles: [{
        type: String,
    }]
},{timestamps:true})
module.exports=mongoose.model("Cad",cadSchema);