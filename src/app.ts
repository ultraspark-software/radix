#!/usr/bin/env node
/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: application startup, middleware, and route configuration.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import fastify, { FastifyInstance } from 'fastify';
import fastifyExpress from '@fastify/express';
import express from 'express';
import session from 'express-session';
import path from 'path';

// Import Routers
import adminRoutes from './routes/admin';
import indexRoutes from './routes/index';
import { initDatabase } from './init/dbInit2';

const app: FastifyInstance = fastify({ logger: true });
const PORT = process.env.SITE_PORT || 3000;

let app_name: string = process.env.APP_NAME || 'Radix';
let app_version: string = process.env.APP_VERSION || '1.1.0';

// ==========================================
// SERVER INITIALIZATION
// ==========================================
async function startServer() {
  // The Express compatibility plugin keeps the existing routers and EJS
  // response helpers working while Fastify owns the HTTP server.
  await app.register(fastifyExpress);

  app.express.set('view engine', 'ejs');
  app.express.set('views', path.join(__dirname, '../views'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'radix-secret-key-change-this-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24
      }
    })
  );

  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/themes', express.static(path.join(__dirname, '../views/themes')));
  app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

  // Express normally infers text/html for strings produced by res.render().
  // Fastify's adapter defaults string responses to text/plain, so preserve
  // browser rendering for the existing EJS routes.
  app.use((_req, res, next) => {
    const send = res.send.bind(res);
    res.send = ((body: unknown) => {
      if (typeof body === 'string' && /^\s*<(?:!doctype\s+html|html\b)/i.test(body)) {
        res.type('html');
      }
      return send(body);
    }) as typeof res.send;
    next();
  });

  // CRITICAL: /admin MUST be mounted before / so that /:slug does not catch /admin URLs
  app.use('/admin', adminRoutes);
  app.use('/', indexRoutes);

  try {
    await initDatabase();
  } catch (err) {
    console.error('Error during DB initialization:', err);
  }

  await app.listen({ port: Number(PORT), host: '0.0.0.0' });
  console.log(`\n==================================================`);
  console.log(` 🚀 ${app_name} ${app_version} is running!`);
  console.log(` 🌐 Public Site:  http://localhost:${PORT}`);
  console.log(` 🔑 Admin Panel:  http://localhost:${PORT}/admin`);
  console.log(`==================================================\n`);
  console.log('Start Time:', new Date().toLocaleString(), '\n');
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exitCode = 1;
  });
}

export default app;