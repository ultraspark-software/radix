/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: administration routes, setup, content, users, media, and settings.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import db from '../config/db';
import { getAvailableTemplates } from '../utils/themeScanner';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { initDatabase } from '../init/dbInit2';
import nodemailer from 'nodemailer';
import { checkForUpdates } from '../utils/versionCheck';
import AdmZip from 'adm-zip';

const router = Router();

function updateEnvVersion(version: string | null): void {
  if (!version) return;

  const envPath = path.join(process.cwd(), '.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  const re = /^APP_VERSION=.*$/m;
  if (re.test(envContent)) {
    envContent = envContent.replace(re, `APP_VERSION=${version}`);
  } else {
    envContent += (envContent ? '\n' : '') + `APP_VERSION=${version}`;
  }

  fs.writeFileSync(envPath, envContent, { encoding: 'utf8' });
  process.env.APP_VERSION = version;
}

// Installation check: if database connection info is missing or the DB is not reachable,
// route the user into the installer workflow.
router.use(async (req: Request, res: Response, next: Function) => {
  if (req.path === '/install' || req.path.startsWith('/setup')) return next();

  const hasDbConfig = !!(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD !== undefined &&
    process.env.DB_NAME
  );

  if (!hasDbConfig) {
    console.warn('[Radix Setup]: Missing database configuration, redirecting to installer.');
    return res.redirect('/admin/install');
  }

  try {
    // quick probe against the configured pool to determine if DB is working
    await db.execute('SELECT 1');
    return next();
  } catch (err) {
    console.warn('[Radix Setup]: Database not reachable, redirecting to installer.');
    return res.redirect('/admin/install');
  }
});

// --- Install / Setup: Database Connection Form ---
router.get('/install', (_req: Request, res: Response) => {
  res.render('admin/setup-db', { error: null, values: {} });
});

router.get('/setup/db', (_req: Request, res: Response) => {
  res.render('admin/setup-db', { error: null, values: {} });
});

// POST /admin/setup/db/test - Test DB connection using provided form values without saving to .env
router.post('/setup/db/test', async (req: Request, res: Response) => {
  const { dbName, dbUser, dbPass, dbHost, dbPort } = req.body as any;
  const cfg: any = {
    host: dbHost || '127.0.0.1',
    user: dbUser || undefined,
    password: dbPass || undefined,
    port: Number(dbPort) || 3306,
    connectTimeout: 3000
  };
  let conn: any;
  try {
    conn = await mysql.createConnection(cfg);
    // if a database name is provided, ensure it exists (querying INFORMATION_SCHEMA) otherwise run simple probe
    if (dbName) {
      const [rows] = await conn.query('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [dbName]);
      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        await conn.end();
        return res.status(400).json({ ok: false, error: `Database '${dbName}' not found or inaccessible.` });
      }
    } else {
      await conn.query('SELECT 1');
    }
    await conn.end();
    return res.json({ ok: true, message: 'Connection successful' });
  } catch (err: any) {
    try { if (conn) await conn.end(); } catch (e) { /* ignore */ }
    return res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/setup/db', async (req: Request, res: Response) => {
  const { dbName, dbUser, dbPass, dbHost, dbPort, tablePrefix } = req.body;
  const envPath = path.join(__dirname, '../../.env');
  try {
    // Read existing .env (if any)
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
    const setEnv = (key: string, value: string) => {
      const re = new RegExp(`^${key}=.*$`, 'm');
      if (re.test(envContent)) {
        envContent = envContent.replace(re, `${key}=${value}`);
      } else {
        envContent += (envContent ? '\n' : '') + `${key}=${value}`;
      }
    };
    setEnv('DB_NAME', dbName || 'radix');
    setEnv('DB_USER', dbUser || '');
    setEnv('DB_PASSWORD', dbPass || '');
    setEnv('DB_HOST', dbHost || '127.0.0.1');
    if (dbPort) setEnv('DB_PORT', dbPort);
    if (tablePrefix) setEnv('TABLE_PREFIX', tablePrefix);
fs.writeFileSync(envPath, envContent, { encoding: 'utf8' });
    // reload env and try to initialize the DB schema — explicitly override process.env with values from the new .env    try {      const parsedEnv = dotenv.parse(fs.readFileSync(envPath, 'utf8'));      for (const k of Object.keys(parsedEnv)) {        process.env[k] = parsedEnv[k];      }    } catch (e) {      // fall back to regular dotenv config if parsing fails      dotenv.config({ path: envPath });    }    await initDatabase();    return res.redirect('/admin/setup/admin');
  } catch (err) {
    console.error('[Radix Setup DB Error]:', err);
    return res.render('admin/setup-db', { error: String(err), values: req.body });
  }
});

// --- Setup: Admin / Site Info Form ---
router.get('/setup/admin', (_req: Request, res: Response) => {
  res.render('admin/setup-admin', { error: null, values: {} });
});

router.post('/setup/admin', async (req: Request, res: Response) => {
  const { siteTitle, username, password, email, searchEngineVisibility } = req.body;

  try {
    await initDatabase();

    const passwordHash = await bcrypt.hash(password, 10);

    // create administrator user
    await db.execute(
      'INSERT INTO users (username, password, password_hash, email, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [username, null, passwordHash, email, 'Administrator']
    );

    // save site settings
    await db.execute(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      ['site_title', siteTitle || 'Radix Site']
    );

    await db.execute(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      ['search_engine_visibility', searchEngineVisibility ? '1' : '0']
    );

    return res.redirect('/admin/login');
  } catch (err) {
    console.error('[Radix Setup Admin Error]:', err);
    return res.render('admin/setup-admin', { error: String(err), values: req.body });
  }
});

// ==========================================
// 1. MIDDLEWARE & HELPER CONFIGURATION
// ==========================================

const ROLE_HIERARCHY: Record<string, number> = {
  'Administrator': 5,
  'Manager': 4,
  'Editor': 3,
  'Registered': 2,
  'Unregistered': 1
};

// GET /admin/login - Render Login View
router.get('/login', (req: Request, res: Response) => {
  res.render('admin/login', { error: null });
});

// POST /admin/login - Process Login Form
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (rows.length === 0) {
      res.render('admin/login', { error: 'Invalid username or password.' });
      return;
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      res.render('admin/login', { error: 'Invalid username or password.' });
      return;
    }

    if (user.role === 'Unregistered') {
      res.render('admin/login', { error: 'This account is not permitted to log in.' });
      return;
    }

    (req.session as any).user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    if (user.role === 'Registered') {
      res.redirect('/');
      return;
    }

    res.redirect('/admin');
  } catch (err) {
    console.error('[Radix Login Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// GET /admin/logout - Destroy Session
router.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// RBAC Middleware Guard
function requireRole(minRole: string) {
  return (req: Request, res: Response, next: Function): void => {
    const user = (req.session as any)?.user;
    if (!user) {
      res.redirect('/admin/login');
      return;
    }

    const userLevel = ROLE_HIERARCHY[user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 5;

    if (userLevel < requiredLevel) {
      res.status(403).render('defaults/403', { message: 'Access Denied: Insufficient Role Privileges.' });
      return;
    }

    next();
  };
}

// Multer Storage Setup
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, GIF, WEBP, SVG) are allowed!'));
  }
});

function getMediaFiles() {
  if (!fs.existsSync(UPLOAD_DIR)) return [];

  const files = fs.readdirSync(UPLOAD_DIR);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

  return files
    .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
    .map(file => {
      const stats = fs.statSync(path.join(UPLOAD_DIR, file));
      return {
        name: file,
        url: `/uploads/${file}`,
        size: (stats.size / 1024).toFixed(1) + ' KB',
        mtime: stats.mtime
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

// ==========================================
// 2. DASHBOARD & PAGE MANAGEMENT ROUTES
// ==========================================

// GET /admin - Dashboard Overview
router.get('/', requireRole('Editor'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS totalPages FROM pages WHERE status != "Deleted"');
    const [pubRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS publishedPages FROM pages WHERE status = "Published"');
    const [draftRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS draftPages FROM pages WHERE status = "Draft"');
    const [trashRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS trashPages FROM pages WHERE status = "Deleted"');

    const [userRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS totalUsers FROM users');

    const pagesDir = path.join(__dirname, '../../views/pages');
    let staticFiles: string[] = [];
    if (fs.existsSync(pagesDir)) {
      staticFiles = fs.readdirSync(pagesDir).filter(file => file.endsWith('.ejs'));
    }

    res.render('admin/dashboard', {
      stats: {
        totalPages: totalRows[0]?.totalPages || 0,
        publishedPages: pubRows[0]?.publishedPages || 0,
        draftPages: draftRows[0]?.draftPages || 0,
        trashPages: trashRows[0]?.trashPages || 0,
        staticPagesCount: staticFiles.length,
        totalUsers: userRows[0]?.totalUsers || 0,
        mediaCount: getMediaFiles().length
      },
      user: (_req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Dashboard Stats Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// GET /admin/pages - Pages Management List
router.get('/pages', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const showTrash = req.query.view === 'trash';
    const statusFilter = showTrash ? 'Deleted' : (req.query.status as string) || null;

    let sql = 'SELECT * FROM pages ';
    const params: any[] = [];

    if (showTrash) {
      sql += 'WHERE status = "Deleted" ';
    } else if (statusFilter) {
      sql += 'WHERE status = ? ';
      params.push(statusFilter);
    } else {
      sql += 'WHERE status != "Deleted" ';
    }

    sql += 'ORDER BY created_at DESC';

    const [pages] = await db.execute<RowDataPacket[]>(sql, params);

    const pagesDir = path.join(__dirname, '../../views/pages');
    let staticSlugs: string[] = [];
    if (fs.existsSync(pagesDir)) {
      staticSlugs = fs.readdirSync(pagesDir)
        .filter(file => file.endsWith('.ejs'))
        .map(file => path.basename(file, '.ejs').toLowerCase());
    }

    const pagesWithFlags = (pages as any[]).map(page => ({
      ...page,
      isStaticOverride: staticSlugs.includes(String(page.slug).toLowerCase())
    }));

    res.render('admin/pages', {
      pages: pagesWithFlags,
      showTrash,
      currentStatusFilter: statusFilter || 'All',
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Pages Route Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// GET /admin/create - Render Create Form
router.get('/create', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = getAvailableTemplates();
    res.render('admin/create-page', {
      templates,
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Create Page Route Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/create - Process Page Creation
router.post('/create', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  const { title, slug, content, template_name, status, min_role, publish_at } = req.body;

  try {
    const publishDate = publish_at ? new Date(publish_at) : new Date();
    const selectedTemplate = template_name && template_name.trim() !== '' ? template_name : 'default';

    await db.execute(
      `INSERT INTO pages (title, slug, content, template_name, status, min_role, publish_at, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        title,
        slug,
        content || '',
        selectedTemplate,
        status || 'Draft',
        min_role || 'Unregistered',
        publishDate
      ]
    );

    res.redirect('/admin/pages');
  } catch (err) {
    console.error('[Radix Page Creation Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// GET /admin/edit/:id - Render Edit Page Form
router.get('/edit/:id', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const [pages] = await db.execute<RowDataPacket[]>('SELECT * FROM pages WHERE id = ?', [req.params.id]);

    if (pages.length === 0) {
      res.status(404).render('defaults/404');
      return;
    }

    const templates = getAvailableTemplates();

    res.render('admin/edit-page', {
      page: pages[0],
      templates,
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Edit Fetch Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/edit/:id - Process Edit Page Update
router.post('/edit/:id', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  const pageId = req.params.id;
  const { title, slug, content, template_name, status, min_role, publish_at } = req.body;

  try {
    const publishDate = publish_at ? new Date(publish_at) : new Date();

    await db.execute(
      `UPDATE pages 
       SET title = ?, slug = ?, content = ?, template_name = ?, status = ?, min_role = ?, publish_at = ? 
       WHERE id = ?`,
      [
        title,
        slug,
        content || '',
        template_name || 'default',
        status || 'Draft',
        min_role || 'Unregistered',
        publishDate,
        pageId
      ]
    );

    res.redirect('/admin/pages');
  } catch (err) {
    console.error('[Radix Page Update Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/delete/:id - Soft Delete Page
router.post('/delete/:id', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    await db.execute('UPDATE pages SET status = "Deleted" WHERE id = ?', [req.params.id]);
    res.redirect('/admin/pages');
  } catch (err) {
    console.error('[Radix Soft Delete Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/restore/:id - Restore Page from Trash
router.post('/restore/:id', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    await db.execute('UPDATE pages SET status = "Draft" WHERE id = ?', [req.params.id]);
    res.redirect('/admin/pages?view=trash');
  } catch (err) {
    console.error('[Radix Restore Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/permanent-delete/:id - Hard Delete Page
router.post('/permanent-delete/:id', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  try {
    await db.execute('DELETE FROM pages WHERE id = ? AND status = "Deleted"', [req.params.id]);
    res.redirect('/admin/pages?view=trash');
  } catch (err) {
    console.error('[Radix Permanent Delete Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// ==========================================
// 3. USER MANAGEMENT & RBAC ROUTES
// ==========================================

router.get('/users', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, username, email, full_name, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.render('admin/users', {
      users,
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix User Fetch Error]:', err);
    res.status(500).render('defaults/500');
  }
});

router.post('/users/create', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const { username, email, full_name, password, role } = req.body;

  if (!username || !password || !role) {
    res.status(400).send('Username, password, and role are required.');
    return;
  }

  const validRoles = ['Administrator', 'Manager', 'Editor', 'Registered', 'Unregistered'];
  if (!validRoles.includes(role as string)) {
    res.status(400).send('Invalid role specified.');
    return;
  }

  try {
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ? AND email != "")',
      [username, email || '']
    );

    if (existing.length > 0) {
      res.status(400).send('User with that username or email already exists.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO users (username, email, full_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [username, email || null, full_name || null, hashedPassword, role]
    );

    res.redirect('/admin/users');
  } catch (err) {
    console.error('[Radix User Creation Error]:', err);
    res.status(500).render('defaults/500');
  }
});

router.get('/users/edit/:id', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, username, email, full_name, role FROM users WHERE id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      res.status(404).render('defaults/404');
      return;
    }

    res.render('admin/edit-user', {
      editUser: users[0],
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix User Edit Fetch Error]:', err);
    res.status(500).render('defaults/500');
  }
});

router.post('/users/edit/:id', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.id;
  const { username, email, full_name, password, role } = req.body;

  if (!username || !role) {
    res.status(400).send('Username and role are required.');
    return;
  }

  const validRoles = ['Administrator', 'Manager', 'Editor', 'Registered', 'Unregistered'];
  if (!validRoles.includes(role as string)) {
    res.status(400).send('Invalid role specified.');
    return;
  }

  try {
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE (username = ? OR (email IS NOT NULL AND email = ? AND email != "")) AND id != ?',
      [username, email || '', userId]
    );

    if (existing.length > 0) {
      res.status(400).send('Another user with that username or email already exists.');
      return;
    }

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.execute(
        'UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, password_hash = ? WHERE id = ?',
        [username, email || null, full_name || null, role, hashedPassword, userId]
      );
    } else {
      await db.execute(
        'UPDATE users SET username = ?, email = ?, full_name = ?, role = ? WHERE id = ?',
        [username, email || null, full_name || null, role, userId]
      );
    }

    const sessionUser = (req.session as any)?.user;
    if (sessionUser && String(sessionUser.id) === String(userId)) {
      sessionUser.username = username;
      sessionUser.role = role;
    }

    res.redirect('/admin/users');
  } catch (err) {
    console.error('[Radix User Update Error]:', err);
    res.status(500).render('defaults/500');
  }
});

router.post('/users/update-role', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const { userId, newRole } = req.body;

  const validRoles = ['Administrator', 'Manager', 'Editor', 'Registered', 'Unregistered'];
  if (!validRoles.includes(newRole)) {
    res.status(400).send('Invalid role specified.');
    return;
  }

  try {
    await db.execute('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[Radix Role Update Error]:', err);
    res.status(500).render('defaults/500');
  }
});

router.post('/users/delete/:id', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const targetUserId = req.params.id;
  const currentUserId = (req.session as any)?.user?.id;

  if (String(targetUserId) === String(currentUserId)) {
    res.status(400).send('Security error: You cannot delete your own active administrator account.');
    return;
  }

  try {
    await db.execute('DELETE FROM users WHERE id = ?', [targetUserId]);
    res.redirect('/admin/users');
  } catch (err) {
    console.error('[Radix User Delete Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// ==========================================
// 4. MEDIA LIBRARY ROUTES
// ==========================================

router.get('/media', requireRole('Editor'), (req: Request, res: Response) => {
  const media = getMediaFiles();
  res.render('admin/media', { media, user: (req.session as any)?.user });
});

router.post('/media/upload', requireRole('Editor'), upload.single('file'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }
  res.json({ location: `/uploads/${req.file.filename}` });
});

router.post('/media/delete', requireRole('Administrator'), (req: Request, res: Response): void => {
  const { filename } = req.body;
  if (!filename) {
    res.status(400).send('Filename required.');
    return;
  }

  const filePath = path.join(UPLOAD_DIR, path.basename(filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.redirect('/admin/media');
});

// ==========================================
// 5. THEME MANAGEMENT
// ==========================================

router.get('/themes', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = getAvailableTemplates();
    res.render('admin/themes', {
      templates,
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Themes Route Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// ==========================================
// 6. SETTINGS
// ==========================================

// GET /admin/settings - Render Settings Page
router.get('/settings', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value || '';
    });

    res.render('admin/settings', {
      settings,
      message: req.query.msg ? String(req.query.msg) : null,
      error: req.query.err ? String(req.query.err) : null,
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Settings GET Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/settings - Save Settings
router.post('/settings', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const { site_logo, mail_host, mail_port, mail_secure, mail_user, mail_pass, mail_from } = req.body;

  const updates = [
    ['site_logo', site_logo || ''],
    ['mail_host', mail_host || ''],
    ['mail_port', mail_port || '25'],
    ['mail_secure', mail_secure === '1' ? '1' : '0'],
    ['mail_user', mail_user || ''],
    ['mail_pass', mail_pass || ''],
    ['mail_from', mail_from || '']
  ];

  try {
    for (const [key, value] of updates) {
      await db.execute(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }
    res.redirect('/admin/settings?msg=Settings+saved+successfully.');
  } catch (err) {
    console.error('[Radix Settings Save Error]:', err);
    res.redirect('/admin/settings?err=Failed+to+save+settings.');
  }
});

// POST /admin/settings/test-email - Dispatch SMTP Test Email
router.post('/settings/test-email', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const { recipient_email } = req.body;

  if (!recipient_email) {
    res.redirect('/admin/settings?err=Recipient+email+address+is+required.');
    return;
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM settings');
    const cfg: Record<string, string> = {};
    rows.forEach(r => { cfg[r.setting_key] = r.setting_value || ''; });

    const transporter = nodemailer.createTransport({
      host: cfg.mail_host || process.env.MAIL_HOST || 'localhost',
      port: Number(cfg.mail_port || process.env.MAIL_PORT || 25),
      secure: cfg.mail_secure === '1',
      auth: cfg.mail_user ? {
        user: cfg.mail_user,
        pass: cfg.mail_pass
      } : undefined,
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: cfg.mail_from || `Radix CMS <noreply@${process.env.SITE_URL || 'localhost'}>`,
      to: recipient_email,
      subject: 'Radix CMS - SMTP Test Connection',
      text: 'Congratulations! Your Radix CMS mail server configuration is working correctly.',
      html: '<h3>Radix CMS Mail Test</h3><p>Your mail server settings are configured correctly.</p>'
    });

    res.redirect('/admin/settings?msg=Test+email+sent+successfully+to+' + encodeURIComponent(recipient_email));
  } catch (err: any) {
    console.error('[SMTP Test Error]:', err);
    res.redirect('/admin/settings?err=' + encodeURIComponent(`Email dispatch failed: ${err.message}`));
  }
});

// ==========================================
// 7. UPDATES
// ==========================================

// GET /admin/updates - Render System Updates Dashboard
router.get('/updates', requireRole('Editor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updateInfo = await checkForUpdates();

    res.render('admin/updates', {
      updateInfo,
      message: req.query.msg ? String(req.query.msg) : null,
      error: req.query.err ? String(req.query.err) : null,
      user: (req.session as any)?.user
    });
  } catch (err) {
    console.error('[Radix Updates Route Error]:', err);
    res.status(500).render('defaults/500');
  }
});

// POST /admin/updates/apply - Download & Overwrite Core Codebase
router.post('/updates/apply', requireRole('Administrator'), async (req: Request, res: Response): Promise<void> => {
  const updateInfo = await checkForUpdates();

  if (!updateInfo.hasUpdate || !updateInfo.details) {
    res.redirect('/admin/updates?err=' + encodeURIComponent('No update available or release package details missing.'));
    return;
  }

  const fileUrl = `https://vault.ultraspark.net/radix/${updateInfo.details.InstallFile}`;
  const zipPath = path.join(process.cwd(), 'temp_update.zip');
  const extractDir = path.join(process.cwd(), 'temp_update_extract');

  try {
    // 1. Download zip archive
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(zipPath, Buffer.from(arrayBuffer));

    // 2. Extract contents
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);

    // 3. Overwrite codebase excluding environment and runtime assets
    const protectedPaths = ['.env', 'node_modules', 'uploads', 'temp_update.zip', 'temp_update_extract'];

    const copyFolderRecursive = async (src: string, dest: string) => {
      const entries = await fs.promises.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        if (protectedPaths.includes(entry.name)) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyFolderRecursive(srcPath, destPath);
        } else {
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
    };

    await copyFolderRecursive(extractDir, process.cwd());
    updateEnvVersion(updateInfo.remoteVersion);

    // 4. Clean up temporary files
    await fs.promises.unlink(zipPath).catch(() => {});
    await fs.promises.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    res.redirect('/admin/updates?msg=' + encodeURIComponent('System updated successfully! Restart application process to reflect server changes.'));
  } catch (err: any) {
    console.error('[Update Apply Error]:', err);
    // Cleanup on failure
    await fs.promises.unlink(zipPath).catch(() => {});
    await fs.promises.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    res.redirect('/admin/updates?err=' + encodeURIComponent(`Update execution failed: ${err.message}`));
  }
});

export default router;
