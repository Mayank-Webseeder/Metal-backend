const mongoose = require("mongoose")
require('dotenv').config();

exports.connectWithDb=()=>{
    mongoose.connect(process.env.MONGODB_URL,{
        useNewUrlParser:true,
        useUnifiedTopology:true,
    }).then(()=>{
        console.log("DB connected successfully")
    })

.catch((error)=>{
    console.log("error in db connection");
    console.error(error);
    process.exit(1);
})
};