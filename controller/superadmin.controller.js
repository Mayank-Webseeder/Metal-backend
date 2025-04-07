exports.superAdminController = async(req,res)=>{
    try {
        return res.status(200).json({
            success:true,
            message:"welcome SuperAdmin"
        })
    } catch (error) {
        return res.status(400).json({
            success:false,
            error:error.message,
            message:"problem in superadimn controller"
        })
        
    }
}