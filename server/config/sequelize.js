import { Sequelize } from "sequelize";

// Lazy initialization - create Sequelize instance when first needed
let sequelize = null;

const getSequelize = () => {
  if (!sequelize) {
    const databaseUrl = process.env.DATABASE_URL;

    sequelize = new Sequelize(databaseUrl, {
      dialect: "postgres",
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      dialectOptions: {
        ssl:
          process.env.DB_SSL === "true"
            ? {
                require: true,
                rejectUnauthorized: false,
              }
            : false,
      },
      pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });
  }
  return sequelize;
};

// Export a proxy that lazily initializes Sequelize
export default new Proxy(
  {},
  {
    get: (target, prop) => {
      const instance = getSequelize();
      const value = instance[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  }
);
