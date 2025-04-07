exports.adminController= async(req,res)=>{
    try {
        
        return res.status(200).json({
            success:true,
            message:"welcome back admin"
        })
        
    } catch (error) {
        return res.status(402).json({
            success:false,
            error:error.message
        })
        
    }
}