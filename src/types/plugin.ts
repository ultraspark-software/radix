/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: plugin interfaces and extension contracts.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import { Router } from 'express';

export interface RadixPluginContext {
  router: Router;
  registerHook: (event: string, callback: Function) => void;
  registerFilter: (filterName: string, callback: (data: any) => any) => void;
  db: any; // Your MySQL connection pool
}

export interface RadixPlugin {
  name: string;
  version: string;
  init: (ctx: RadixPluginContext) => Promise<void> | void;
}
