const mongoose = require("mongoose");

const workQueueSchema = new mongoose.Schema({
    order: {
        type: mongoose.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    status: {
        type: String,
        enum: [
            "Pending", 
            "InProgress", 
            "Completed", 
            "Failed", 
            "Paused"
        ],
        default: "Pending"
    },
    assignedTo: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        
    },
    processingSteps: [{
        stepName: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "InProgress", "Completed", "Failed"],
            default: "Pending"
        },
        startedAt: Date,
        completedAt: Date,
        assignedTo: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    }],
    startedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    estimatedCompletionTime: {
        type: Date
    },
    retryCount: {
        type: Number,
        default: 0,
        max: 3
    },
    errorLog: [{
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { 
    timestamps: true 
});

// Middleware to update order status when work queue status changes
workQueueSchema.pre('save', async function(next) {
    try {
        // Only run if status has changed
        if (this.isModified('status')) {
            const order = await mongoose.model('Order').findById(this.order);
            
            if (order) {
                // Map work queue status to order status
                const statusMapping = {
                    "Pending": "InWorkQueue",
                    "InProgress": "InProgress",
                    "Completed": "Completed",
                    "Failed": "New",
                    "Paused": "Assigned"
                };

                order.status = statusMapping[this.status] || order.status;
                await order.save();
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Virtual to check if the work queue item is overdue
workQueueSchema.virtual('isOverdue').get(function() {
    return this.estimatedCompletionTime && 
           this.estimatedCompletionTime < new Date() && 
           this.status !== 'Completed';
});

// Method to log errors
workQueueSchema.methods.logError = function(errorMessage) {
    this.errorLog.push({ message: errorMessage });
    this.retryCount += 1;
    
    if (this.retryCount >= 3) {
        this.status = 'Failed';
    }
};

// Static method to find next pending item
workQueueSchema.statics.findNextPendingItem = function() {
    return this.findOne({ 
        status: 'Pending' 
    })
    .sort({ 
        priority: -1,  // Higher priority first
        createdAt: 1   // Oldest items first
    })
    .populate('order')
    .populate('assignedTo');
};


module.exports = mongoose.model("WorkQueue",workQueueSchema);