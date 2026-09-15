/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: example SEO plugin and plugin lifecycle handlers.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import { Request, Response } from 'express';
import { RadixPlugin, RadixPluginContext } from '@radix/types/plugin';

const seoPlugin: RadixPlugin = {
  name: 'SEO Meta Generator',
  version: '1.0.0',
  init: (ctx: RadixPluginContext) => {
    
    // 1. Transform page content before rendering
    ctx.registerFilter('page:content', (content: string) => {
      return `${content}\n<!-- SEO Engine Checked -->`;
    });

    // 2. Add an event listener on page creation
    ctx.registerHook('page:created', (pageData: any) => {
      console.log(`[SEO Plugin]: Generating sitemap entry for ${pageData.slug}...`);
    });

    // 3. Add custom plugin routes to Express
    ctx.router.get('/admin/seo-settings', (req: Request, res: Response) => {
      res.send('SEO Settings Dashboard');
    });
  }
};

export default seoPlugin;
