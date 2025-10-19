import sequelize from "./sequelize.js";
import { connectDB as connectPostgres } from "./postgres.js";

export const connectDB = async () => {
  try {
    // Connect using raw pg pool
    await connectPostgres();

    // Test Sequelize connection
    await sequelize.authenticate();
    console.log("✅ Sequelize connection established successfully");

    return sequelize;
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    console.log(
      "💡 Make sure PostgreSQL is running and credentials are correct in .env"
    );
    throw error;
  }
};

export default connectDB;
