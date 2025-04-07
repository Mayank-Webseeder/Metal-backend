// socketManager.js
const userSocketIDs = new Map();

const socketManager = {
  userSocketIDs,
  
  setUserSocket(userId, socketId) {
    console.log(`Setting socket mapping: ${userId} -> ${socketId}`);
    this.userSocketIDs.set(userId, socketId);
    this.logConnections();
  },
  
  removeUserSocket(userId) {
    console.log(`Removing socket for user: ${userId}`);
    this.userSocketIDs.delete(userId);
    this.logConnections();
  },
  
  getUserSocket(userId) {
    return this.userSocketIDs.get(userId);
  },
  
  getMultipleUserSockets(userIds = []) {
    return userIds.map(userId => this.getUserSocket(userId)).filter(Boolean);
  },
  
  logConnections() {
    console.log(`Active connections: ${this.userSocketIDs.size}`);
    this.userSocketIDs.forEach((socketId, userId) => {
      console.log(`- User ${userId} connected with socket ${socketId}`);
    });
  }
};

module.exports = socketManager;