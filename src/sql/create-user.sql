const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

(async () => {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'dbuser';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'radix';
  const port = Number(process.env.DB_PORT) || 3306;
  const hash = await bcrypt.hash('admin123', 10);

  const conn = await mysql.createConnection({ host, user, password, database, port, connectTimeout: 5000 });
  try {
    await conn.execute(
      `INSERT INTO users (username, password, full_name, password_hash, email, role, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         password_hash = VALUES(password_hash),
         email = VALUES(email),
         role = VALUES(role)`,
      ['admin', 'Admin User', hash, 'admin@local.test', 'Administrator']
    );
    const [rows] = await conn.execute('SELECT id, username, email, role, password_hash FROM users WHERE username = ?', ['admin']);
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await conn.end();
  }
})();