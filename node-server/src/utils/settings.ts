/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: application settings retrieval and cache management.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import db from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import appSettings from '../../appsettings.json';

let cachedSettings: Record<string, string> | null = null;

/*
* getSettings
*
* PURPOSE:
* Fetches all global site settings from .env and caches them as a key-value object.
*
* PARAMETERS:
* forceRefresh (boolean): Reloads settings from the database when true.
*
* RETURNS:
* Returns a promise containing the settings keyed by setting name.
*/
export async function getSettings(forceRefresh = false): Promise<Record<string, string>> {
  if (cachedSettings && !forceRefresh) {
    return cachedSettings;
  }

  try {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM settings');
    const settings: Record<string, string> = {};

    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value || '';
    });

    cachedSettings = settings;
    return settings;
  } catch (err) {
    console.error('[Radix Settings Helper Error]:', err);
    return cachedSettings || {};
  }
}

/*
* getSetting
*
* PURPOSE:
* Fetches one global setting from .env by key and supplies a fallback when it is absent.
*
* PARAMETERS:
* key (string): Setting name to retrieve.
* defaultValue (string): Value returned when the setting does not exist.
*
* RETURNS:
* Returns a promise containing the setting value.
*/
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const settings = await getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/*
* clearSettingsCache
*
* PURPOSE:
* Invalidates the in-memory settings cache from .env after settings are changed.
*
* PARAMETERS:
* None.
*
* RETURNS:
* Returns void.
*/
export function clearSettingsCache(): void {
  cachedSettings = null;
}


/*
* getAppSetting
*
* PURPOSE:
* Fetches one global setting from appsettings.json by key and supplies a fallback when it is absent.
* Supports both dot-notation paths (e.g., "urls.url_Vault") and direct key lookups (e.g., "url_Vault").
*
* PARAMETERS:
*   key (string): Setting name or path to retrieve.
*   defaultValue (string): Value returned when the setting does not exist.
*   
* RETURNS:
*   Returns the setting value.   
*/  
export function getAppSetting(key: string, defaultValue = ''): string {
  if (!key) return defaultValue;

  // 1. Check dot-notation path (e.g., "app.name", "mssql.server", "urls.url_Vault")
  const parts = key.split('.');
  let current: unknown = appSettings;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (current !== undefined && current !== null) {
    return String(current);
  }

  // 2. Fallback: Search top-level sections for the key directly (e.g., "doc_DrugAbusePolicy")
  for (const section of Object.values(appSettings)) {
    if (section && typeof section === 'object' && key in section) {
      const value = (section as Record<string, unknown>)[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  return defaultValue;
}