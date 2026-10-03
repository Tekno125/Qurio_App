import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../src/config/database/connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "..", "src", "db", "migrations");

async function ensureMigrationTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function runMigrations() {
    await ensureMigrationTable();

    const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of files) {
        const migrationName = file;
        const existingMigration = await pool.query(
            "SELECT 1 FROM _migrations WHERE name = $1",
            [migrationName],
        );

        if (existingMigration.rows.length > 0) {
            console.log(`⏭️  Migrasi ${migrationName} sudah dijalankan.`);
            continue;
        }

        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        try {
            await pool.query(sql);
            await pool.query(
                "INSERT INTO _migrations (name) VALUES ($1)",
                [migrationName],
            );
            console.log(`✅ Migrasi ${migrationName} berhasil dijalankan.`);
        } catch (error) {
            console.error(`❌ Gagal menjalankan migrasi ${migrationName}:`, error.message);
            throw error;
        }
    }

    console.log("🚀 Semua migrasi selesai dijalankan.");
}

runMigrations()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Proses migrasi gagal.", error.message);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
