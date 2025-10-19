import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import User from "./User.js";

const SyncStatus = sequelize.define(
  "SyncStatus",
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
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [["gmail", "hubspot"]],
      },
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_sync_at",
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        isIn: [["success", "error", "in_progress"]],
      },
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "error_message",
    },
  },
  {
    tableName: "sync_status",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "source"],
      },
    ],
  }
);

// Define associations
SyncStatus.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(SyncStatus, { foreignKey: "user_id", as: "syncStatuses" });

export default SyncStatus;
