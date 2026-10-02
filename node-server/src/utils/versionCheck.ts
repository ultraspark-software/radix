/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: application version lookup and update checking.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import { getSetting, getSettings } from './settings';

export interface VersionData {
  Application: {
    Name: string;
    MajorVersion: string;
    MinorVersion: string;
    UpdateVersion: string;
    ReleaseDate: string;
    InstallFile: string;
    Notes: string;
  };
}

export interface VersionCheckResult {
  currentVersion: string;
  remoteVersion: string | null;
  hasUpdate: boolean;
  details: VersionData['Application'] | null;
  error: string | null;
}

/*
* checkForUpdates
*
* PURPOSE:
* Retrieves the configured remote version and compares it with the installed
* application version.
*
* PARAMETERS:
* None.
*
* RETURNS:
* Returns a promise containing version details, update status, and any error.
*/
export async function checkForUpdates(): Promise<VersionCheckResult> {
  // Fetch the version setting asynchronously from DB (cached after 1st run)
  const settings = await getSettings();

  // const currentVersion = settings['app_version'] || '0.0.0';
  const currentVersion: string = process.env.APP_VERSION || '0.0.0';
  const ENDPOINT = settings['update_url'] || 'https://vault.ultraspark.net/radix/version.json';
  
  try {
    const response = await fetch(ENDPOINT, { signal: AbortSignal.timeout(5000) });
    
    if (!response.ok) {
      throw new Error(`Server returned status code ${response.status}`);
    }

    const data = (await response.json()) as VersionData;
    const app = data.Application;
    const remoteVersion = `${app.MajorVersion}.${app.MinorVersion}.${app.UpdateVersion}`;

    const hasUpdate = compareSemVer(remoteVersion, currentVersion) > 0;

    return {
      currentVersion,
      remoteVersion,
      hasUpdate,
      details: app,
      error: null
    };
  } catch (err: any) {
    return {
      currentVersion,
      remoteVersion: null,
      hasUpdate: false,
      details: null,
      error: `Failed to retrieve update status: ${err.message}`
    };
  }
}

/*
* compareSemVer
*
* PURPOSE:
* Compares two semantic version strings using numeric ordering.
*
* PARAMETERS:
* v1 (string): First version to compare.
* v2 (string): Second version to compare.
*
* RETURNS:
* Returns a negative number, zero, or positive number according to the comparison.
*/
function compareSemVer(v1: string, v2: string): number {
  return v1.localeCompare(v2, undefined, { numeric: true, sensitivity: 'base' });
}
