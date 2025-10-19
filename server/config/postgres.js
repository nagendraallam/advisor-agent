import pg from "pg";
const { Pool } = pg;

let pool = null;

export const getPool = () => {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    console.log(databaseUrl);
    if (databaseUrl) {
      pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      pool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
      });
    }

    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  return pool;
};

export const connectDB = async () => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    console.log("✅ PostgreSQL Connected");

    // Test the connection
    const result = await client.query("SELECT NOW()");
    console.log(`📦 Database timestamp: ${result.rows[0].now}`);

    client.release();
    return pool;
  } catch (error) {
    console.error("❌ PostgreSQL Connection Error:", error.message);
    console.log(
      "💡 Make sure PostgreSQL is running and credentials are correct in .env"
    );
    throw error;
  }
};

export const query = async (text, params) => {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log("Executed query", { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error("Query error:", error);
    throw error;
  }
};

export default { getPool, connectDB, query };
