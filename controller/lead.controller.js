// const Lead = require("../models/lead.model");
// const Customer = require("../models/customer.model");


// exports.createLead = async (req, res) => {
//     try {
//         const { firstName, lastName, email, phone, descriptions } = req.body;

//         if (!firstName || !lastName || !email || !phone) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All fields are mandatory"
//             });
//         }

//         //check if lead exist with the same email or not
//         const existingLead = await Lead.findOne({ email });
//         if (existingLead) {
//             return res.status(400).json({
//                 success: false,
//                 message: "A lead with this email id already exist"
//             });
//         }

//         //create a new lead 
//         const newLead = new Lead({
//             firstName,
//             lastName,
//             email,
//             phone,
//             descriptions,
//         });

//         //save the new lead to the database
//         const savedLead = await newLead.save();
//         const verifyLead = await Lead.findOne({ email });


//         //return success response
//         return res.status(201).json({
//             success: true,
//             message: "New lead created successfully",
//             data: savedLead
//         })


//     } catch (error) {
//         return res.status(400).json({
//             success: false,
//             message: "error occured in creating new lead",
//             error: error.message,
//         })

//     }
// }

// exports.updateLead = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { firstName, lastName, phone, descriptions, status, email } = req.body;

//         //find the lead and update the lead
//         const lead = await Lead.findById(id);
//         if (!lead) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Lead not found "
//             })
//         }

//         if (firstName) lead.firstName = firstName;
//         if (lastName) lead.lastName = lastName;
//         if (phone) lead.phone = phone;
//         if (descriptions) lead.descriptions = descriptions;
//         if (status) lead.status = status;
//         if (email) lead.email = email;

//         //save the updated details
//         const updatedLead = await lead.save();

//         //return success response
//         return res.status(200).json({
//             success: true,
//             message: "Lead has been updated successfully",
//             data: updatedLead
//         })

//     } catch (error) {
//         console.log("Error in updating the lead");
//         return res.status(400).json({
//             success: false,
//             message: "Error in updating the lead",
//             error: error.message
//         })

//     }
// }


// exports.deleteLead = async (req, res) => {
//     try {
//         const { id } = req.params;

//         //check lead exists or not
//         const existingLead = await Lead.findById(id);
//         if (!existingLead) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Lead not found"
//             })
//         }
//         //delete the lead
//         await Lead.deleteOne({ _id: id });

//         //return success response
//         return res.status(200).json({
//             success: true,
//             message: "Lead deleted successfully"
//         });


//     } catch (error) {
//         console.error("Error in deleting the lead", error);

//         return res.status(400).json({
//             success: false,
//             message: "Error occured in deleting the lead",
//             error: error.message
//         })

//     }
// }

// exports.convertToCustomer = async (req, res) => {
//     try {
//         const { id } = req.params
//         const lead = await Lead.findById(id);
//         if (!lead) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Lead not found"
//             })
//         }

//         //create a new customer from lead data
//         const newCustomer = new Customer({
//             firstName: lead.firstName,
//             lastName: lead.lastName,
//             email: lead.email,
//             phoneNo: lead.phone,
//             createdBy: req.user.id
//         });

//         const customer = await newCustomer.save();

//         lead.status = 'Converted';
//         await lead.save();

//         return res.status(200).json({
//             success: true,
//             message: "Converted into customer",
//             customer,
//             lead
//         })

//     } catch (error) {
//         console.error("Error in converting customer to lead", error);
//         return res.status(400).json({
//             success: false,
//             message: "Problem in converting lead to customer",
//             error: error.message
//         })
//     }
// }

// exports.getAllLeads = async (req, res) => {
//     try {
//         const leads = await Lead.find({ status: { $ne: "Converted" } });

//         return res.status(200).json({
//             success: true,
//             message: "All leads fetched successfully",
//             data: leads
//         });

//     } catch (error) {
//         console.error("Error fetching leads:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to fetch leads",
//             error: error.message
//         });
//     }
// };

const Lead = require("../models/lead.model");
const Customer = require("../models/customer.model");
const Address = require("../models/Address.model");

exports.createLead = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, descriptions } = req.body;

        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: "All fields are mandatory"
            });
        }

        //check if lead exist with the same email or not
        const existingLead = await Lead.findOne({ email });
        if (existingLead) {
            return res.status(400).json({
                success: false,
                message: "A lead with this email id already exist"
            });
        }

        //create a new lead 
        const newLead = new Lead({
            firstName,
            lastName,
            email,
            phone,
            descriptions,
        });

        //save the new lead to the database
        const savedLead = await newLead.save();

        //return success response
        return res.status(201).json({
            success: true,
            message: "New lead created successfully",
            data: savedLead
        })

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "error occured in creating new lead",
            error: error.message,
        })
    }
}

exports.updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, descriptions, status, email } = req.body;

        //find the lead and update the lead
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found "
            })
        }

        if (firstName) lead.firstName = firstName;
        if (lastName) lead.lastName = lastName;
        if (phone) lead.phone = phone;
        if (descriptions) lead.descriptions = descriptions;
        if (status) lead.status = status;
        if (email) lead.email = email;

        //save the updated details
        const updatedLead = await lead.save();

        //return success response
        return res.status(200).json({
            success: true,
            message: "Lead has been updated successfully",
            data: updatedLead
        })

    } catch (error) {
        console.log("Error in updating the lead");
        return res.status(400).json({
            success: false,
            message: "Error in updating the lead",
            error: error.message
        })
    }
}

exports.deleteLead = async (req, res) => {
    try {
        const { id } = req.params;

        //check lead exists or not
        const existingLead = await Lead.findById(id);
        if (!existingLead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            })
        }
        //delete the lead
        await Lead.deleteOne({ _id: id });

        //return success response
        return res.status(200).json({
            success: true,
            message: "Lead deleted successfully"
        });

    } catch (error) {
        console.error("Error in deleting the lead", error);

        return res.status(400).json({
            success: false,
            message: "Error occured in deleting the lead",
            error: error.message
        })
    }
}

exports.convertToCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await Lead.findById(id);
        
        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        // Create a default address with required fields
        const defaultAddress = new Address({
            street: "Default Street",
            city: "Default City",
            state: "Default State",
            pincode: "000000",
            additionalDetail: "Created during lead conversion"
        });
        
        const savedAddress = await defaultAddress.save();

        // Create a new customer from lead data with the address
        const newCustomer = new Customer({
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            phoneNo: lead.phone,
            address: savedAddress._id, // Link the new address
            createdBy: req.user.id
        });

        const customer = await newCustomer.save();

        // Update lead status to 'Converted'
        lead.status = 'Converted';
        await lead.save();

        // Retrieve the populated customer for the response
        const populatedCustomer = await Customer.findById(customer._id).populate("address");

        return res.status(200).json({
            success: true,
            message: "Converted into customer",
            customer: populatedCustomer,
            lead
        });

    } catch (error) {
        console.error("Error in converting lead to customer", error);
        return res.status(400).json({
            success: false,
            message: "Problem in converting lead to customer",
            error: error.message
        });
    }
}

exports.getAllLeads = async (req, res) => {
    try {
        const leads = await Lead.find({ status: { $ne: "Converted" } });

        return res.status(200).json({
            success: true,
            message: "All leads fetched successfully",
            data: leads
        });

    } catch (error) {
        console.error("Error fetching leads:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch leads",
            error: error.message
        });
    }
};