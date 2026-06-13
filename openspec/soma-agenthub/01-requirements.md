# Requirements Document — Soma AgentHub v2

## Introducción

Soma AgentHub es la plataforma de ZEA para crear, configurar, y operar agentes de IA como ciudadanos de primera clase en la infraestructura. Cada agente es un usuario Linux real con su propio `$HOME`, UID, grupos, y sandbox aislado a nivel de kernel. Los agentes pueden usar distintos motores de IA — Pi, ReAct, OpenCode, Hermes, Goose — intercambiables por configuración sin cambiar el protocolo ni el cliente. Un CLI unificado (`soma-agent`) permite crear, configurar y destruir agentes desde la terminal, ideal para flujos CI/CD y developer experience. El SDK (`@zea/soma-sdk`) es portable: funciona en cualquier app React, con o sin infraestructura ZEA.

### Propósito

Proveer una plataforma multi-tenant, multi-engine, y kernel-isolated para equipos de desarrollo y empresas que necesitan agentes de IA operando con la misma seguridad y aislamiento que usuarios humanos.

### Scope

- Creación y gestión de agentes como usuarios Linux reales
- Sandbox con aislamiento a nivel de kernel (`chmod 700`, bind mounts, grupos)
- Múltiples motores de IA: Pi, ReAct, OpenCode, Hermes, Goose
- Protocolo WebSocket unificado (init → ready → prompt → delta/thinking → done)
- CLI (`soma-agent`) para toda la gestión de agentes
- SDK React portable (`@zea/soma-sdk`) sin dependencias ZEA obligatorias
- Landing page que comunica DX para developers y escala para empresas
- Multi-tenancy: organizaciones, equipos, API keys scoped
- Persistencia de conversaciones, mensajes, y thinking
- Skills built-in y custom, asignables a agentes
- Health check automatizado de 13 capas (`doctor-soma.sh`)

### Value Proposition

**Para developers**: un comando crea un agente con su sandbox aislado. Sin YAML, sin dashboards, sin configurar permisos manualmente. El kernel lo garantiza.

**Para empresas**: cada agente es un usuario Linux. Los de finanzas no pueden leer los archivos de los de ingeniería. Los mounts compartidos usan grupos. Escala de 1 a 1000 agentes sin cambiar la arquitectura.

---

## Requirements

### Requirement 1: Multi-Engine Agent Sessions

**User Story:** As a platform operator, I want each agent to use a configurable AI engine so that I can choose the best engine for each task without changing the client or protocol.

#### Acceptance Criteria

1. WHEN an agent configuration specifies `engine: "pi"` THEN the system SHALL create a session using the Pi engine via `@earendil-works/pi-coding-agent`

2. WHEN an agent configuration specifies `engine: "react"` THEN the system SHALL create a session using the ReAct engine

3. WHEN an agent configuration specifies `engine: "opencode"` THEN the system SHALL create a session using the OpenCode engine

4. WHERE an agent configuration does not specify an engine THEN the system SHALL default to `engine: "pi"`

5. IF an agent specifies an unknown engine name THEN the system SHALL return error `"Unknown engine: {name}"` and SHALL NOT create a session

6. WHILE two agents with different engines are connected simultaneously THEN the system SHALL route each to its respective engine without interference

7. WHEN a new engine is registered via `EngineRegistry.register(name, engine)` THEN the system SHALL make it available for agent sessions immediately without restart

8. IF an engine throws an error during `createSession()` THEN the system SHALL send `{type: "error", message: "..."}` to the client and SHALL NOT crash the server

### Requirement 2: OS-Level Sandboxes

**User Story:** As a security-conscious operator, I want each agent to run as a real Linux user with kernel-enforced isolation so that no agent can access another agent's files, even if the AI is compromised.

#### Acceptance Criteria

1. WHEN an agent is created THEN the system SHALL execute `useradd soma-{agentId}` creating a real Linux user with its own UID, home directory at `/home/soma/{agentId}`, and shell `/bin/bash`

2. WHEN the agent's home directory is created THEN the system SHALL set permissions to `chmod 700` so that only the agent's UID can read, write, or list its contents

3. WHEN agent A attempts to read `/home/soma/{agentB}/` THEN the Linux kernel SHALL deny access with `Permission denied` without any application-level check

4. WHEN the agent executes tools (`bash`, `edit`, `write`) THEN the engine SHALL run the command via `sudo -u soma-{agentId}` so that all filesystem operations are performed with the agent's UID

5. WHEN a shared directory mount is configured THEN the system SHALL execute `mount --bind {source} {home}/shared` making the shared volume visible inside the agent's sandbox

6. IF a mount is configured as read-only THEN the system SHALL pass `-o ro` to `mount --bind` and the kernel SHALL prevent write operations

7. WHEN an agent is destroyed THEN the system SHALL execute `userdel -r soma-{agentId}` removing the user and its home directory, and SHALL unmount all bind mounts

8. WHEN an agent is assigned to a team or organization THEN the system SHALL add the agent's Linux user to the corresponding group via `usermod -aG`

9. WHERE multiple agents belong to the same organization THEN the system SHALL allow them to access shared volumes via group permissions (`chmod 770`, group ownership)

10. IF a `chroot` is enabled for an agent THEN the system SHALL restrict the agent's process to its home directory tree

### Requirement 3: CLI (soma-agent)

**User Story:** As a developer, I want a single CLI command to create, configure, and destroy agents so that I can integrate agent management into my shell workflows and CI/CD pipelines.

#### Acceptance Criteria

1. WHEN the user runs `soma-agent agent create --name "..." --engine pi` THEN the system SHALL create the agent in Thalamus, create the Linux user, set up the home directory, apply permissions, configure bind mounts, and output the agent ID

2. WHEN the user runs `soma-agent agent list` THEN the system SHALL display all agents in the current organization with their ID, name, engine, and status

3. WHEN the user runs `soma-agent agent config set {id} --engine opencode` THEN the system SHALL update the agent's configuration and the change SHALL take effect on the next WebSocket session

4. WHEN the user runs `soma-agent agent sandbox exec {id} "command"` THEN the system SHALL execute the command as the agent's Linux user and return stdout/stderr

5. WHEN the user runs `soma-agent agent destroy {id}` THEN the system SHALL remove the agent from Thalamus, execute `userdel -r`, unmount bind mounts, and return confirmation

6. WHEN the user runs `soma-agent conversation chat {id}` THEN the system SHALL open an interactive WebSocket chat session in the terminal with streaming responses

7. WHEN the user runs `soma-agent doctor run` THEN the system SHALL execute the 13-layer health check and report all results

8. WHERE `--json` flag is passed THEN the system SHALL output machine-parseable JSON instead of human-readable text

9. IF the user is not authenticated THEN the system SHALL display "Ejecutá: soma-agent auth login" and exit with code 1

10. WHEN `--ttl 2h` is specified on agent creation THEN the system SHALL automatically destroy the agent after the TTL expires

### Requirement 4: Agent Configuration Injection

**User Story:** As a platform operator, I want each agent's configuration (system prompt, skills, tools, engine, mounts) to be loaded from an external service and injected at session creation time.

#### Acceptance Criteria

1. WHEN a WebSocket session is initialized with `{type: "init", uid: agentId}` THEN the system SHALL fetch the agent's configuration from the identity service (Thalamus or equivalent)

2. IF the identity service is unreachable THEN the system SHALL fall back to the local config file at `/root/.agents/agent-configs/{userId}.json`

3. WHEN the configuration is loaded THEN the system SHALL inject `system_prompt`, `skills`, `tools`, `engine`, and `workspace_paths` into the session

4. IF the configuration specifies `tools: ["read", "bash"]` THEN the agent SHALL only have access to `read` and `bash` tools (not `edit` or `write`)

5. WHEN the agent configuration is updated via the API THEN the system SHALL increment `skillsVersion` and invalidate cached configs, forcing fresh reload on next session

6. WHERE a skill name in the configuration does not exist on disk THEN the system SHALL log a warning and skip that skill without preventing session creation

### Requirement 5: SDK Portability

**User Story:** As a frontend developer integrating Soma into my own React app, I want to import GliaChat with minimal dependencies so that I can embed agent chat without depending on ZEA infrastructure or design system.

#### Acceptance Criteria

1. WHEN a developer runs `npm install @zea/soma-sdk` THEN the system SHALL install only `react` and `react-dom` as peer dependencies

2. WHEN a developer imports `import '@zea/soma-sdk/styles/base.css'` THEN the GliaChat component SHALL render correctly without loading `zea-design.css`

3. WHEN a developer passes `wsPath: "/custom-ws"` to `useGlia` THEN the WebSocket SHALL connect to `{baseUrl}{wsPath}` instead of the default `/agent-ws`

4. WHEN a developer passes `authHeaders: () => ({Authorization: "Bearer token"})` THEN all API requests SHALL include those headers instead of `x-api-key`

5. WHEN a developer passes `apiPrefix: "/api/v2"` to API hooks THEN all REST calls SHALL use that prefix instead of `/api/v1`

6. WHEN the CSS variables `--zea-*` are not defined in the host application THEN the SDK SHALL fall back to `--glia-*` variables defined in `base.css`

7. WHEN a developer creates a custom `SandboxProvider` and passes it to `GliaFileBrowser` THEN the file browser SHALL use that provider instead of making REST calls

8. IF a developer passes `agentConfig` directly to `GliaChat` THEN the component SHALL use that configuration without contacting an identity service

### Requirement 6: Landing Page & Developer Experience

**User Story:** As a prospective user visiting the Soma landing page, I want to immediately understand what Soma does and how it helps me as a developer or my company as an enterprise.

#### Acceptance Criteria

1. WHEN a user visits the landing page THEN the system SHALL display a hero section with a terminal preview showing `soma-agent agent create` in action

2. WHEN the user scrolls THEN the system SHALL display a "How it Works" section explaining the OS-level sandbox model with Linux user/permissions metaphor

3. WHEN the user reads the "For Developers" section THEN the system SHALL show CLI commands and a CI/CD code example

4. WHEN the user reads the "For Companies" section THEN the system SHALL show the filesystem hierarchy with `chmod 700` isolation and multi-tenant architecture

5. WHEN the user views the "Multi-Engine" section THEN the system SHALL display available engines (Pi, ReAct, OpenCode, Hermes, Goose) with ready/coming-soon status

6. IF the user clicks "Launch AgentHub" THEN the system SHALL redirect to the OAuth2 login flow

### Requirement 7: Multi-Tenancy & API Keys

**User Story:** As an enterprise admin, I want organizations to be fully isolated so that agents from Org A cannot access Org B's data, conversations, or skills.

#### Acceptance Criteria

1. WHEN an API request includes `x-api-key: zs_live_xxx` THEN the system SHALL resolve the organization from the key and scope all queries to that organization

2. IF an API key is invalid THEN the system SHALL return HTTP 401 with `{error: "unauthorized", detail: "invalid_api_key"}`

3. WHEN an organization creates a custom skill THEN other organizations SHALL NOT see or access that skill

4. WHEN an agent from Org A lists files THEN the system SHALL only return files within `/workspace/orgs/{orgA}/`

5. IF an API key has scopes `["soma:read"]` and a write operation is attempted THEN the system SHALL return HTTP 403

### Requirement 8: Conversations & Thinking Persistence

**User Story:** As a user chatting with an agent, I want the full conversation history and the agent's reasoning (thinking) to persist so that I can review past interactions.

#### Acceptance Criteria

1. WHEN a user sends a message THEN the system SHALL persist it in the `messages` table with `role: "user"`

2. WHEN an agent finishes responding THEN the system SHALL persist the assistant message with `role: "assistant"`, `content`, and `thinking` fields

3. WHEN a conversation is retrieved THEN the system SHALL return all messages in chronological order

4. WHEN the done event arrives in the browser THEN the thinking block SHALL remain visible as a collapsible section in the message bubble

5. IF the thinking toggle is clicked THEN the system SHALL expand or collapse the thinking content without removing it

6. WHEN a conversation is soft-deleted THEN the system SHALL hide it from the list but preserve messages in the database

### Requirement 9: Skills Management

**User Story:** As a platform operator, I want to create custom skills and assign them to agents so that agents can have domain-specific capabilities.

#### Acceptance Criteria

1. WHEN a skill is created via API THEN the system SHALL persist it to PostgreSQL and write a `SKILL.md` file to `/app/.pi-agent-skills/{name}/`

2. IF a custom skill has the same name as a builtin skill THEN the system SHALL override the builtin content with the custom content

3. WHEN a new skill directory appears in the custom skills filesystem THEN the system SHALL auto-discover and register it for the active agent

4. WHEN skills are assigned to an agent THEN the system SHALL sync the assignment to the identity service (Thalamus)

5. WHEN the skills watcher detects a change THEN the system SHALL increment the skills version, invalidating cached agent configs

---

## Non-Functional Requirements

### Performance
- WebSocket message delivery SHALL be under 1 second from engine event to client receipt
- Agent session creation SHALL complete within 10 seconds from init to ready
- Doctor script SHALL complete all 13 layers within 2 minutes

### Security
- Agent home directories SHALL be `chmod 700` — no other user can access
- API keys SHALL be stored as SHA-256 hashes, never in plaintext
- Bind mounts SHALL respect `ro` flag enforced by kernel
- Path traversal SHALL be blocked by kernel permissions, not application code

### Reliability
- Agent RPC process SHALL auto-restart on crash (start.sh supervision loop)
- Config cache SHALL be invalidated when Thalamus updates agent config
- WebSocket disconnect SHALL be handled gracefully — session persists for reconnection

### Compatibility
- SDK SHALL support React 18 and React 19
- CLI SHALL run on any system with bash + curl (no Node.js required)
- WebSocket protocol SHALL be engine-agnostic (same events for Pi, ReAct, OpenCode...)

---

## Edge Cases

- **Agent creation fails mid-way**: Linux user created but Thalamus registration failed → rollback `userdel`
- **Mount source directory doesn't exist**: Warn and skip mount, don't fail agent creation
- **Two agents with same name**: System SHALL append UUID suffix to Linux username
- **Agent home directory already exists**: System SHALL warn and reuse if same agent ID, fail if different
- **Engine crashes during streaming**: Send `{type: "error"}` to client, keep WebSocket open for reconnection
- **Thalamus unreachable, no local config**: Use builtin fallback prompt and all available skills from filesystem
- **Cancel received before response starts**: Skip persistence, send `{type: "cancelled"}`
- **WebSocket binary frames**: System SHALL handle `ArrayBuffer`, `Blob`, and string message types
- **Multiple prompts while streaming**: Queue or reject; SHALL NOT interleave responses
- **API key with no organization**: Reject with 401
- **Skill auto-discovery during agent session**: Invalidate config cache, force reload on next session
- **Bind mount source removed after agent creation**: Mount point becomes stale; system SHALL log warning and continue serving agent without that mount
- **Git repository corrupted in workspace**: System SHALL return error on history/recover operations without crashing
- **OAuth2 token expired during active session**: System SHALL return 401 on next API call; WebSocket session remains active until reconnection

---

### Requirement 10: Testing & Quality Assurance

**User Story:** As a quality engineer, I want comprehensive automated tests at every level so that I can confidently deploy Soma knowing that regressions are caught before reaching production.

#### Acceptance Criteria

1. WHEN the test suite runs THEN the system SHALL execute unit tests for all Elixir modules covering happy path, error handling, and edge cases

2. WHEN the test suite runs THEN the system SHALL execute integration tests verifying the full stack: Elixir API → PostgreSQL → Agent RPC → Engine → WebSocket response

3. WHEN the test suite runs THEN the system SHALL execute E2E Playwright tests in a headless browser validating the complete user flow from landing to multi-turn conversation

4. IF any E2E test fails THEN the system SHALL capture a screenshot at the point of failure and save it to `/tmp/soma-e2e/`

5. WHEN the E2E test completes THEN the system SHALL output browser console logs to `/tmp/soma-e2e/browser-logs.txt` for debugging

6. WHEN an E2E test validates agent response THEN the system SHALL verify: thinking block appears, text response appears, response persists for 5+ seconds, thinking toggle expands/collapses

7. WHEN an E2E test validates multi-turn THEN the system SHALL verify: both user messages visible, both assistant responses visible, both thinking blocks persist, no lost content warnings in logs

8. WHEN the doctor script runs THEN the system SHALL verify all 13 health check layers and exit with code 0 only if all checks pass

9. IF a WebSocket flow test fails THEN the system SHALL report which event was missing (init/ready/prompt/delta/thinking/done) and the actual event received

10. WHEN unit tests cover the OS sandbox module THEN the system SHALL mock `useradd`/`userdel`/`mount` calls and verify correct parameters are passed

11. WHEN integration tests cover the engine registry THEN the system SHALL create sessions with Pi and verify delta/thinking/done events are emitted in correct order

12. IF the doctor script detects a failure THEN the system SHALL report the exact layer, check name, and expected vs actual value

### Requirement 11: Workspace & Files API

**User Story:** As a developer managing agent workspaces, I want a full CRUD API for files with Git history so that I can track changes, recover previous versions, and audit modifications.

#### Acceptance Criteria

1. WHEN a file is uploaded THEN the system SHALL persist it to the organization's workspace and execute `git commit` with message `"write: {path}"`

2. WHEN a file is deleted THEN the system SHALL execute `git rm` and commit with message `"delete: {path}"`

3. WHEN directory history is requested THEN the system SHALL return up to 10 recent Git commits with hash and message

4. WHEN a file recovery is requested with a commit hash THEN the system SHALL execute `git checkout {hash} -- {path}` and commit the recovery

5. IF a directory is not empty THEN the system SHALL reject deletion with error `"directory_not_empty"`

6. WHEN a path traversal attempt is detected (e.g., `../../etc/passwd`) THEN the system SHALL reject with error `"path_traversal"`

7. WHEN the workspace is pushed THEN the system SHALL execute `git push origin main` if a remote is configured

8. WHERE an AGENTS.md file exists in the workspace THEN the system SHALL load and resolve file references embedded in the markdown

### Requirement 12: WebSocket Session Lifecycle

**User Story:** As a platform operator, I want robust WebSocket session management so that agents can reconnect, cancel mid-stream, and run multiple sessions simultaneously without interference.

#### Acceptance Criteria

1. WHEN a WebSocket client disconnects and reconnects with the same conversation ID THEN the system SHALL reattach to the existing session via `SessionManager.continueRecent`

2. WHEN a cancel message is received during an active prompt THEN the system SHALL call `session.abort()`, send `{type: "cancelled"}`, and persist any partial response with `"⏹️ Cancelado"` suffix

3. WHEN two WebSocket connections with different agent IDs send prompts simultaneously THEN the system SHALL process them independently without interleaving events

4. IF a prompt is received before the session is ready (no `ready` event sent yet) THEN the system SHALL queue the prompt in `pendingRef` and flush when ready arrives

5. WHEN the WebSocket connection is closed THEN the system SHALL set `isConnected: false` and log the disconnection

6. IF the engine emits an error during prompt processing THEN the system SHALL send `{type: "error", message: "..."}` to the client and SHALL NOT crash the WebSocket server

### Requirement 13: Auth & Identity Service Abstraction

**User Story:** As an enterprise architect, I want the identity service to be pluggable so that I can swap Thalamus for another OAuth2/JWT provider without changing the agent runtime.

#### Acceptance Criteria

1. WHEN a JWT token is presented THEN the system SHALL validate it against the JWKS endpoint of the configured identity service

2. IF the JWKS endpoint is unreachable THEN the system SHALL reject the token with HTTP 401

3. WHEN a PAT token (th_pat_live_...) is presented THEN the system SHALL validate it against the identity service's token introspection endpoint

4. WHERE the JWT claims include `domain_roles` THEN the system SHALL resolve the organization ID from the first role's `org_id`

5. WHEN an `x-zea-org-id` header is present THEN the system SHALL use that header's value as the organization ID, overriding `domain_roles`

6. IF no organization ID can be resolved THEN the system SHALL reject the request with HTTP 401

7. WHEN the SDK uses `authHeaders` factory THEN the system SHALL call it before each API request to obtain fresh auth headers

8. IF the authHeaders function throws an error THEN the system SHALL call `onAuthError` callback and SHALL NOT send the request
