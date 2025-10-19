import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import User from "./User.js";

const Contact = sequelize.define(
  "Contact",
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
    hubspotId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "hubspot_id",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    properties: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    embedding: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "contacts",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "hubspot_id"],
      },
    ],
  }
);

// Define associations
Contact.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Contact, { foreignKey: "user_id", as: "contacts" });

export default Contact;
