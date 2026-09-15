/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: public page routing and theme rendering.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import ejs from 'ejs';
import db from '../config/db'; // Adjust path if your database module lives elsewhere

const router = Router();

// Hierarchy mapping for page access checks
const ROLE_HIERARCHY: Record<string, number> = {
  'Administrator': 5,
  'Manager': 4,
  'Editor': 3,
  'Registered': 2,
  'Unregistered': 1
};

/*
* resolveThemePath
*
* PURPOSE:
* Resolves a theme directory or legacy top-level theme file and falls back to
* the default theme when the requested template is unavailable.
*
* PARAMETERS:
* templateName (string): Requested theme or template name.
*
* RETURNS:
* Returns the EJS view path and the selected theme name.
*/
function resolveThemePath(templateName: string): { view: string; currentTheme: string } {
  const sanitizedName = templateName?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';
  const themesDir = path.join(__dirname, '../../views/themes');
  const themeDirectory = path.join(themesDir, sanitizedName);
  const themeFile = path.join(themesDir, `${sanitizedName}.ejs`);

  if (fs.existsSync(path.join(themeDirectory, 'index.ejs'))) {
    return {
      view: `themes/${sanitizedName}/index`,
      currentTheme: sanitizedName
    };
  }

  if (fs.existsSync(themeFile)) {
    return {
      view: `themes/${sanitizedName}`,
      currentTheme: sanitizedName
    };
  }

  return {
    view: 'themes/default/index',
    currentTheme: 'default'
  };
}

/*
* getStaticPageTheme
*
* PURPOSE:
* Reads an optional theme directive from a static EJS page.
*
* PARAMETERS:
* staticPageSource (string): Static page source to inspect.
*
* RETURNS:
* Returns the requested theme name, or undefined when no directive exists.
*/
function getStaticPageTheme(staticPageSource: string): string | undefined {
  const directive = staticPageSource.match(/<%#\s*(?:theme|layout)\s*:\s*([a-z0-9_-]+)\s*%>/i);
  return directive?.[1];
}

/*
* getStaticPageMinimumRole
*
* PURPOSE:
* Reads and normalizes the minimum role directive from a static EJS page.
*
* PARAMETERS:
* staticPageSource (string): Static page source to inspect.
*
* RETURNS:
* Returns the minimum role or Unregistered when no directive exists.
*/
function getStaticPageMinimumRole(staticPageSource: string): string {
  const directive = staticPageSource.match(/<%#\s*minRole\s*:\s*(Administrator|Manager|Editor|Registered|Unregistered)\s*%>/i);
  const role = directive?.[1];
  return Object.keys(ROLE_HIERARCHY).find(
    roleName => roleName.toLowerCase() === role?.toLowerCase()
  ) || 'Unregistered';
}

/*
* renderPageBySlug
*
* PURPOSE:
* Loads a page by slug, checks publication and role restrictions, and renders
* the selected static or database-backed theme.
*
* PARAMETERS:
* slug (string): Page slug used for lookup.
* req (Request): Express request containing session information.
* res (Response): Express response used to render or redirect.
*
* RETURNS:
* Returns a promise that resolves after the response has been handled.
*/
async function renderPageBySlug(slug: string, req: Request, res: Response): Promise<void> {
  try {
    const [pages] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM pages WHERE slug = ?',
      [slug]
    );
    const page = pages[0];
    const user = (req.session as any)?.user;

    // Static page files provide content, while a matching DB row can select its theme.
    const staticPagePath = path.join(__dirname, '../../views/pages', `${slug}.ejs`);

    if (fs.existsSync(staticPagePath)) {
      const staticPageSource = await fs.promises.readFile(staticPagePath, 'utf8');
      const userRole = user?.role || 'Unregistered';
      const requiredRole = getStaticPageMinimumRole(staticPageSource);
      const userLevel = ROLE_HIERARCHY[userRole] || ROLE_HIERARCHY['Unregistered'];
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || ROLE_HIERARCHY['Unregistered'];

      if (userLevel < requiredLevel) {
        if (!user) {
          res.redirect(`/admin/login?redirect=/${slug}`);
        } else {
          res.status(403).render('defaults/403', {
            message: 'Insufficient permissions to view this page.'
          });
        }
        return;
      }

      const content = await ejs.renderFile(staticPagePath, {
        title: page?.title || slug.charAt(0).toUpperCase() + slug.slice(1),
        page,
        user
      });
      const staticTheme = getStaticPageTheme(staticPageSource);
      const { view: themeView, currentTheme } = resolveThemePath(staticTheme || page?.template_name);

      res.render(themeView, {
        ...page,
        page,
        user,
        currentTheme,
        title: page?.title || slug.charAt(0).toUpperCase() + slug.slice(1),
        content,
        siteName: process.env.APP_NAME || 'Radix',
        appVersion: process.env.APP_VERSION || '0.11.0'
      });
      return;
    }

    if (pages.length === 0) {
      res.status(404).render('defaults/404');
      return;
    }

    const userRole = user ? user.role : 'Unregistered';

    // 1. Status & Scheduled Publish Check
    const isPublished = page.status === 'Published';
    const isPastPublishDate = new Date(page.publish_at) <= new Date();
    const isStaff = (ROLE_HIERARCHY[userRole] || 1) >= ROLE_HIERARCHY['Editor'];

    if ((!isPublished || !isPastPublishDate) && !isStaff) {
      res.status(404).render('defaults/404');
      return;
    }

    // 2. Minimum Role Access Verification
    const requiredLevel = ROLE_HIERARCHY[page.min_role] || 1;
    const userLevel = ROLE_HIERARCHY[userRole] || 1;

    if (userLevel < requiredLevel) {
      if (!user) {
        res.redirect(`/admin/login?redirect=/${slug}`);
      } else {
        res.status(403).render('defaults/403', {
          message: 'Insufficient permissions to view this page.'
        });
      }
      return;
    }

    // 3. Resolve Dynamic Theme Template Path
    const { view: themeView, currentTheme } = resolveThemePath(page.template_name);

    // 4. Render Page
    res.render(themeView, {
      ...page,
      page,
      user,
      currentTheme,
      title: page.title,
      content: page.content || '',
      siteName: process.env.APP_NAME || 'Radix',
      appVersion: process.env.APP_VERSION || '0.11.0'
    });
  } catch (err) {
    console.error(`[Radix Public Route Error - /${slug}]:`, err);
    res.status(500).render('defaults/500');
  }
}

// GET / - Render Homepage (slug: 'home')
router.get('/', async (req: Request, res: Response): Promise<void> => {
  await renderPageBySlug('home', req, res);
});

// GET /:slug - Dynamic Public Catch-All Route
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const slug = req.params.slug as string;

  if (!slug) {
    res.status(404).render('defaults/404');
    return;
  }

  // Skip reserved routes / static assets if mounted at app root
  const reservedSlugs = ['admin', 'uploads', 'favicon.ico', 'css', 'js'];
  if (reservedSlugs.includes(slug)) {
    return;
  }

  await renderPageBySlug(slug, req, res);
});

export default router;
