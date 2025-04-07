const { userSocketIDs }= require("../middlewares/auth");
exports.getSockets = (users = []) => {
  console.log("hello",userSocketIDs);
  console.log("hola",users);
    const sockets = users.map((user) => userSocketIDs.get(user.toString()));
    return sockets;
  };