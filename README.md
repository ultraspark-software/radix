# Radix CMS

Radix CMS is a Node.js and TypeScript content management system for building
custom websites and web applications. It provides a public site, an
administration panel, database-backed pages, users and roles, media uploads,
themes, and site settings.

## Features

- Public pages rendered with Express and EJS
- Admin dashboard at `/admin`
- MySQL/MariaDB database storage
- Page drafts, publishing, archiving, and access roles
- User roles: Registered, Editor, Manager, and Administrator
- Media uploads
- EJS themes and static pages
- Email and site settings
- Update checking from the admin panel

## Requirements

- Node.js 18 or newer
- npm
- MySQL 8+ or MariaDB

## Installation

Clone or download the project, then install its dependencies:

```powershell
npm install
```

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and a strong session secret. Do not
commit `.env` or share it publicly.

Start the development server:

```bash
npm run dev
```

Open the public site at <http://localhost:3000/> and the administration panel
at <http://localhost:3000/admin>.

## First-time setup

If the database settings are incomplete or the database is unavailable, Radix
redirects to <http://localhost:3000/admin/install>.

The installer:

1. Tests the MySQL/MariaDB connection.
2. Saves the database settings to `.env`.
3. Creates the database schema and default content.
4. Creates the first Administrator account.
5. Redirects to the admin login page.

Use the credentials created during setup to sign in at `/admin/login`.

## Configuration

The main environment variables are:

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_NAME` | Application name shown by the site | `Radix` |
| `APP_VERSION` | Application version | `0.12.0` |
| `SITE_URL` | Site URL used by the application | `localhost` |
| `SITE_PORT` | HTTP port | `3000` |
| `DB_HOST` | MySQL/MariaDB host | `127.0.0.1` |
| `DB_PORT` | MySQL/MariaDB port | `3306` |
| `DB_USER` | Database user | - |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `radix` |
| `SESSION_SECRET` | Secret used to sign sessions | — |
| `THEME` | Active theme name | `default` |
| `STATUS` | Site status setting | `live` |
| `MAIL_HOST` | SMTP server host | - |
| `MAIL_PORT` | SMTP server port | - |
| `MAIL_SECURE` | Whether SMTP uses TLS | - |
| `MAIL_USER` | SMTP username | - |
| `MAIL_PASS` | SMTP password | - |
| `TINYMCEAPI` | Optional TinyMCE API key | - |

The admin settings screen can also manage application settings after the
initial installation.

## npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the TypeScript application with file watching |
| `npm run build` | Compile TypeScript into `dist/` and copy the SQL schema |
| `npm start` | Build the application and start the compiled server |
| `npm run app` | Start the already-compiled server |

For a production deployment, build once with `npm run build`, set production
environment variables, and run the compiled application with `npm run app`.

## Customization

### Themes

Public themes are stored in `views/themes/`. A theme can contain an EJS
template and assets such as CSS and JavaScript. Theme assets are available
under `/themes/<theme-name>/`.

### Static pages

Static EJS pages can be added to `views/pages/`. For example,
`views/pages/contact.ejs` can provide a custom `/contact` page.

### Dynamic pages

Editors and Administrators can create database-backed pages from the **Pages**
screen. Each page has a title, slug, status, access role, template, and
editable content.

More detailed user and developer documentation is available in:

- [`docs/CMS_USER_GUIDE.md`](docs/CMS_USER_GUIDE.md)
- [`docs/CMS_CODE_GUIDE.md`](docs/CMS_CODE_GUIDE.md)

## Production and security notes

- Use a long, random `SESSION_SECRET`.
- Never commit `.env`, database passwords, SMTP credentials, or API keys.
- Run behind HTTPS in production.
- Use a dedicated database user with only the permissions Radix requires.
- Back up the database and uploaded media regularly.
- Review uploaded files and server permissions before exposing the application
  to the public internet.
- The default Express session store is intended for development. Use a
  production-ready session store for multi-instance or high-traffic
  deployments.

## Troubleshooting

### The application redirects to `/admin/install`

Check that `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are present in
`.env`, and verify that MySQL/MariaDB is running and reachable.

### The server starts but pages or templates are missing

Run:

```bash
npm run build
```

The compiled application expects the `views/`, `public/`, and generated
`dist/sql/radix.sql` files to be available.

## Contributing

Bug reports and feature requests are welcome through the project's GitHub
Issues page. Please include the Radix version, Node.js version, database
engine/version, reproduction steps, and relevant logs. Never include secrets
from `.env` in an issue.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
Copyright © 2026 Ultra Spark Software