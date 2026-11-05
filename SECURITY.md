# Security Policy

## Reporting a vulnerability

If you find a security issue in Civic Tracker, please do not open a public issue.
Report it privately through GitHub: open the Security tab of this repository and choose "Report a vulnerability".

Please include:
- a short description of the issue,
- the steps to reproduce it,
- the possible impact.

We will reply as soon as possible and fix confirmed issues.

## What we do to keep data safe

- Row-level security is enabled on every database table.
- Phone numbers and WhatsApp numbers are column-restricted and never shown publicly.
- Anonymous reporting hides the reporter's name.
- API keys and service keys are kept on the server as secrets and are never committed to this repository.
- The main admin email is read from environment configuration and is never hard-coded in the source code.
- User data (accounts, complaints, photos, locations, comments) is stored only in the database and storage, never in this repository.
