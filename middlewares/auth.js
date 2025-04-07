const jwt = require("jsonwebtoken");
const userModel = require("../models/user.models.js");

const socketAuthenticator = async (socket, next) => {
  try {
    console.log("Socket authentication starting");
    const authToken = socket.handshake.auth.token;
    
    if (!authToken) {
      console.log("No auth token provided");
      return next(new Error("Please login to access this route"));
    }

    try {
      console.log("Verifying token");
      const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
      
      // Important: Your token has "id" not "_id"
      const userId = decodedData.id; // Change from _id to id
      
      if (!userId) {
        console.log("No user ID in token");
        return next(new Error("Invalid token format"));
      }
      
      console.log("Finding user with ID:", userId);
      const user = await userModel.findById(userId);
      
      if (!user) {
        console.log("User not found in database");
        return next(new Error("User not found"));
      }
      
      // Attach user to socket
      socket.user = user;
      console.log("Authentication successful for user:", user._id);
      return next(); // Important: Make sure this is called
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError);
      return next(new Error("Authentication failed"));
    }
  } catch (error) {
    console.error("Socket authentication error:", error);
    return next(new Error("Authentication error"));
  }
};

module.exports = { socketAuthenticator };