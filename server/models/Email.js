import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import User from "./User.js";

const Email = sequelize.define(
  "Email",
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
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "message_id",
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fromEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "from_email",
    },
    fromName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "from_name",
    },
    toEmails: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      field: "to_emails",
    },
    bodyText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "body_text",
    },
    bodyHtml: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "body_html",
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    labels: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
    },
    embedding: {
      type: DataTypes.TEXT, // We'll store as text and handle vector conversion in queries
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "emails",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Define associations
Email.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Email, { foreignKey: "user_id", as: "emails" });

export default Email;
