const Notification = require("../models/notification.model");

exports.fetchAllNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    const limit = parseInt(req.query.limit) || 10; // Default limit to 10 if not provided

    const notifications = await Notification.find({ userId: userId })
      .sort({ createdAt: -1 }) // Descending order
      .limit(limit);

      console.log("notification is :",notifications);

    return res.status(200).json({
      success: true,
      notifications,
    });

  } catch (error) {
    console.log("Error in fetching notification:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
