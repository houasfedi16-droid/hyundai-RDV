const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const schemaPath = path.join(__dirname, "..", "schema.sql");
const database = process.env.DB_NAME;

if (!database) {
  console.error("Missing DB_NAME in backend/.env");
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT) || 3306,
    multipleStatements: true,
  });

  const schema = fs
    .readFileSync(schemaPath, "utf8")
    .replace(/CREATE DATABASE IF NOT EXISTS\s+`?[\w-]+`?/i, `CREATE DATABASE IF NOT EXISTS \`${database}\``)
    .replace(/USE\s+`?[\w-]+`?\s*;/i, `USE \`${database}\`;`);

  await connection.query(`DROP DATABASE IF EXISTS \`${database}\`;`);
  await connection.query(schema);
  await connection.end();

  console.log(`Database recreated: ${database}`);
}

main().catch((error) => {
  console.error("Database recreation failed:", error.message);
  process.exit(1);
});
