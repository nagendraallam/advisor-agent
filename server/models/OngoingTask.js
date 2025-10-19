import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const OngoingTask = sequelize.define(
  "OngoingTask",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    chatId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "chat_id",
      references: {
        model: "chats",
        key: "id",
      },
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
    taskType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "email_response",
      field: "task_type",
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "waiting",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expectedSenderEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "expected_sender_email",
    },
    expectedSenderName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "expected_sender_name",
    },
    relatedEmailId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "related_email_id",
      references: {
        model: "emails",
        key: "id",
      },
    },
    context: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "completed_at",
    },
  },
  {
    tableName: "ongoing_tasks",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default OngoingTask;
