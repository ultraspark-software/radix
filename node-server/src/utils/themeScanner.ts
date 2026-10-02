/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: discovery of available public themes.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import fs from 'fs';
import path from 'path';

export function getAvailableTemplates(): string[] {
  // Adjust relative path based on compiled structure in /dist vs /src
  const themesDir = path.join(__dirname, '../../views/themes');

  if (!fs.existsSync(themesDir)) {
    return ['default'];
  }

  // Read all folders and files inside /views/themes
  const entries = fs.readdirSync(themesDir, { withFileTypes: true });

  const themes = entries
    .filter(entry => entry.isDirectory() || entry.name.endsWith('.ejs'))
    .map(entry => entry.name.replace('.ejs', '').toLowerCase());

  // Ensure 'default' is always in the list
  if (!themes.includes('default')) {
    themes.unshift('default');
  }

  return Array.from(new Set(themes));
}
