// Español — locale por defecto
export default {
  // ── Dynamic Discovery ──
  discover: {
    description: 'AgentHub e interacción con IAs',
    agent_list: 'Lista agentes disponibles',
    agent_show: 'Muestra detalle de un agente',
    agent_create: 'Crea un nuevo agente con sandbox',
    agent_config: 'Actualiza configuración de un agente',
    agent_delete: 'Elimina un agente',
    agent_share: 'Comparte un agente con otro usuario',
    skill_list: 'Lista skills disponibles',
    skill_show: 'Muestra contenido de un skill',
    skill_create: 'Crea un skill custom',
    skill_edit: 'Edita un skill existente',
    skill_delete: 'Elimina un skill',
    skill_assign: 'Asigna un skill a agentes',
    conv_list: 'Lista conversaciones',
    conv_show: 'Muestra mensajes de una conversación',
    conv_delete: 'Elimina una conversación',
    chat: 'Chat interactivo WebSocket con un agente',
    sandbox_create: 'Crea un sandbox (usuario o agente)',
    sandbox_destroy: 'Destruye un sandbox',
    sandbox_files: 'Lista archivos de un sandbox',
    files_list: 'Lista archivos unificados',
    files_upload: 'Sube un archivo al workspace',
    files_read: 'Lee el contenido de un archivo',
    files_delete: 'Elimina un archivo',
    files_mkdir: 'Crea un directorio',
    files_rename: 'Renombra un archivo',
    files_move: 'Mueve un archivo',
    files_history: 'Muestra el historial git de un archivo',
    files_recover: 'Recupera una versión anterior de un archivo',
    files_push: 'Hace git push del workspace',
    apikey_create: 'Crea una API key',
    health: 'Verifica que Soma esté funcionando',
    doctor: 'Diagnóstico completo de Soma',
  },

  // ── Health ──
  health: {
    ok: '✅ Soma AgentHub',
    status: 'Status',
    service: 'Service',
    fail: '❌ Soma no responde',
    no_connect: '❌ No se pudo conectar',
  },

  // ── Agent ──
  agent: {
    no_agents: 'No hay agentes disponibles',
    total: 'agente(s)',
    not_found: 'Agente no encontrado',
    creating: '🆕 Creando agente...',
    created: '✅ Agente creado',
    config_updated: '✅ Configuración actualizada',
    deleted: '✅ Agente eliminado',
    shared: '✅ Agente compartido',
    unshared: '✅ Agente descompartido',
    no_shares: 'No compartido con nadie',
    engine: 'Engine',
    model: 'Model',
    skills: 'Skills',
    none: '(ninguna)',
    default: '(default)',
    system_prompt: 'System Prompt',
    table_headers: ['ID', 'Nombre', 'Engine', 'Skills', 'Tipo'],
  },

  // ── Skill ──
  skill: {
    no_skills: 'No hay skills disponibles',
    total: 'skill(s)',
    not_found: 'Skill no encontrado',
    created: '✅ Skill creado',
    updated: '✅ Skill actualizado',
    deleted: '✅ Skill eliminado',
    assigned: "Skill '{name}' asignado a {count} agente(s)",
    table_headers: ['Nombre', 'Origen', 'Descripción'],
  },

  // ── Conversations ──
  conv: {
    no_convs: 'No hay conversaciones',
    total: 'conversación(es)',
    not_found: 'Conversación no encontrada',
    deleted: '✅ Conversación eliminada',
    untitled: '(sin título)',
    no_content: '(sin contenido)',
    messages: 'Mensajes',
    table_headers: ['ID', 'Agente', 'Msgs', 'Último mensaje'],
  },

  // ── Chat ──
  chat: {
    connecting: 'Conectando',
    ready: '✅ Listo',
    cancelled: '⏹️  Cancelado',
    goodbye: '👋 Chau!',
    connection_error: '❌ Error de conexión',
    connection_timeout: '❌ Timeout de conexión (15s)',
    prompt_hint: 'Escribe tu mensaje. Ctrl+C para salir, Ctrl+D nueva línea.',
  },

  // ── Sandbox ──
  sandbox: {
    creating: 'Creando sandbox',
    created: '✅ Creado',
    home: 'Home',
    destroyed: '✅ Sandbox destruido',
    no_files: '📭 Sin archivos',
    files_of: 'Archivos de',
  },

  // ── Files ──
  files: {
    no_files: '📭 Sin archivos',
    not_found: 'Archivo no encontrado',
    uploading: 'Subiendo',
    uploaded: '✅',
    deleted: '✅ Eliminado',
    dir_created: '✅ Directorio creado',
    renamed: '✅ Renombrado →',
    moved: '✅ Movido →',
    no_history: 'Sin historial',
    history: '📜 Historial',
    recovered: '✅ Recuperado',
    push_ok: '✅ Push exitoso',
  },

  // ── API Key ──
  apikey: {
    created: '✅ API key creada',
    warning: 'Guardala en un lugar seguro. No se volverá a mostrar.',
  },

  // ── Doctor ──
  doctor: {
    title: '🩺 Soma Doctor — 10 checks',
    all_pass: '🎉 {passed}/{total} checks passed',
    some_fail: '⚠️  {passed}/{total} checks passed, {failed} fallaron',
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
    unknown: 'Error desconocido',
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
