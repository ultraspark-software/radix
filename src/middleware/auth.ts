/**************************************************************************************************
* RadixCMS
*
* DESCRIPTION: authentication and role-based access middleware.
*
* Copyright (C) 2026 Ultra Spark Software <salve@ultraspark.net>
* SPDX-License-Identifier: GPL-3.0-or-later
**************************************************************************************************/

import { Request, Response, NextFunction } from 'express';

export type UserRole = 'Unregistered' | 'Registered' | 'Editor' | 'Manager' | 'Administrator';

export const ROLE_HIERARCHY: UserRole[] = [
  'Unregistered',
  'Registered',
  'Editor',
  'Manager',
  'Administrator'
];

/*
* requireRole
*
* PURPOSE:
* Creates middleware that permits requests only when the signed-in user's role
* meets or exceeds the required role.
*
* PARAMETERS:
* requiredRole (UserRole): Minimum role required to access the route.
*
* RETURNS:
* Returns Express middleware that calls next(), redirects to login, or sends
* an HTTP 403 response.
*/
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole: UserRole = req.session?.user?.role || 'Unregistered';

    const userLevel = ROLE_HIERARCHY.indexOf(userRole);
    const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);

    if (userLevel >= requiredLevel) {
      return next();
    }

    if (userLevel === 0) {
      res.redirect('/admin/login');
      return;
    }

    res.status(403).send('Forbidden: Insufficient privileges.');
  };
}
