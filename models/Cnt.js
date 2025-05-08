const mongoose = require("mongoose");

const cntSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true 
    },
    seq: { 
        type: Number, 
        default: 1 
    },
});

module.exports = mongoose.model("Cnt", cntSchema);