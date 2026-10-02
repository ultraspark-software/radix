import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import ejs from 'ejs';
import type { Application, Request, Response } from 'express';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

/** Permitted user roles for this module. */
type RoleName = 'Manager' | 'Administrator';

/** Data model representing a Westbank Project record from MSSQL. */
type WestbankProject = {
  ID: number;
  ProjectName: string;
  Account: number;
  Password: string;
};

/** Context object passed when registering route handlers. */
type RegisterContext = {
  app: Application;
  db?: unknown;
};

/** Extended Express Request interface to support session user payload. */
type RequestWithSession = Request & {
  session?: {
    user?: {
      role?: string;
    };
    [key: string]: unknown;
  };
};

// Numerical hierarchy for role permission checking
const ROLE_LEVELS: Record<RoleName, number> = {
  Manager: 4,
  Administrator: 5
};

// ==========================================
// DATABASE CONFIGURATION & CONNECTION POOL
// ==========================================

/**
 * Reads and validates MSSQL credentials from 'appsettings.json' in the root directory.
 * @throws {Error} If file is missing or required config properties are omitted.
 */
function getMssqlConfig() {
  const settingsPath = path.join(process.cwd(), 'appsettings.json');

  if (!fs.existsSync(settingsPath)) {
    throw new Error(`Missing MSSQL configuration file: ${settingsPath}`);
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
    mssql_intranet?: {
      server?: string;
      database?: string;
      user?: string;
      password?: string;
      port?: number;
      options?: Record<string, unknown>;
    };
  };

  const config = settings.mssql_intranet;

  if (!config?.server || !config.database || !config.user || !config.password) {
    throw new Error('appsettings.json must define mssql_intranet server, database, user, and password');
  }

  return {
    server: config.server,
    database: config.database,
    user: config.user,
    password: config.password,
    port: config.port,
    options: config.options ?? {}
  } as sql.config;
}

/** Cache holding the singleton SQL connection pool promise. */
let poolPromise: Promise<sql.ConnectionPool> | undefined;

/**
 * Returns an existing MSSQL connection pool or opens a new one.
 * Implements the Singleton pattern to prevent opening redundant database connections.
 */
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(getMssqlConfig()).catch((error: unknown) => {
      // Reset cache on failure so future calls can retry connecting
      poolPromise = undefined;
      throw error;
    });
  }

  return poolPromise;
}

// ==========================================
// MIDDLEWARE & VALIDATION HELPERS
// ==========================================

/**
 * Express Middleware: Restricts route access to users with 'Manager' or 'Administrator' roles.
 * Redirects unauthenticated users to login; blocks unauthorized users with 403 Forbidden.
 */
function requireManagerOrAdministrator(request: RequestWithSession, response: Response, next: () => void) {
  const role = request.session?.user?.role as RoleName | undefined;

  // 1. Grant access if user role meets minimum level (>= Manager level 4)
  if (role && ROLE_LEVELS[role] >= ROLE_LEVELS.Manager) {
    return next();
  }

  // 2. Redirect to login if user isn't authenticated
  if (!request.session?.user) {
    return response.redirect(`/admin/login?redirect=${encodeURIComponent(request.originalUrl)}`);
  }

  // 3. Deny access if authenticated but lacks required role level
  return response.status(403).send('Forbidden: Manager or Administrator access required.');
}

/** Validates and parses a value into a non-negative integer. */
function getAccountNumber(value: unknown): number {
  const account = Number.parseInt(String(value), 10);
  if (!Number.isInteger(account) || account < 0) {
    throw new Error('Account # must be a non-negative whole number.');
  }
  return account;
}

/** Validates and trims a required string value. */
function getRequiredText(value: unknown, fieldName: string): string {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }
  return text;
}

// ==========================================
// VIEW RENDERING & DATA RETRIEVAL
// ==========================================

/**
 * Renders the EJS partial page and wraps it inside the global theme layout.
 */
async function renderWestbankPage(response: Response, data: { projects: WestbankProject[]; error: string | null }) {
  // Render inner page content template
  const content = await ejs.renderFile(
    path.join(process.cwd(), 'views/pages/westbank-project-passwords.ejs'),
    data
  );

  // Inject content into outer theme template
  response.type('html');
  return response.render('themes/blue-20260916/index', {
    content,
    currentTheme: 'blue-20260916',
    // Helper function exposed directly to the layout template for UI components
    RadButton: (url: string, label: string, className: string, external = false) => {
      const target = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${url}" class="${className}"${target}>${label}</a>`;
    }
  });
}

/** Executes SELECT query against MSSQL to fetch all project records. */
async function loadProjects(): Promise<WestbankProject[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ID, ProjectName, Account, Password
    FROM DB_WestbankProjects
    ORDER BY Account
  `);

  return result.recordset as WestbankProject[];
}

// ==========================================
// ROUTE REGISTRATION MODULE
// ==========================================

/**
 * Registers all HTTP routes related to Westbank Projects onto the Express application.
 */
export async function register(context: RegisterContext) {
  const { app } = context;

  // READ: View project table
  app.get('/westbank-project-passwords', requireManagerOrAdministrator, async (_request, response) => {
    try {
      const projects = await loadProjects();
      await renderWestbankPage(response, { projects, error: null });
    } catch (error) {
      console.error('[Westbank Projects] Failed to load entries:', error);
      response.status(500).send('Unable to load Westbank project accounts.');
    }
  });

  // CREATE: Add new project record
  app.post('/westbank-project-passwords/create', requireManagerOrAdministrator, async (request, response) => {
    try {
      const account = getAccountNumber(request.body.account);
      const password = getRequiredText(request.body.password, 'Password');
      const projectName = getRequiredText(request.body.projectName, 'Project Name');
      const pool = await getPool();

      // Use parameterized inputs to protect against SQL Injection
      await pool.request()
        .input('projectName', sql.NVarChar(255), projectName)
        .input('account', sql.Int, account)
        .input('password', sql.NVarChar(255), password)
        .query(`
          INSERT INTO DB_WestbankProjects (ProjectName, Account, Password)
          VALUES (@projectName, @account, @password)
        `);

      response.redirect('/westbank-project-passwords');
    } catch (error) {
      console.error('[Westbank Projects] Failed to create entry:', error);
      response.status(400).send((error as Error).message || 'Unable to create entry.');
    }
  });

  // UPDATE: Edit existing project record by ID
  app.post('/westbank-project-passwords/:id/edit', requireManagerOrAdministrator, async (request, response) => {
    try {
      const id = getAccountNumber(request.params.id);
      const account = getAccountNumber(request.body.account);
      const password = getRequiredText(request.body.password, 'Password');
      const projectName = getRequiredText(request.body.projectName, 'Project Name');
      const pool = await getPool();

      await pool.request()
        .input('id', sql.Int, id)
        .input('projectName', sql.NVarChar(255), projectName)
        .input('account', sql.Int, account)
        .input('password', sql.NVarChar(255), password)
        .query(`
          UPDATE DB_WestbankProjects
          SET ProjectName = @projectName, Account = @account, Password = @password
          WHERE ID = @id
        `);

      response.redirect('/westbank-project-passwords');
    } catch (error) {
      console.error('[Westbank Projects] Failed to update entry:', error);
      response.status(400).send((error as Error).message || 'Unable to update entry.');
    }
  });

  // DELETE: Remove project record by ID
  app.post('/westbank-project-passwords/:id/delete', requireManagerOrAdministrator, async (request, response) => {
    try {
      const id = getAccountNumber(request.params.id);
      const pool = await getPool();

      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM DB_WestbankProjects WHERE ID = @id');

      response.redirect('/westbank-project-passwords');
    } catch (error) {
      console.error('[Westbank Projects] Failed to delete entry:', error);
      response.status(400).send((error as Error).message || 'Unable to delete entry.');
    }
  });
}