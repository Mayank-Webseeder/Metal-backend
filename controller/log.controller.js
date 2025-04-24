const Log = require("../models/log.model");

exports.getAllLog = async (req, res) => {
  try {
    const { orderId } = req.params;
    const allLog = await Log.find({
      orderId,
    });


    if (allLog.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No logs found for this order ID",
      });
    }

    console.log("allLog is", allLog);

    return res.status(200).json({
      success: true,
      message: "All logs have been fetched successfully",
      allLog,
    });

  } catch (error) {
    console.error("Error in fetching logs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching logs",
      error: error.message,
    });
  }
};
