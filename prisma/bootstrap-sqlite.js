import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

dotenv.config();

function resolveSqlitePath(databaseUrl) {
    const fallback = 'file:./dev.db';
    const url = databaseUrl || fallback;

    if (!url.startsWith('file:')) {
        throw new Error('db:bootstrap solo soporta DATABASE_URL SQLite con prefijo file:.');
    }

    const rawPath = url.replace('file:', '');
    return path.resolve(process.cwd(), 'prisma', rawPath);
}

const dbPath = resolveSqlitePath(process.env.DATABASE_URL);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Business" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'ES',
  "locale" TEXT NOT NULL DEFAULT 'es-ES',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
  "serviceMode" TEXT NOT NULL DEFAULT 'pickup_only',
  "voiceGreeting" TEXT,
  "twilioLanguage" TEXT,
  "twilioVoice" TEXT,
  "deepgramSpeakModel" TEXT,
  "deepgramListenModel" TEXT,
  "deepgramLanguage" TEXT,
  "agentStyle" TEXT,
  "agentMaxResponseSentences" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" REAL NOT NULL,
  "metadata" TEXT,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Call" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "phone" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'twilio',
  "status" TEXT NOT NULL DEFAULT 'active',
  "transcript" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Call_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Call_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "callId" TEXT,
  "customerName" TEXT NOT NULL,
  "phone" TEXT,
  "summary" TEXT NOT NULL,
  "total" REAL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Order_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MenuItem_businessId_category_idx" ON "MenuItem" ("businessId", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_businessId_phone_key" ON "Customer" ("businessId", "phone");
CREATE INDEX IF NOT EXISTS "Call_businessId_status_idx" ON "Call" ("businessId", "status");
CREATE INDEX IF NOT EXISTS "Call_phone_idx" ON "Call" ("phone");
CREATE INDEX IF NOT EXISTS "Order_businessId_status_idx" ON "Order" ("businessId", "status");
CREATE INDEX IF NOT EXISTS "Order_phone_idx" ON "Order" ("phone");
`);

function addColumnIfMissing(tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    const exists = columns.some(column => column.name === columnName);

    if (!exists) {
        db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
    }
}

addColumnIfMissing('Business', 'voiceGreeting', 'TEXT');
addColumnIfMissing('Business', 'twilioLanguage', 'TEXT');
addColumnIfMissing('Business', 'twilioVoice', 'TEXT');
addColumnIfMissing('Business', 'deepgramSpeakModel', 'TEXT');
addColumnIfMissing('Business', 'deepgramListenModel', 'TEXT');
addColumnIfMissing('Business', 'deepgramLanguage', 'TEXT');
addColumnIfMissing('Business', 'agentStyle', 'TEXT');
addColumnIfMissing('Business', 'agentMaxResponseSentences', 'INTEGER');

db.close();
console.log(`SQLite bootstrap listo: ${dbPath}`);
