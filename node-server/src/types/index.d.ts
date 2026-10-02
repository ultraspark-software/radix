/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: Express session type extensions.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      role: 'Administrator' | 'Manager' | 'Editor' | 'Registered' | 'Unregistered';
    };
  }
}
