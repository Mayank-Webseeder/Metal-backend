const express = require("express");
const app = express();
const database = require("./config/database");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const { Server } = require("socket.io");
const { createServer } = require("http");
const { socketAuthenticator } = require("./middlewares/auth.js");
const socketManager = require("./middlewares/socketmanager.js"); 

dotenv.config();
const PORT = process.env.PORT || 3000;
const corsOptions = {
  origin: [
    process.env.CLIENT_URL,
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
app.set("io", io);
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp",
  })
);

database.connectWithDb();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const designerRoutes = require("./routes/designer.routes");
const superAdminRoutes = require("./routes/superAdmin.routes");
const accountRoutes = require("./routes/account.routes");

app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/sa", superAdminRoutes);
app.use("/api/v1/d", designerRoutes);
app.use("/api/v1/ac", accountRoutes);

app.get("/", (req, res) => {
  return res.json({ message: "Your server is up and running" });
});

// Socket handling
io.use(socketAuthenticator);

io.on("connection", (socket) => {
  try {
    console.log("Socket connected with ID:", socket.id);
    
    if (!socket.user) {
      console.log("Warning: Socket connected but no user data attached");
      return;
    }
    
    const user = socket.user;
    console.log("User connected:", user._id.toString());
    
    // Save the socket ID in our central manager
    socketManager.setUserSocket(user._id.toString(), socket.id);
    
    // Test message
    socket.emit("welcome", `Welcome, ${user.firstName}! You are connected.`);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${user._id} disconnected`);
      socketManager.removeUserSocket(user._id.toString());
    });
  } catch (error) {
    console.error("Error in socket connection handler:", error);
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export socket manager for use in other files
module.exports = { socketManager };