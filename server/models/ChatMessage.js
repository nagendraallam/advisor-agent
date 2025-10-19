import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import User from "./User.js";

const ChatMessage = sequelize.define(
  "ChatMessage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    chatId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for backward compatibility
      field: "chat_id",
      references: {
        model: "chats",
        key: "id",
      },
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [["user", "assistant"]],
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    context: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "chat_messages",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

// Define associations
ChatMessage.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(ChatMessage, { foreignKey: "user_id", as: "chatMessages" });

export default ChatMessage;
