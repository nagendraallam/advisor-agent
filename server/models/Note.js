import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import User from "./User.js";
import Contact from "./Contact.js";

const Note = sequelize.define(
  "Note",
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
      unique: true,
      field: "hubspot_id",
    },
    contactId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "contact_id",
      references: {
        model: "contacts",
        key: "id",
      },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    embedding: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "notes",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Define associations
Note.belongsTo(User, { foreignKey: "user_id", as: "user" });
Note.belongsTo(Contact, { foreignKey: "contact_id", as: "contact" });
User.hasMany(Note, { foreignKey: "user_id", as: "notes" });
Contact.hasMany(Note, { foreignKey: "contact_id", as: "notes" });

export default Note;
