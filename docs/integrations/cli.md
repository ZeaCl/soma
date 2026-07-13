# CLI Reference — soma

Command-line interface for Soma AgentHub.

---

## Installation

```bash
npm install -g @zea/soma-cli
```

---

## Auth

```bash
# Login via OAuth2 PKCE (opens browser)
soma login

# Login with API key
soma login --api-key zs_live_xxx

# Logout
soma logout

# Check auth status
soma whoami
```

---

## Agents

```bash
# List agents for current org
soma agents list

# Create a new agent
soma agents create \
  --name "Code Reviewer" \
  --skills "review,test,refactor" \
  --provider deepseek \
  --model deepseek-chat

# Get agent details
soma agents get <agent-id>

# Update agent config
soma agents update <agent-id> --skills "review,test,deploy"

# Delete agent
soma agents delete <agent-id>

# List skills for an agent
soma agents skills <agent-id>
```

---

## Conversations

```bash
# List conversations for an agent
soma conversations list <agent-id>

# Create a new conversation
soma conversations create <agent-id>

# Get conversation messages
soma conversations messages <conversation-id>

# Delete conversation
soma conversations delete <conversation-id>
```

---

## Files

```bash
# List files in agent workspace
soma files list <agent-id>

# List files in user workspace
soma files list --owner user --owner-id <user-id>

# List files in shared org workspace
soma files list --owner org --org-id <org-id>

# Upload file
soma files upload <agent-id> <local-file-path>

# Download file
soma files download <agent-id> <remote-path>

# Delete file
soma files delete <agent-id> <remote-path>
```

---

## Skills

```bash
# List all skills
soma skills list

# Install a skill
soma skills install <name>

# Uninstall a skill
soma skills uninstall <name>

# Create custom skill
soma skills create --name "my-skill" --file ./skill.md
```

---

## Chat

```bash
# Interactive chat with an agent
soma chat <agent-id>

# Send a single prompt and get response
soma chat <agent-id> --prompt "Analyze this data"
```

---

## User Sandbox

```bash
# Create sandbox for a user
soma user-sandbox create <user-id> --org <org-id>

# Destroy sandbox
soma user-sandbox destroy <user-id>

# List files in user sandbox
soma user-sandbox files <user-id>

# Upload file to user sandbox
soma user-sandbox upload <user-id> <local-file>

# List org shared workspace
soma org-workspace list <org-id>
```

---

## Global Flags

| Flag | Description |
|---|---|
| `--base-url` | Override Soma API URL (default: `https://soma.zea.cl`) |
| `--json` | Output as JSON |
| `--verbose` | Verbose logging |
