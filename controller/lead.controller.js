const Lead= require("../models/lead.model");
const Customer = require("../models/customer.model");

exports.createLead= async(req,res)=>{
    try {
        const{name,email,phone,descriptions} = req.body;

        if(!name || !email || !phone){
            return res.status(400).json({
                success:false,
                message:"All fields are mandatory"

            });
        }
        //check if lead exist with the same email or not
        const existingLead = await Lead.findOne({email});
        if(existingLead){
            return res.status(400).json({
                success:false,
                message:"A lead with this email id already exist"
            });
        }

        //create a new lead 
        const newLead= new Lead({
            name,
            email,
            phone,
            descriptions,
        });

        //save the new lead to the database
        const savedLead= await newLead.save();
        const verifyLead = await Lead.findOne({ email });
        console.log('Verified lead from DB:', verifyLead);

        //return success response
        return res.status(201).json({
            success:true,
            message:"New lead created successfully",
            data:savedLead
        })

        
    } catch (error) {
        return res.status(400).json({
            success:false,
            message:"error occured  in creating new lead",
            error:error.message,
        })
        
    }
}

exports.updateLead = async(req,res)=>{
    try {
        const {id} = req.params;
        const{name,phone,descriptions,status,email}=  req.body;

        

        //find the lead and update the lead
        const lead = await Lead.findById(id);
        if(!lead){
            return res.status(404).json({
                success:false,
                message:"Lead not found "
            })
        }

        if(name) lead.name= name;
        if(phone) lead.phone =phone;
        if(descriptions) lead.descriptions = descriptions;
        if(status) lead.status = status;
        if(email) lead.email = email;

        //save the updated details
        const updatedLead = await lead.save();

        //return success response
        return res.status(200).json({
            success:true,
            message:"lead has been updated successfully",
            data:updatedLead
        })
        
    } catch (error) {
        console.log("Error in updating the lead");
        return res.status(400).json({
            success:false,
            message:"error in updating the lead",
            error:error.message
        })
        
    }
}


exports.deleteLead = async(req,res)=>{
    try {
       const {id}= req.params;

        //check lead exists or not
        const existingLead= await Lead.findById(id);
        if(!existingLead){
            return res.status(404).json({
                success:false,
                message:"Lead not found"
            })
        }
        //delete the lead
        await Lead.deleteOne({_id:id});

        //return success response
        return res.status(200).json({
            success:true,
            message:"Lead deleted successfully"
        });

        
    } catch (error) {
        console.error("Error in deleting the lead",error);

        return res.status(400).json({
            success:false,
            message:"error occured in deleting the lead",
            error:error.message
        })
        
    }
}

exports.convertToCustomer =async(req,res)=>{
    try {
        const{id}= req.params
        const lead =await Lead.findById(id);
        if(!lead){
            return res.status(404).json({
                success:false,
                message:"lead not found"
            })
        }

        //create a new customer from lead data
        const newCustomer= new Customer({
            name:lead.name,
            email:lead.email,
            phoneNo:lead.phone,
            createdBy:req.user.id

        });

        const customer =await newCustomer.save();

        lead.status='Converted';
        await lead.save();

        return res.status(200).json({
            success:true,
            message:"converted into customer",
            customer,
            lead
        })


        
    } catch (error) {
        console.error("error in converting customer to lead",error);
        return res.status(400).json({
            success:false,
            message:"problem in converting lead to customer",
            error :error.message
        })
        
    }
}