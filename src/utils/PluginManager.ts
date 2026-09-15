/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: plugin discovery, loading, and lifecycle management.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import db from '../config/db';

export class PluginManager {
  private hooks: Map<string, Function[]> = new Map();
  private filters: Map<string, Function[]> = new Map();

  // Register an Action Listener
  registerHook(event: string, callback: Function) {
    if (!this.hooks.has(event)) this.hooks.set(event, []);
    this.hooks.get(event)!.push(callback);
  }

  // Trigger an Action
  async triggerHook(event: string, payload: any) {
    const callbacks = this.hooks.get(event) || [];
    for (const cb of callbacks) {
      await cb(payload);
    }
  }

  // Register a Filter
  registerFilter(filterName: string, callback: (data: any) => any) {
    if (!this.filters.has(filterName)) this.filters.set(filterName, []);
    this.filters.get(filterName)!.push(callback);
  }

  // Apply Filters to Data sequentially
  async applyFilter(filterName: string, initialData: any): Promise<any> {
    const callbacks = this.filters.get(filterName) || [];
    let currentData = initialData;
    for (const cb of callbacks) {
      currentData = await cb(currentData);
    }
    return currentData;
  }

  // Scan and Load Plugins
  async loadPlugins(router: Router) {
    const pluginsDir = path.join(__dirname, '../../plugins');
    if (!fs.existsSync(pluginsDir)) return;

    const folders = fs.readdirSync(pluginsDir);

    for (const folder of folders) {
      const pluginPath = path.join(pluginsDir, folder, 'index.ts');
      
      if (fs.existsSync(pluginPath)) {
        try {
          // Dynamic import for Node/TypeScript
          const pluginModule = await import(pluginPath);
          const plugin = pluginModule.default;

          const ctx = {
            router,
            registerHook: this.registerHook.bind(this),
            registerFilter: this.registerFilter.bind(this),
            db
          };

          await plugin.init(ctx);
          console.log(`[Radix Plugin Loaded]: ${plugin.name} v${plugin.version}`);
        } catch (err) {
          console.error(`[Radix Plugin Error] Failed to load ${folder}:`, err);
        }
      }
    }
  }
}

export const pluginManager = new PluginManager();
