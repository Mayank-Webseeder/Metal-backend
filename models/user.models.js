const mongoose= require("mongoose");

const userSchema = new mongoose.Schema({
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
    },  // Store full name in DB
    email: { 
        type: String, 
        required: true, 
        trim: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    accountType: {
        type: String,
        enum: ["Admin", "SuperAdmin", "Graphics", "Accounts", "Display"],
        required: true,
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    created: {
        type: String,
        required: true,
        default: () => new Date().toISOString().split("T")[0], // "YYYY-MM-DD"
    }
});

// Pre-save hook to generate and store 'name'
userSchema.pre("save", function (next) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
    next();
});

module.exports = mongoose.model("User", userSchema);
