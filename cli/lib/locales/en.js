// English
export default {
  // ── Dynamic Discovery ──
  discover: {
    description: 'AgentHub & AI interaction',
    agent_list: 'List available agents',
    agent_show: 'Show agent details',
    agent_create: 'Create a new agent with sandbox',
    agent_config: 'Update agent configuration',
    agent_delete: 'Delete an agent',
    agent_share: 'Share an agent with another user',
    skill_list: 'List available skills',
    skill_show: 'Show skill content',
    skill_create: 'Create a custom skill',
    skill_edit: 'Edit an existing skill',
    skill_delete: 'Delete a skill',
    skill_assign: 'Assign a skill to agents',
    conv_list: 'List conversations',
    conv_show: 'Show conversation messages',
    conv_delete: 'Delete a conversation',
    chat: 'Interactive WebSocket chat with an agent',
    sandbox_create: 'Create a sandbox (user or agent)',
    sandbox_destroy: 'Destroy a sandbox',
    sandbox_files: 'List sandbox files',
    files_list: 'List unified files',
    files_upload: 'Upload a file to workspace',
    files_read: 'Read file content',
    files_delete: 'Delete a file',
    files_mkdir: 'Create a directory',
    files_rename: 'Rename a file',
    files_move: 'Move a file',
    files_history: 'Show git history for a file',
    files_recover: 'Recover a previous version of a file',
    files_push: 'Git push workspace',
    apikey_create: 'Create an API key',
    health: 'Check Soma health',
    doctor: 'Full Soma diagnostics',
  },

  // ── Health ──
  health: {
    ok: '✅ Soma AgentHub',
    status: 'Status',
    service: 'Service',
    fail: '❌ Soma is not responding',
    no_connect: '❌ Could not connect',
  },

  // ── Agent ──
  agent: {
    no_agents: 'No agents available',
    total: 'agent(s)',
    not_found: 'Agent not found',
    creating: '🆕 Creating agent...',
    created: '✅ Agent created',
    config_updated: '✅ Configuration updated',
    deleted: '✅ Agent deleted',
    shared: '✅ Agent shared',
    unshared: '✅ Agent unshared',
    no_shares: 'Not shared with anyone',
    engine: 'Engine',
    model: 'Model',
    skills: 'Skills',
    none: '(none)',
    default: '(default)',
    system_prompt: 'System Prompt',
    table_headers: ['ID', 'Name', 'Engine', 'Skills', 'Type'],
  },

  // ── Skill ──
  skill: {
    no_skills: 'No skills available',
    total: 'skill(s)',
    not_found: 'Skill not found',
    created: '✅ Skill created',
    updated: '✅ Skill updated',
    deleted: '✅ Skill deleted',
    assigned: "Skill '{name}' assigned to {count} agent(s)",
    table_headers: ['Name', 'Source', 'Description'],
  },

  // ── Conversations ──
  conv: {
    no_convs: 'No conversations',
    total: 'conversation(s)',
    not_found: 'Conversation not found',
    deleted: '✅ Conversation deleted',
    untitled: '(untitled)',
    no_content: '(no content)',
    messages: 'Messages',
    table_headers: ['ID', 'Agent', 'Msgs', 'Last message'],
  },

  // ── Chat ──
  chat: {
    connecting: 'Connecting',
    ready: '✅ Ready',
    cancelled: '⏹️  Cancelled',
    goodbye: '👋 Bye!',
    connection_error: '❌ Connection error',
    connection_timeout: '❌ Connection timeout (15s)',
    prompt_hint: 'Type your message. Ctrl+C to exit, Ctrl+D for new line.',
  },

  // ── Sandbox ──
  sandbox: {
    creating: 'Creating sandbox',
    created: '✅ Created',
    home: 'Home',
    destroyed: '✅ Sandbox destroyed',
    no_files: '📭 No files',
    files_of: 'Files of',
  },

  // ── Files ──
  files: {
    no_files: '📭 No files',
    not_found: 'File not found',
    uploading: 'Uploading',
    uploaded: '✅',
    deleted: '✅ Deleted',
    dir_created: '✅ Directory created',
    renamed: '✅ Renamed →',
    moved: '✅ Moved →',
    no_history: 'No history',
    history: '📜 History',
    recovered: '✅ Recovered',
    push_ok: '✅ Push successful',
  },

  // ── API Key ──
  apikey: {
    created: '✅ API key created',
    warning: 'Save it somewhere safe. It will not be shown again.',
  },

  // ── Doctor ──
  doctor: {
    title: '🩺 Soma Doctor — 10 checks',
    all_pass: '🎉 {passed}/{total} checks passed',
    some_fail: '⚠️  {passed}/{total} checks passed, {failed} failed',
    checks: {
      health: 'Health endpoint',
      agent_list: 'Agent list',
      skill_list: 'Skill list',
      conv_list: 'Conversation list',
      agent_ws: 'Agent WebSocket',
      agent_chat: 'Agent chat (prompt)',
      file_rw: 'File write/read',
      config_file: 'Config file',
    },
  },

  // ── Generic errors ──
  errors: {
    http_error: 'Error (HTTP {code})',
    unknown: 'Unknown error',
  },

  // ── Misc ──
  misc: {
    total_agents: 'Total',
    total_skills: 'Total',
    total_convs: 'Total',
    separator: '─'.repeat(60),
    separator_small: '─'.repeat(40),
  },
};
