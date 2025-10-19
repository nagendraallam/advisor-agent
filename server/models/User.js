import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "google_id",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    googleAccessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "google_access_token",
    },
    googleRefreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "google_refresh_token",
    },
    hubspotAccessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "hubspot_access_token",
    },
    hubspotRefreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "hubspot_refresh_token",
    },
    hubspotConnected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "hubspot_connected",
    },
    hubspotPortalId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "hubspot_portal_id",
    },
  },
  {
    tableName: "users",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default User;
