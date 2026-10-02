# Custom application code

Put application-specific server code in this root-level folder rather than
editing the CMS routes. Radix loads [`index.js`](./index.js) automatically at
startup when it exists.

## Registering a route

`index.js` acts as a small bootstrap. It can load one or more feature modules
from this folder, each exporting a `register(context)` function. This keeps the
main bootstrap tidy as the app grows:

```js
exports.register = async (context) => {
  const { app } = context;

  const feature = require('./my-feature.ts');
  await feature.register(context);
};
```

For TypeScript files, use the local `custom-code/*.ts` modules and run the app
with `npx tsx` during development. For production builds, the project compiles
custom-code to `dist/custom-code` so the same route registration can keep
working without changing the CMS app code.

Create the matching template at `views/pages/directory.ejs`, or return JSON
for a client-side page. Use parameter placeholders (`?`) for values supplied
by a request:

```js
const [rows] = await db.execute(
  'SELECT * FROM employee_directory WHERE department = ?',
  [department]
);
```

The custom module runs before the CMS `/:slug` route, so custom routes take
precedence over the public CMS catch-all. Do not store credentials in `.env`;
use the root-level `appsettings.json` file for local secrets, and keep the CMS
`db` pool for standard application data access.

Custom code is application code and is not inspected or sandboxed by Radix.
Validate request data, enforce authorization where needed, and handle database
errors explicitly. Do not expose administrative tables or credentials through
public routes.

## MSSQL settings

The Westbank project-password feature reads its separate MSSQL connection from
the root-level `appsettings.json`. Copy
[`appsettings.example.json`](../appsettings.example.json) to `appsettings.json`
and set the `mssql` values. `appsettings.json` is ignored by Git because it
contains credentials.
