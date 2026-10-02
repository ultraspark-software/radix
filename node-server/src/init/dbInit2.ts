/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: database schema installation and initialization.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import mysql, { RowDataPacket } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load default env (installer may re-load a different .env later)
dotenv.config();

const schemaVersion = '1.0.0';

function stripSeedData(sql: string): string {
  return sql
    .replace(/\/\*Data for the table.*?\*\/\s*/gis, '')
    .replace(/insert\s+into\s+`?[\w-]+`?\s*\([^;]*?\)\s*values\s*[\s\S]*?;/gi, '');
}

function normalizeSchemaSql(sql: string, databaseName: string): string {
  const safeDbName = databaseName.replace(/`/g, '``');
  return sql
    .replace(/CREATE\s+DATABASE\s+(?:\/\*\!32312\s+IF NOT EXISTS\*\/)?`?[A-Za-z0-9_]+`?/gi, `CREATE DATABASE IF NOT EXISTS \`${safeDbName}\``)
    .replace(/USE\s+`?[A-Za-z0-9_]+`?/gi, `USE \`${safeDbName}\``)
    .replace(/`radix`/gi, `\`${safeDbName}\``);
}

async function ensureSchemaMarker(conn: mysql.Connection, dbName: string): Promise<void> {
  const escapedDbName = dbName.replace(/`/g, '``');
  await conn.query(`USE \`${escapedDbName}\``);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key_name VARCHAR(100) NOT NULL,
      value_text VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (key_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(
    `INSERT INTO schema_meta (key_name, value_text)
     VALUES ('db_initialized', '1'), ('schema_version', ?)
     ON DUPLICATE KEY UPDATE value_text = VALUES(value_text), updated_at = CURRENT_TIMESTAMP`,
    [schemaVersion]
  );
}

function extractCreateTableStatements(sql: string): { name: string; statement: string }[] {
  const out: { name: string; statement: string }[] = [];
  const re = /CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*\([\s\S]*?\)[\s\S]*?;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ name: m[1], statement: m[0] });
  }
  return out;
}

async function seedDefaultContent(dbConn: mysql.Connection, dbName: string): Promise<void> {
  const pageRows = [
    {
      title: 'Home',
      slug: 'home',
      content: '<h1>Hello World!</h1><p>Welcome to my lightweight Node.js CMS.</p>',
      template_name: 'default',
      status: 'Published',
      min_role: 'Unregistered',
      publish_at: '2026-08-31 00:00:00'
    },
    {
      title: 'About',
      slug: 'about',
      content: '<h1>About Our System</h1><p>This page is completely dynamic.</p>',
      template_name: 'default',
      status: 'Published',
      min_role: 'Unregistered',
      publish_at: '2026-08-31 00:00:00'
    }
  ];

  for (const page of pageRows) {
    await dbConn.execute(
      `INSERT INTO pages (title, slug, content, template_name, status, min_role, publish_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         content = VALUES(content),
         template_name = VALUES(template_name),
         status = VALUES(status),
         min_role = VALUES(min_role),
         publish_at = VALUES(publish_at)`,
      [page.title, page.slug, page.content, page.template_name, page.status, page.min_role, page.publish_at]
    );
  }

  const defaultSettings = [
    ['app_name', process.env.APP_NAME || 'Radix'],
    ['app_version', process.env.APP_VERSION || '0.11.0'],
    ['site_title', process.env.APP_NAME || 'Radix'],
    ['search_engine_visibility', '1'],
    ['mail_from', 'noreply@example.com'],
    ['mail_host', process.env.MAIL_HOST || ''],
    ['mail_port', process.env.MAIL_PORT || '25'],
    ['mail_secure', process.env.MAIL_SECURE || '0'],
    ['mail_user', process.env.MAIL_USER || ''],
    ['mail_pass', process.env.MAIL_PASS || ''],
    ['site_logo', '']
  ];

  for (const [key, value] of defaultSettings) {
    await dbConn.execute(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, value]
    );
  }

  console.log(`Seeded default content for database "${dbName}".`);
}

export async function installDatabase(connectionConfig: any, dbName: string, schemaSql?: string): Promise<void> {
  const sqlPath = path.join(__dirname, '../sql/radix.sql');
  if (!schemaSql) {
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }
    const rawSql = fs.readFileSync(sqlPath, 'utf8');
    schemaSql = stripSeedData(rawSql);
  }
  schemaSql = normalizeSchemaSql(schemaSql, dbName);

  connectionConfig = {
    ...connectionConfig,
    multipleStatements: true,
    connectTimeout: connectionConfig.connectTimeout || 5000
  };

  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection(connectionConfig);

    const [rows] = await conn.query<RowDataPacket[]>('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [dbName]);

    if (rows.length > 0) {
      const dbConn = await mysql.createConnection({ ...connectionConfig, database: dbName });
      try {
        await ensureSchemaMarker(dbConn, dbName);
        console.log(`Database "${dbName}" already exists. Ensuring required tables exist.`);

        const createTables = extractCreateTableStatements(schemaSql);
        for (const tbl of createTables) {
          const [trows] = await dbConn.query<RowDataPacket[]>(
            'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
            [dbName, tbl.name]
          );

          if (!trows || (Array.isArray(trows) && trows.length === 0)) {
            console.log(`Creating missing table: ${tbl.name}`);
            await dbConn.query(tbl.statement);
          }
        }

        await seedDefaultContent(dbConn, dbName);
        console.log(`Database "${dbName}" checked and missing tables created.`);
      } finally {
        await dbConn.end();
      }
      return;
    }

    await conn.query(schemaSql);
    await ensureSchemaMarker(conn, dbName);
    const dbConn = await mysql.createConnection({ ...connectionConfig, database: dbName });
    try {
      await seedDefaultContent(dbConn, dbName);
    } finally {
      await dbConn.end();
    }
    console.log(`Created database "${dbName}" and applied schema.`);
  } finally {
    if (conn) {
      try { await conn.end(); } catch (e) { /* ignore */ }
    }
  }
}

export async function initDatabase(): Promise<void> {
  const sqlPath = path.join(__dirname, '../sql/radix.sql');
  if (!fs.existsSync(sqlPath)) {
    console.warn(`SQL file not found at ${sqlPath}, skipping DB initialization.`);
    return;
  }

  const rawSql = fs.readFileSync(sqlPath, 'utf8');
  const schemaSql = normalizeSchemaSql(stripSeedData(rawSql), process.env.DB_NAME || 'radix');

  const databaseName = process.env.DB_NAME || 'radix';

  const connectionConfig: any = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
    multipleStatements: true,
    connectTimeout: 5000
  };

  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection(connectionConfig);

    const [rows] = await conn.query<RowDataPacket[]>('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [databaseName]);

    if (rows.length > 0) {
      const dbConn = await mysql.createConnection({ ...connectionConfig, database: databaseName });
      try {
        await ensureSchemaMarker(dbConn, databaseName);
        console.log(`Database "${databaseName}" already exists. Schema marker is ready.`);

        const createTables = extractCreateTableStatements(schemaSql);
        for (const tbl of createTables) {
          const [trows] = await dbConn.query<RowDataPacket[]>(
            'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
            [databaseName, tbl.name]
          );

          if (!trows || (Array.isArray(trows) && trows.length === 0)) {
            console.log(`Creating missing table: ${tbl.name}`);
            await dbConn.query(tbl.statement);
          }
        }

        await seedDefaultContent(dbConn, databaseName);
        console.log(`Database "${databaseName}" checked and missing tables created.`);
      } finally {
        await dbConn.end();
      }
      return;
    }

    console.log(`Database "${databaseName}" not found. Creating empty schema from ${sqlPath}`);
    await conn.query(schemaSql);
    await ensureSchemaMarker(conn, databaseName);
    const dbConn = await mysql.createConnection({ ...connectionConfig, database: databaseName });
    try {
      await seedDefaultContent(dbConn, databaseName);
    } finally {
      await dbConn.end();
    }
    console.log('Database initialization finished.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  } finally {
    if (conn) {
      try { await conn.end(); } catch (e) { /* ignore */ }
    }
  }
}
