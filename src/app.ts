#!/usr/bin/env node
/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: application startup, middleware, and route configuration.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import express, { Application } from 'express';
import session from 'express-session';
import path from 'path';

// Import Routers
import adminRoutes from './routes/admin';
import indexRoutes from './routes/index';
import { initDatabase } from './init/dbInit2';

import { getSettings } from './utils/settings';
``
const app: Application = express();
const PORT = process.env.SITE_PORT || 3000;

let app_name: string = process.env.APP_NAME || 'Radix';
let app_version: string = process.env.APP_VERSION || '0.10.0';

// ==========================================
// 1. VIEW ENGINE CONFIGURATION (EJS)
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ==========================================
// 2. PARSING & SESSION MIDDLEWARE
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'radix-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 Hours
    }
  })
);

// ==========================================
// 3. STATIC FILE SERVING
// ==========================================
// Serve public assets (CSS, JS, fonts)
app.use(express.static(path.join(__dirname, '../public')));

// Serve theme assets such as /themes/default/assets/css/style.css
app.use('/themes', express.static(path.join(__dirname, '../views/themes')));

// Serve media library uploads dynamically
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ==========================================
// 4. ROUTE MOUNTING
// ==========================================
// CRITICAL: /admin MUST be mounted before / so that /:slug does not catch /admin URLs
app.use('/admin', adminRoutes);
app.use('/', indexRoutes);

// ==========================================
// 5. SERVER INITIALIZATION
// ==========================================
async function startServer() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Error during DB initialization:', err);
  }

  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(` 🚀 ${app_name} ${app_version} is running!`);
    console.log(` 🌐 Public Site:  http://localhost:${PORT}`);
    console.log(` 🔑 Admin Panel:  http://localhost:${PORT}/admin`);
    console.log(`==================================================\n`);

    console.log('Start Time:', new Date().toLocaleString(), '\n');
  });
}

startServer();

export default app;