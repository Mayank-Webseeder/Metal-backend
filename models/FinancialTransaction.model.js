const mongoose = require("mongoose");
const financialTransactionSchema = new mongoose.Schema({
    order:{
        type:mongoose.Types.ObjectId,
        ref:"Order",
        required:true
    },
    
    status:{
        type:String,
        enum:["Completed","Pending","Billed"],
        default:"Pending"
    },
    
    
    processedBy:{
        type:mongoose.Types.ObjectId,
        ref:'User',
        required:true
    }


},{timeStamps:true});

financialTransactionSchema.pre("save",function(next) {
    //auto generate invoice number if not already set

    if(!this.invoiceNumber){
        this.invoiceNumber=`INV-${Date.now()}`;
    }

    //set paymentDate if status is completed 
    if(this.status ==="Completed" && !this.paymentDate){
        const currentDate = new Date();
        this.paymentDate= currentDate.toLocaleString("en-us",{
            year:"numeric",
            month:"long",
            day:"numeric",
            hour:"2-digit",
            minute:"2-digit",
            second:"2-digit",
        });
    }
    next();

});

module.exports= mongoose.model("FinancialTransaction",financialTransactionSchema);