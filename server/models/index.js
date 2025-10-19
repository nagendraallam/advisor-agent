import User from "./User.js";
import Email from "./Email.js";
import Contact from "./Contact.js";
import Note from "./Note.js";
import ChatMessage from "./ChatMessage.js";
import SyncStatus from "./SyncStatus.js";
import Chat from "./Chat.js";
import OngoingTask from "./OngoingTask.js";

// Set up associations
Chat.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Chat, { foreignKey: "user_id", as: "chats" });

Chat.hasMany(ChatMessage, { foreignKey: "chat_id", as: "messages" });
ChatMessage.belongsTo(Chat, { foreignKey: "chat_id", as: "chat" });

Chat.hasMany(OngoingTask, { foreignKey: "chat_id", as: "tasks" });
OngoingTask.belongsTo(Chat, { foreignKey: "chat_id", as: "chat" });

OngoingTask.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(OngoingTask, { foreignKey: "user_id", as: "tasks" });

// Export all models
export {
  User,
  Email,
  Contact,
  Note,
  ChatMessage,
  SyncStatus,
  Chat,
  OngoingTask,
};

export default {
  User,
  Email,
  Contact,
  Note,
  ChatMessage,
  SyncStatus,
  Chat,
  OngoingTask,
};
