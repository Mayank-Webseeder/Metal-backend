const Customer = require("../models/customer.model");
const Order= require("../models/order.model");

const Address = require("../models/Address.model")

exports.createCustomer= async(req,res)=>{
    try {
        const{
            firstName,
            lastName,
            email,
            phoneNo,
            address,
        }=req.body;

        if(!firstName || !lastName || !email || !phoneNo ){
            return res.status(400).json({
                success:false,
                message:"All fields are mandatory"
            })
        };

        const trimmedEmail= email.trim()
        const existingCustomer= await Customer.findOne({email:trimmedEmail});

        if(existingCustomer){
            return res.status(400).json({
                success:false,
                message:"Customers already registered with this email id"
            })
        }

        // Check for existing phone number
        const existingPhone = await Customer.findOne({ phoneNo });
        if(existingPhone) {
            return res.status(400).json({
                success: false,
                message: "Phone number already registered with another customer"
            });
        }

        let savedAddress = null;
        if(address){
            if(!address.street || !address.city || !address.state || !address.pincode){
                return res.status(400).json({
                    success:false,
                    message:"Address must include street,city,state and pincode",
                });
            }
            //create the address
            const newAddress = new Address({
                street: address.street,
                city:address.city,
                state:address.state,
                pincode:address.pincode,
                additionalDetail:address.additionalDetail
            });

            savedAddress = await newAddress.save();
        }

        console.log("savedAddress is:",savedAddress);
        
        const newCustomer = new Customer({
            firstName,
            lastName,
            email,
            phoneNo,
            address:savedAddress ?savedAddress._id : null,
            createdBy:req.user.id
        });

        const customer = await newCustomer.save();

        const populatedCustomer = await customer.populate("address");
        return res.status(200).json({
            success:true,
            message:"New Customer created successfully",
            populatedCustomer,
        })

    } catch (error) {
        console.error("problem in creating new customer",error)
        // Handle duplicate phone number error
        if(error.code === 11000 && error.keyPattern && error.keyPattern.phoneNo) {
            return res.status(400).json({
                success: false,
                message: "Phone number already registered with another customer"
            });
        }
        return res.status(400).json({
            success:false,
            message:"problem in creating the new customer",
            error:error.message
        })
    }
}




// exports.updateCustomer = async(req,res)=>{
//     try {
//         const {id}= req.params;
//         const {firstName, lastName, email, address, phoneNo}= req.body;

//         const existingCustomer = await Customer.findById(id);

//         if(!existingCustomer){
//             return res.status(404).json({
//                 success:false,
//                 message:"Customer not found"
//             })
//         }

//         // Check email uniqueness if email is being updated
//         if(email && email !== existingCustomer.email) {
//             const trimmedEmail = email.trim();
//             const emailExists = await Customer.findOne({ email: trimmedEmail, _id: { $ne: id } });
//             if(emailExists) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Email already in use by another customer"
//                 });
//             }
//         }

//         // Check phone number uniqueness if phone number is being updated
//         if(phoneNo && phoneNo !== existingCustomer.phoneNo) {
//             const phoneExists = await Customer.findOne({ phoneNo, _id: { $ne: id } });
//             if(phoneExists) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Phone number already registered with another customer"
//                 });
//             }
//         }

//         const updateField = {};
//         if(firstName) updateField.firstName = firstName;
//         if(lastName) updateField.lastName = lastName;
//         if(email) updateField.email = email.trim();
//         if(phoneNo) updateField.phoneNo = phoneNo;

//         console.log("updateField",updateField);

//         // Update the address if provided
//         if (address) {
//             console.log("inside address field");
//             const existingAddress = await Address.findById(existingCustomer.address);
//             if (!existingAddress) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Address not found for the customer",
//                 });
//             }

//             // Update the address fields
//             if (address.street) existingAddress.street = address.street;
//             if (address.city) existingAddress.city = address.city;
//             if (address.state) existingAddress.state = address.state;
//             if (address.pincode) existingAddress.pincode = address.pincode;
//             if (address.additionalDetail) existingAddress.additionalDetail = address.additionalDetail;

//             // Save the updated address
//             await existingAddress.save();
//         }

//         const customer = await Customer.findByIdAndUpdate(id, {$set:updateField}, { new: true }).populate(
//             "address"
//         );

//         console.log("customer is:",customer)

//         return res.status(200).json({
//             success: true,
//             message: "Customer updated successfully",
//             customer,
//         });

//     } catch (error) {
//         console.error("Error updating customer", error);
//         // Handle duplicate phone number error
//         if(error.code === 11000 && error.keyPattern && error.keyPattern.phoneNo) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Phone number already registered with another customer"
//             });
//         }
//         return res.status(500).json({
//             success: false,
//             message: "Error updating customer",
//             error: error.message,
//         });
//     }
// }

//delete the customer


exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, address, phoneNo } = req.body;

        let existingCustomer = await Customer.findById(id);

        if (!existingCustomer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Check email uniqueness if email is being updated
        if (email && email !== existingCustomer.email) {
            const trimmedEmail = email.trim();
            const emailExists = await Customer.findOne({ email: trimmedEmail, _id: { $ne: id } });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use by another customer",
                });
            }
        }

        // Check phone number uniqueness if phone number is being updated
        if (phoneNo && phoneNo !== existingCustomer.phoneNo) {
            const phoneExists = await Customer.findOne({ phoneNo, _id: { $ne: id } });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number already registered with another customer",
                });
            }
        }

        // Update fields
        if (firstName) existingCustomer.firstName = firstName;
        if (lastName) existingCustomer.lastName = lastName;
        if (email) existingCustomer.email = email.trim();
        if (phoneNo) existingCustomer.phoneNo = phoneNo;

        console.log("Updated customer data before saving:", existingCustomer);

        // Save the updated customer (this triggers the pre-save hook)
        await existingCustomer.save();

        // Update the address if provided
        if (address) {
            console.log("inside address field");
            const existingAddress = await Address.findById(existingCustomer.address);
            if (!existingAddress) {
                return res.status(404).json({
                    success: false,
                    message: "Address not found for the customer",
                });
            }

            // Update the address fields
            if (address.street) existingAddress.street = address.street;
            if (address.city) existingAddress.city = address.city;
            if (address.state) existingAddress.state = address.state;
            if (address.pincode) existingAddress.pincode = address.pincode;
            if (address.additionalDetail) existingAddress.additionalDetail = address.additionalDetail;

            // Save the updated address
            await existingAddress.save();
        }

        return res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            customer: existingCustomer,
        });

    } catch (error) {
        console.error("Error updating customer", error);
        // Handle duplicate phone number error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.phoneNo) {
            return res.status(400).json({
                success: false,
                message: "Phone number already registered with another customer",
            });
        }
        return res.status(500).json({
            success: false,
            message: "Error updating customer",
            error: error.message,
        });
    }
};





exports.deleteCustomer = async(req,res)=>{
    try {
        const customer = await Customer.findById(req.params.id);
        
        if(!customer){
            return res.status(404).json({
                success:false,
                message:"customer not found with this id"
            })
        }

        // Check for existing orders more efficiently
        const hasOrders = await Order.exists({customer: req.params.id});
        if(hasOrders){
            return res.status(400).json({
                success:false,
                message:"cannot delete the customer with the existing order,please try to deactivate instead "
            });
        }

        if(customer.address){
            const address = await Address.findById(customer.address);
            console.log("address is:",address);

            if(address){
                await address.deleteOne();
                console.log("Address deleted successfully:",address);
            }

        }

        //delete the customer address
       

        await customer.deleteOne();

        return res.status(200).json({
            success:true,
            message:"customer and their address  removed successfully"
        })


        
    } catch (error) {
        console.log("error occured while removing customer:",error);
        return res.status(400).json({
            success:false,
            message:"problem in removing customer",
            error:error.message
        })
        
    }
}



exports.getCustomerOrders= async(req,res)=>{
    try {
        const orders= await Order.find({customer:req.params.id})
        .populate('customer','firstName lastName email')
        .populate('assignedTo','firstName lastName email')
        .populate('approvedBy','firstName lastName email')
        .populate('createdBy','firstName lastName email')

        if(!orders){
            return res.status(404).json({
                success:false,
                message:"No order found"
            })

        }
        return res.status(200).json({
            success:true,
            message:"All orders fetched successfully",
            orders,
        })

        
    } catch (error) {
        console.log("problem in fetching customer order");
        return res.status(400).json({
            success:false,
            message:"problem in fetchin customer order",
            error :error.message
        })
        
    }
}

exports.getAllCustomers = async(req,res)=>{
    try {
        const customers = await Customer.find()
            .populate('address')
            .populate('createdBy', 'firstName lastName email');

        return res.status(200).json({
            success: true,
            message: "All customers fetched successfully",
            customers
        });
    } catch (error) {
        console.error("Error fetching all customers:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching customers",
            error: error.message
        });
    }
}

