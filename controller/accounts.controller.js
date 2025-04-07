const FinancialTransaction = require("../models/FinancialTransaction.model")
const order = require("../models/order.model");


exports.CreateBill= async(req,res)=>{
    try {
        const {orderId}=req.body;
        
        if(!order){
            return res.status(400).json({
                success:false,
                message:"all fields are mandatory",
            })
        }

        const Order= await order.findById(orderId);
        if(!Order){
            return res.status(404).json({
                success:false,
                message:"order not found"
            })
        }

        if(Order.status!=='Completed' && Order.status!=='Billed'){
            return res.status(400).json({
                success:false,
                message:"cannot crete bill for an order that is not completed"
            })
        }

        Order.status="Billed"

        const newBill = new FinancialTransaction({
            orderId,
            status:"Billed",
            processedBy:req.user._id

        })
        
        const savedBill =await newBill.save();

        const populatedBill = await FinancialTransaction.findById(savedBill._id).populate("orderId");


        return res.status(200).json({
            success:true,
            message:"billed successfully",
            savedBill:populatedBill,
        })

        
    } catch (error) {
        console.log("error in creating the bill",error);
        return res.status(400).json({
            success:false,
            message:"problem in creatiing the bill",
            error:message.error
        })
        
    }
}

const updateBill = async(req,res)=>{
    try {
        const {billId} = req.params.id
        const status= req.body;

        const bill = await FinancialTransaction.findById(billId);
        if(!bill){
            return res.status(404).json({
                success:false,
                message:"this order does not found",
                
            })
        }

        bill.status= status;
        await bill.save();
        
        const updatedBill = await FinancialTransaction.findById(req.params.id)
        .populate('order', 'orderId customer')
        .populate({
          path: 'order',
          populate: { path: 'customer', select: 'name email' }
        })
        .populate('processedBy', 'name email');
      
      res.json(updatedTransaction);
    } 
    catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Transaction not found' });
      }
      res.status(500).send('Server error');
    }
  };


  exports.getAllBill =async(req,res)=>{
    try {
        const bills= await FinancialTransaction.find()
        .populate("orderId","orderId customer requirements dimensions status")
        .populate("processedBy","name email ");

        return res.status(200).json({
            success:true,
            messaage:"All bills has been fetched successfully",
            bills,
        });
        
    } catch (error) {
        console.log("problem in fetching all bills",error);
        return res.status(400).json({
            success:False,
            message:"problem in fetching alll data",
            error:error.message
        })
        
    }
  }







exports.accountController=async(req,res)=>{
    try {
        
        return res.status(200).json({
            success:true,
            message:"welcome to account section"
        })
    } catch (error) {
        return res.status(400).json({
            success:false,
            message:"error in account controller",
            error:error.message
        })
        
    }
}