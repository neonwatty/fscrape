import Database from "better-sqlite3";
import { MigrationManager } from "./src/database/migrations.js";
import fs from "fs";
import path from "path";

async function test() {
  const db = new Database(":memory:");
  console.log("Database created");
  
  // Load schema directly
  const schemaPath = path.join(process.cwd(), "src/database/schema.sql");
  console.log("Looking for schema at:", schemaPath);
  console.log("Schema.sql exists?", fs.existsSync(schemaPath));
  
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, "utf-8");
    console.log("Schema file length:", sql.length);
    console.log("First 200 chars:", sql.substring(0, 200));
  }
  
  const manager = new MigrationManager(db);
  manager.loadSchemaFromFile(schemaPath);
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log("Tables created:", tables);
  
  db.close();
}

test().catch(console.error);