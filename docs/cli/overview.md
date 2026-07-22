# CLI Reference — `zea-soma`

The Soma CLI provides command-line access to all agent management, chat, files, and skills operations.

## Install

```bash
npm install -g @zea/soma-cli
# or from monorepo:
cd soma/cli && npm link
```

## Commands

### Health

```bash
zea-soma health
# ✅ Soma AgentHub — Status: ok — Service: soma
```

### Agent Management

```bash
zea-soma agent list                         # List agents
zea-soma agent show <id>                    # Agent details
zea-soma agent create --name "Bot" --skills xyz  # Create agent
zea-soma agent config <id> --model deepseek # Update config
zea-soma agent delete <id>                  # Delete agent
zea-soma agent share <id> --with <user>     # Share agent
zea-soma agent unshare <id> --user <user>   # Unshare
zea-soma agent shares <id>                  # List shares
```

### Chat

```bash
zea-soma chat <agent-id>                    # Interactive chat
zea-soma chat <agent-id> -p "Hello"         # One-shot prompt
zea-soma chat <agent-id> --continue <id>    # Resume conversation
cat file.txt | zea-soma chat <id> -p "summarize"  # Pipe stdin
```

### Skills

```bash
zea-soma skill list                         # List skills
zea-soma skill show <name>                  # Show skill content
zea-soma skill create --name "my" --file ./SKILL.md
zea-soma skill edit <name> --file ./SKILL.md
zea-soma skill delete <name>
zea-soma skill assign <name> --agents a,b   # Assign to agents
```

### Conversations

```bash
zea-soma conv list                          # List conversations
zea-soma conv show <id>                     # Show messages
zea-soma conv delete <id>                   # Delete
```

### Sandbox & Files

```bash
zea-soma sandbox create <id> --org <org> --type user|agent
zea-soma sandbox destroy <id> --type user|agent
zea-soma sandbox files <id> --type user|agent [--path <subpath>]

zea-soma files list --user <id> | --agent <id> | --org <id>
zea-soma files upload <file> --user <id> [--path <dir>]
zea-soma files read <path>
zea-soma files delete <path>
zea-soma files mkdir <path>
zea-soma files rename <path> --new-name <name>
zea-soma files move <src> <dst>
zea-soma files history <path>
zea-soma files recover <path> --commit <hash>
zea-soma files push
```

### API Keys & Diagnostics

```bash
zea-soma api-key create --name "CI Pipeline"
zea-soma doctor                              # Full diagnostic (10 checks)
```

## Global Options

| Flag | Description |
|---|---|
| `--token <token>` | Bearer token (or use `ZEA_TOKEN` env) |
| `--base-url <url>` | Soma URL (default: `http://soma.zea.localhost`) |
| `--json` | Machine-readable JSON output |
| `--zea-discover` | Metadata for zea-cli dynamic discovery |

## Auth

The CLI reads auth from `~/.config/zea/config.json` (set by `zea login`). Falls back to `ZEA_TOKEN` env var.

## Dynamic Discovery

`zea-cli` discovers `zea-soma` via PATH and delegates subcommands:

```bash
zea soma agent list   # → delegates to zea-soma agent list
zea soma chat bot     # → delegates to zea-soma chat bot
```
