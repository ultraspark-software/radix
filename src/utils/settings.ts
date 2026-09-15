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

let cachedSettings: Record<string, string> | null = null;

/*
* getSettings
*
* PURPOSE:
* Fetches all global site settings and caches them as a key-value object.
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
* Fetches one global setting by key and supplies a fallback when it is absent.
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
* Invalidates the in-memory settings cache after settings are changed.
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
