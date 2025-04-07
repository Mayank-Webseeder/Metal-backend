const mongoose= require("mongoose");
const customerSchema = new mongoose.Schema({
    firstName:{
        type:String,
        required:true
    },
    lastName:{
        type:String,
        required:true
    },
    name:{
        type:String,
    },
    phoneNo:{
        type:String,
        required:true,
        unique: true
    },
    email:{
        type:String,
        required:true,
        trim:true
    },
    password:{
        type:String,
    },
    createdBy:{
        type:String,
        default:null
    },
    address:{
        type:mongoose.Types.ObjectId,
        ref:'Address'
    },
    order:{
        type:mongoose.Types.ObjectId,
        ref:'Order'
    }
},{timestamps:true});


// Pre-save hook to generate and store 'name'
customerSchema.pre("save", function (next) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
    next();
});

module.exports= mongoose.model('Customer',customerSchema);