# Agent Runbook

This repository hosts the custom Oracle Database node for n8n. Use this document to guide local development and server deployment.

## Local Development

1. Install dependencies with `npm install`.
2. Implement changes in `nodes/Oracle/OracleDatabase.node.ts` and supporting files.
3. Keep the node's `description.version` in sync with `package.json`.
4. Run `npm run build` to compile TypeScript and refresh the `dist/` bundle.
5. Validate core behaviours:
   - Single-statement SQL executes with and without trailing semicolons.
   - Parameter collections bind values correctly, including the `parseInStatement` expansion.
   - Errors throw `NodeOperationError`; when `Continue On Fail` is enabled the node emits an error item in the lone output stream.
6. Update documentation (`README.md`, `AGENTS.md`) whenever workflows change.

## Git Workflow

1. Check pending changes with `git status`.
2. Stage files using `git add ...`.
3. Commit with descriptive messages, e.g. `git commit -m "feat(nodes/Oracle): add feature"`.
4. Push to GitHub: `git push origin HEAD`.

## Deploying to the n8n Server

The production instance lives on `n8n.fardana.com` and runs via Docker Compose stored at `/home/angga/n8n/`.

1. Update the server workspace:
   ```bash
   ssh n8n.fardana.com "cd /home/angga/n8n-nodes-oracle-database-parameterization && git fetch --all && git reset --hard origin/main"
   ssh n8n.fardana.com "cd /home/angga/n8n-nodes-oracle-database-parameterization && npm run build"
   rsync -a --delete --exclude '.git' --exclude 'node_modules' \
     n8n.fardana.com:/home/angga/n8n-nodes-oracle-database-parameterization/ \
     n8n.fardana.com:/home/angga/dist-oracle-node/
   ```
2. Refresh the container copy and install production dependencies:
   ```bash
   ssh n8n.fardana.com "cd /home/angga/n8n && docker compose exec n8n sh -lc 'rm -rf /home/node/.n8n/custom/n8n-nodes-oracle-database-parameterization'"
   ssh n8n.fardana.com "cd /home/angga && docker compose -f n8n/docker-compose.yaml cp dist-oracle-node n8n:/home/node/.n8n/custom/n8n-nodes-oracle-database-parameterization"
   ssh n8n.fardana.com "cd /home/angga/n8n && docker compose exec n8n sh -lc 'cd /home/node/.n8n/custom/n8n-nodes-oracle-database-parameterization && npm install --omit=dev'"
   ssh n8n.fardana.com "cd /home/angga/n8n && docker compose restart n8n"
   ```
3. Verify logs: `ssh n8n.fardana.com "cd /home/angga/n8n && docker compose logs n8n --tail=50"`.

## Troubleshooting

- Oracle driver errors include native messages. When rethrowing, include the offending query in the `NodeOperationError` description.
- If the container fails to restart, rerun the `npm install --omit=dev` step and retry the restart.
- For new dependencies, update both `package.json` and `package-lock.json` before building.

Keep this document current whenever workflows change.
