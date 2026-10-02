# Radix CMS User Guide

This guide explains how to use the current Radix CMS through the web
interface, and how to create templates and static pages as a developer.

## 0. Installing the application



## 1. Getting started

### Start the application

From the project folder:

```powershell
npm run dev
```

Open:

- Public site: `http://localhost:3000/`
- Administration: `http://localhost:3000/admin`

The port comes from `SITE_PORT` in `.env`.

### First installation

If the database is not configured, open `/admin/install`. The installer:

1. Tests the MySQL/MariaDB connection.
2. Saves the database settings to `.env`.
3. Creates the database schema.
4. Creates the first administrator account.
5. Redirects to the login page.

The `.env` file contains passwords and API keys. Keep it private and do not
commit it to source control.

## 2. Log in and understand permissions

Go to `/admin/login` and sign in with a user account.

Roles are ordered from least to most powerful:

```text
Unregistered < Registered < Editor < Manager < Administrator
```

Current permissions are:

| Role | Typical access |
| --- | --- |
| Unregistered | Public pages only |
| Registered | Pages requiring registered-user access |
| Editor | Dashboard, create/edit pages, upload media, view themes and updates |
| Manager | Same route access as Editor in the current implementation |
| Administrator | All Editor features plus users, settings, media deletion, and applying updates |

A page's **Minimum Access Role** controls who may view a database-backed dynamic
page. The visitor must be logged in with that role or a higher role.

## 3. Create a dynamic page

A dynamic page is stored in the `pages` database table. Its content, status,
access level, and selected template can be changed through the admin interface.

1. Log in as an Editor or Administrator.
2. Open **Pages**.
3. Click **Create New Page**.
4. Enter a **Title**, such as `Members Area`.
5. Enter a unique **Slug**, such as `members`.
   - The page URL will be `/members`.
   - Use letters, numbers, and hyphens.
   - Do not reuse a slug already assigned to another page.
6. Select a **Status**:
   - `Draft`: not normally visible to public visitors.
   - `Pending Review`: not normally visible to public visitors.
   - `Published`: visible when its publish date has arrived.
   - `Archived`: not normally visible to public visitors.
7. Select the **Minimum Access Role**.
8. Select a **Theme / Template**.
9. Enter the page content in the editor.
10. Click **Save Page**.

### Give a dynamic page access permissions

Use the **Minimum Access Role** field:

- `Unregistered`: anyone can view it.
- `Registered`: only logged-in registered users and higher roles.
- `Editor`: Editors, Managers, and Administrators.
- `Manager`: Managers and Administrators.
- `Administrator`: Administrators only.

The page must also be `Published`, and its `publish_at` date must not be in
the future. Editors and higher roles can see unpublished pages because they are
treated as staff by the current public route.

### Edit, archive, or delete a dynamic page

From **Pages**:

- Click **Edit** to change the title, slug, content, template, status, or role.
- Deleting a page first moves it to the trash by setting its status to
  `Deleted`.
- Use **Restore** to return a deleted page to `Draft`.
- Permanent deletion is available only to Administrators and cannot be undone.

## 4. Create a static page

A static page is an EJS file in `views/pages/`. It is useful when the page
needs custom HTML or custom server-rendered logic rather than ordinary CMS
content.

Create a file such as:

```text
views/pages/contact.ejs
```

Example:

```ejs
<%# theme: landing %>
<%# minRole: Registered %>
<h1>Contact Us</h1>
<p>This page is rendered from views/pages/contact.ejs.</p>
<p>Email: support@example.com</p>
```

The optional first-line EJS comment selects the theme for this static page:

```ejs
<%# theme: landing %>
```

Use the theme directory name under `views/themes/`. The `theme` directive
overrides the database page's template, if a page with the same slug exists.
`layout` can be used as an equivalent directive for compatibility with
layout-oriented terminology. If the selected theme is not found, the default
theme is used.

Static pages can also require a minimum user role:

```ejs
<%# minRole: Registered %>
```

Supported roles are `Unregistered`, `Registered`, `Editor`, `Manager`, and
`Administrator`. If `minRole` is omitted, the page defaults to
`Unregistered`. Unauthenticated visitors are sent to the login page, while
authenticated users without sufficient privileges receive a forbidden response.

After restarting the application, visit:

```text
http://localhost:3000/contact
```

The public router checks `views/pages/<slug>.ejs` before checking the database.
Therefore, `views/pages/contact.ejs` takes priority over a database page whose
slug is `contact`.

### Important: static-page permissions

Static page access is controlled by the optional `minRole` directive in the
file. Checking `user` in the EJS file only hides HTML; it does not reliably
protect the URL or data.

For a protected page, use a dynamic page and set its minimum role, or add a
dedicated Express route with role middleware in the application source. The
reusable role middleware is in `src/middleware/auth.ts`.

## 5. Create a theme/template

In the current CMS, a selectable template is an EJS file named `index.ejs`
inside a directory under `views/themes/`.

Create this structure:

```text
views/
  themes/
    marketing/
      index.ejs
      assets/
        css/
          style.css
```

Example `views/themes/marketing/index.ejs`:

```ejs
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
    <link rel="stylesheet" href="/themes/<%= currentTheme %>/assets/css/style.css">
</head>
<body>
    <header>
        <a href="/"><%= siteName || 'Radix' %></a>
    </header>

    <main>
        <h1><%= title %></h1>
        <%- content %>
    </main>
</body>
</html>
```

Example `views/themes/marketing/assets/css/style.css`:

```css
body {
    max-width: 900px;
    margin: 0 auto;
    font-family: sans-serif;
}
```

### Apply the template to a page

1. Restart the application if necessary.
2. Open **Admin > Themes** to confirm that `marketing` was discovered.
3. Create or edit a dynamic page.
4. Select `Marketing` in **Theme / Template**.
5. Save the page.
6. Visit the page URL.

The theme scanner discovers directories under `views/themes/`. The public
renderer then loads `views/themes/<template_name>/index.ejs`.

### Template variables

Dynamic themes currently receive values including:

```text
title          Page title
content        Saved HTML content
page            Complete database page object
user            Logged-in user, or undefined
currentTheme   Selected template name
siteName       APP_NAME from environment
appVersion     Current application version
```

Use `<%= value %>` for escaped text. Use `<%- content %>` only for trusted HTML
that should be rendered as markup. The current CMS stores rich-text HTML and
the default theme renders it unescaped.

## 6. Create and manage users

Only an Administrator can manage users.

1. Open **Admin > Users & Roles**.
2. Complete **Create New User**:
   - **Username**: required and unique.
   - **Full Name**: optional.
   - **Email**: optional, but must be unique when supplied.
   - **Password**: required.
   - **Role**: choose the user's highest allowed role.
3. Click **Add User**.

Passwords are stored as bcrypt hashes, not as plain text.

### Edit a user

Click **Edit** beside a user to change:

- Full name
- Username
- Email
- Role
- Password

Leave **New Password** blank to keep the current password. Changing your own
role updates the current session's role as well.

### Delete a user

Click **Delete** beside the account. The currently logged-in administrator
cannot delete their own active account.

## 7. Media uploads

Editors and Administrators can open **Admin > Media Library**.

1. Choose an image file.
2. Upload it.
3. Use its `/uploads/<filename>` URL in page content or settings.

The current upload limit is 10 MB. Supported image types are JPG, PNG, GIF,
WEBP, and SVG. Administrators can delete media files.

## 8. Site settings

Administrators can open **Admin > Settings** to configure:

- Site logo path or URL
- SMTP host, port, encryption, username, and password
- Sender email address
- Test email delivery

Settings are stored in the database. Database connection details and secrets
remain in `.env`.

## 9. Troubleshooting

### My page shows the wrong content

Check whether `views/pages/<slug>.ejs` exists. A static file overrides the
database page with the same slug.

### My new template is not listed

Confirm the file is exactly:

```text
views/themes/<name>/index.ejs
```

Then restart the application and refresh the admin page.

### My page is not visible publicly

For a dynamic page, check:

1. Status is `Published`.
2. `publish_at` is not in the future.
3. The visitor's role meets **Minimum Access Role**.
4. No static override is interfering.

### Source changes do not appear

Use `npm run dev` during development. For production-style execution, rebuild
before starting:

```powershell
npm run build
npm run app
```

The `dist/` folder is generated output and should not be edited directly.
