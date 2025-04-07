const mongoose= require("mongoose");
const cadSchema= new mongoose.Schema({
    order:{
        type:mongoose.Types.ObjectId,
        ref:"Order"
    },
    photo:[{
        type:String,
        required:true,
    }],
    CadFile:[{
        type:String,
        required:true
    }]
},{timestamps:true})
module.exports=mongoose.model("Cad",cadSchema);