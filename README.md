# whatJs

whatJs is a small web interface and Node.js backend that integrates with WhatsApp Web via whatsapp-web.js to manage sessions and send messages from a server-backed UI. The repository contains a front-end (index.php, script.js, style.css) and a Node.js server (server.js) that handles WhatsApp sessions and persistence (sessions.json).

Repository: https://github.com/th3gh0s8/whatJs

---

## Features

- Web UI to manage WhatsApp sessions and interact with a WhatsApp client
- Uses whatsapp-web.js to connect to WhatsApp Web
- Session persistence in `sessions.json` to avoid re-scanning QR codes
- Front-end assets in `index.php`, `script.js`, and `style.css`
- Development scripts available (nodemon configuration included)

---

## Quick Start

Prerequisites:
- Node.js (14+ recommended)
- npm
- A phone with WhatsApp for scanning the QR code (first-time setup)

1. Clone the repository
   ```
   git clone https://github.com/th3gh0s8/whatJs.git
   cd whatJs
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Run the server
   - For production:
     ```
     node server.js
     ```
   - For development (auto-restart on change, if you use nodemon):
     ```
     npx nodemon server.js
     ```
   - Or use whatever start script is configured in `package.json`:
     ```
     npm start
     ```

4. Open the web UI in your browser:
   - Default: http://localhost:PORT
   - The port is set inside `server.js` (commonly `3000` or from `process.env.PORT`).

5. Scan the QR code with WhatsApp (if prompted) and the session will be stored in `sessions.json`.

---

## Configuration

- sessions.json
  - Stores session data for clients so re-authentication is not required on every restart.
  - Important: Do NOT commit production session files or credentials to public repositories.

- Environment variables (common options; check `server.js` for exact names)
  - `PORT` — Port to run the server on (default often 3000)
  - `NODE_ENV` — `development` or `production`
  - Any other environment variables required by your deployment (check `server.js`)

---

## Files & Structure

- `server.js` — Node.js server. Sets up the express server, integrates whatsapp-web.js, and manages sessions.
- `index.php` — Front-end entry (serves the UI). The project mixes a PHP front-end with a Node backend; ensure your server setup supports this workflow (or the `index.php` can be served as static HTML depending on deployment).
- `script.js` — Front-end JS controlling the UI and communicating with the Node backend.
- `style.css` — Styling for the UI.
- `sessions.json` — Session storage for whatsapp-web.js clients (contains serialized session info).
- `package.json` & `package-lock.json` — Node dependencies and lockfile.
- `nodemon.json` — Configuration used for development live-reload.

---

## Dependencies (high level)

Based on the repository and recent updates, the project uses:
- whatsapp-web.js — WhatsApp Web API wrapper
- express — HTTP server
- ws, tar-fs, qs, and other supporting packages (see `package.json` for the full list)

Recent commit messages show dependency updates (for example `whatsapp-web.js`, `express`, `ws`, etc.). Check `package.json` for exact versions.

---

## Deployment & Security Notes

- Session storage:
  - `sessions.json` contains authentication/session data for WhatsApp sessions. Keep this file secure and out of public repositories.
  - In production, store sessions in a protected store (database, encrypted file, or secret store).

- HTTPS / Reverse Proxy:
  - It's recommended to run the Node server behind a reverse proxy (e.g., Nginx) which handles TLS termination and forwarding.
  - Some commits indicate conditional HTTPS handling; prefer letting a reverse proxy manage HTTPS.

- Data privacy:
  - Be mindful of message content and personal data. Only use this project where compliant with WhatsApp's terms and local laws.

---

## Troubleshooting

- QR code does not appear / client does not connect:
  - Check server logs for errors from whatsapp-web.js
  - Ensure the phone is connected to the internet and WhatsApp is operational
  - Delete or move `sessions.json` (if corrupt) and try re-authenticating

- Sessions do not persist after restart:
  - Ensure `sessions.json` is writable by the server process and the session data is being saved successfully.

- Port already in use:
  - Set `PORT` env variable to an unused port or stop any process using the configured port.

---

## Development

- Use `nodemon` for faster development: `npx nodemon server.js` (project includes `nodemon.json`)
- Edit front-end files (`index.php`, `script.js`, `style.css`) and backend (`server.js`) as needed.
- Run `npm install` after changing dependencies.

---

## Contributing

Contributions are welcome. Suggested workflow:
- Fork the repo
- Create a feature branch
- Open a PR with a clear description and testing steps

Please avoid committing sensitive session data or private keys.

---

## License

No license is specified in the repository. If you plan to share this project, consider adding a LICENSE file (e.g., MIT) to clarify usage rights.

---

## A quick note on what I looked at

I inspected the repository files (server.js, script.js, index.php, style.css, sessions.json, package.json, and others) and recent commits (dependency bumps and production/development changes). The commit list I reviewed may be incomplete because of API paging limits — you can view more commits here:
https://github.com/th3gh0s8/whatJs/commits?per_page=5

If you'd like, I can also add a CONTRIBUTING.md or SECURITY.md.
