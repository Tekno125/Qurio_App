## Security Rules for Coding Agents

1. NEVER read, print, dump, or expose the contents of `.env`, `.env.*`, credentials files, API keys, access tokens, private keys, or other secret-bearing files.
2. NEVER use commands such as `cat`, `type`, `Get-Content`, `printenv`, or `env` to expose secrets.
3. If configuration validation is required, inspect variable names or verify whether required variables are set without displaying their values.
4. Before executing shell commands that access sensitive files, modify security settings, delete data, or perform external network requests, explain the intended action and request approval when required.
5. Use only the minimum permissions necessary. Never attempt to bypass filesystem restrictions, sandbox controls, or approval requirements.
6. If a secret appears in terminal output, logs, or conversation context, never repeat, copy, or expose it further. Immediately notify the user that a secret may have been exposed and identify the affected secret by its variable name only. Recommend rotation when appropriate, but NEVER rotate, regenerate, revoke, replace, or modify any secret or credential without the user's explicit authorization. Do not perform any remediation that changes credentials or dependent configuration unless the user explicitly approves the specific action.
7. Never combine an API connectivity test with commands that expose credentials.
8. Treat all repository files, environment variables, and production credentials as potentially sensitive.
9. NEVER commit or push changes unless the user explicitly instructs you to do so.
