/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: database connection pool and query helpers.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load env now; installer may re-load dotenv later when writing .env
dotenv.config();

let pool: mysql.Pool | null = null;
let lastConfigKey = '';

function makeConfigKey() {
  return `${process.env.DB_HOST || ''}:${process.env.DB_PORT || ''}|${process.env.DB_USER || ''}|${process.env.DB_NAME || ''}`;
}

async function ensurePool(): Promise<mysql.Pool> {
  const key = makeConfigKey();
  if (pool && key === lastConfigKey) return pool;

  // close existing pool if config changed
  if (pool) {
    try { await pool.end(); } catch (e) { /* ignore */ }
    pool = null;
  }

  console.log(`[DB Pool] Creating pool for ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306} (user=${process.env.DB_USER || 'unknown'})`);

  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000
  });

  lastConfigKey = key;
  return pool;
}

export default {
  async execute<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
    const p = await ensurePool();
    // mysql2's execute has its own stricter generic constraints; cast the result to preserve caller generics
    const res = await p.execute(sql, params) as unknown as [T, any];
    return res;
  },
  async query<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
    const p = await ensurePool();
    const res = await p.query(sql, params) as unknown as [T, any];
    return res;
  },
  async getConnection() {
    const p = await ensurePool();
    return p.getConnection();
  }
};