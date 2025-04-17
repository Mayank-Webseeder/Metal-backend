const { userSocketIDs }= require("../middlewares/auth");
exports.getSockets = (users = []) => {
  console.log("hello",userSocketIDs);
  
    const sockets = users.map((user) => userSocketIDs.get(user.toString()));
    return sockets;
  };