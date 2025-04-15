const mongoose= require("mongoose");
const leadSchema= new mongoose.Schema({
    firstName: { 
        type: String, 
        required: true 
    },
    lastName: { 
        type: String, 
        required: true 
    },
    name: { 
        type: String 
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:true,

    },
    status:{
        type:String,
        enum:["New","Contacted","Converted","Lost"],
        default:"New"


    },
    descriptions:{
        type:String
    }

},{timestamps:true});

leadSchema.pre("save", function (next) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
    next();
});

module.exports= mongoose.model("Lead",leadSchema);