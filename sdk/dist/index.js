'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/hooks/useGlia.ts
function useGlia(options) {
  const {
    agentId,
    conversationId = `dm:${agentId}`,
    apiKey,
    baseUrl = "",
    onDelta,
    onThinking,
    onTool,
    onDone,
    onCancelled,
    onError
  } = options;
  const wsRef = react.useRef(null);
  const readyRef = react.useRef(false);
  const pendingRef = react.useRef([]);
  const optionsRef = react.useRef(options);
  optionsRef.current = options;
  const [messages, setMessages] = react.useState([]);
  const [isConnected, setIsConnected] = react.useState(false);
  const [isStreaming, setIsStreaming] = react.useState(false);
  const [streamContent, setStreamContent] = react.useState("");
  const streamRef = react.useRef("");
  const wsUrl = baseUrl ? `${baseUrl.replace("http", "ws")}/agent-ws` : `ws://${typeof window !== "undefined" ? window.location.host : "localhost"}/agent-ws`;
  const connect = react.useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "init", uid: agentId, cid: conversationId }));
    };
    ws.onmessage = (event) => {
      try {
        let raw = event.data;
        if (typeof raw !== "string") {
          raw = Array.isArray(raw) || raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : typeof raw === "object" && raw.text ? raw.text() : "";
        }
        const d = JSON.parse(raw);
        switch (d.type) {
          case "ready":
            readyRef.current = true;
            setIsConnected(true);
            for (const t of pendingRef.current) {
              ws.send(JSON.stringify({ type: "prompt", text: t }));
            }
            pendingRef.current = [];
            break;
          case "thinking_start":
            setIsStreaming(true);
            break;
          case "thinking":
            onThinking?.(d.text);
            break;
          case "thinking_end":
            break;
          case "delta":
            streamRef.current += d.text;
            setStreamContent(streamRef.current);
            onDelta?.(d.text);
            break;
          case "tool":
            onTool?.(d.name, d.input);
            break;
          case "done":
            setIsStreaming(false);
            if (streamRef.current) {
              setMessages((prev) => [...prev, {
                id: crypto.randomUUID(),
                role: "assistant",
                content: streamRef.current,
                timestamp: /* @__PURE__ */ new Date()
              }]);
              streamRef.current = "";
              setStreamContent("");
            }
            onDone?.();
            break;
          case "cancelled":
            setIsStreaming(false);
            if (streamRef.current) {
              setMessages((prev) => [...prev, {
                id: crypto.randomUUID(),
                role: "assistant",
                content: streamRef.current + "\n\n_\u23F9\uFE0F Cancelado_",
                timestamp: /* @__PURE__ */ new Date()
              }]);
              streamRef.current = "";
              setStreamContent("");
            }
            onCancelled?.();
            break;
          case "error":
            setIsStreaming(false);
            onError?.(d.message);
            break;
        }
      } catch {
      }
    };
    ws.onclose = () => {
      setIsConnected(false);
    };
    ws.onerror = () => onError?.("Connection error");
    wsRef.current = ws;
  }, [wsUrl, agentId, conversationId]);
  react.useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
  const send = react.useCallback((text) => {
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: /* @__PURE__ */ new Date()
    }]);
    if (readyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "prompt", text }));
    } else {
      pendingRef.current.push(text);
      connect();
    }
  }, [connect]);
  const cancel = react.useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "cancel" }));
  }, []);
  const reconnect = react.useCallback(() => {
    wsRef.current?.close();
    connect();
  }, [connect]);
  return { send, cancel, isConnected, isStreaming, messages, streamContent, reconnect };
}
var apiFetch = (url, options = {}) => fetch(url, options);
function useGliaConversations(apiKey, baseUrl = "") {
  const [conversations, setConversations] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/conversations`, {
        headers: { "x-api-key": apiKey }
      });
      if (res.ok) {
        const { data } = await res.json();
        setConversations(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, apiKey]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  return { conversations, loading, refresh };
}
function useGliaFiles(apiKey, baseUrl = "") {
  const [files, setFiles] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async (subpath = "") => {
    setLoading(true);
    try {
      const res = await apiFetch(`${api}/files?path=${encodeURIComponent(subpath)}`, {
        headers: { "x-api-key": apiKey }
      });
      if (res.ok) {
        const { files: data } = await res.json();
        setFiles(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, apiKey]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  const upload = async (name, data, path = "") => {
    const res = await apiFetch(`${api}/files/upload`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ name, data, path })
    });
    if (res.ok) refresh(path);
    return res.ok;
  };
  const mkdir = async (path) => {
    const res = await apiFetch(`${api}/files/mkdir`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    if (res.ok) refresh();
  };
  const remove = async (path) => {
    const res = await apiFetch(`${api}/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers: { "x-api-key": apiKey }
    });
    if (res.ok) refresh();
  };
  const rename = async (path, newName) => {
    const res = await apiFetch(`${api}/files/rename`, {
      method: "PUT",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ path, newName })
    });
    if (res.ok) refresh();
  };
  return { files, loading, refresh, upload, mkdir, remove, rename };
}
function useGliaSkills(apiKey, baseUrl = "") {
  const [skills, setSkills] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/skills`, { headers: { "x-api-key": apiKey } });
      if (res.ok) {
        const { data } = await res.json();
        setSkills(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, apiKey]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  const create = async (name, content) => {
    const res = await apiFetch(`${api}/skills`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ name, content })
    });
    if (res.ok) refresh();
    return res.ok;
  };
  const deleteSkill = async (name) => {
    await apiFetch(`${api}/skills/${name}`, {
      method: "DELETE",
      headers: { "x-api-key": apiKey }
    });
    refresh();
  };
  return { skills, loading, refresh, create, deleteSkill };
}
function useGliaAgents(apiKey, baseUrl = "") {
  const [agents, setAgents] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/agents`, { headers: { "x-api-key": apiKey } });
      if (res.ok) {
        const { data } = await res.json();
        setAgents(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, apiKey]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  return { agents, loading, refresh };
}
var defaultColors = {
  bg: "var(--glia-bg, transparent)",
  text: "var(--glia-text, var(--zea-bc, #e6edf3))",
  textMuted: "var(--glia-text-muted, color-mix(in oklch, var(--zea-bc, #e6edf3) 50%, transparent))",
  userBubble: "var(--glia-user-bubble, var(--zea-p, #16a34a))",
  userBubbleText: "var(--glia-user-text, var(--zea-pc, #fff))",
  agentBubble: "var(--glia-agent-bubble, var(--zea-b1, #2a3040))",
  agentBubbleText: "var(--glia-agent-text, var(--zea-bc, #e6edf3))",
  thinkingBg: "var(--glia-thinking-bg, color-mix(in oklch, #7c3aed 8%, transparent))",
  thinkingText: "var(--glia-thinking-text, oklch(70% 0.2 292))",
  thinkingBorder: "var(--glia-thinking-border, color-mix(in oklch, #7c3aed 20%, transparent))",
  toolBg: "var(--glia-tool-bg, color-mix(in oklch, #7c3aed 10%, transparent))",
  toolText: "var(--glia-tool-text, oklch(65% 0.2 292))",
  toolBorder: "var(--glia-tool-border, color-mix(in oklch, #7c3aed 20%, transparent))",
  resultBg: "var(--glia-result-bg, color-mix(in oklch, var(--zea-su, #10b981) 10%, transparent))",
  resultText: "var(--glia-result-text, oklch(60% 0.14 180))",
  resultBorder: "var(--glia-result-border, color-mix(in oklch, var(--zea-su, #10b981) 25%, transparent))",
  inputBg: "var(--glia-input-bg, var(--zea-b2, #1e2432))",
  inputBorder: "var(--glia-input-border, var(--zea-b2, #1e2432))",
  primary: "var(--glia-primary, var(--zea-p, #16a34a))",
  primaryText: "var(--glia-primary-text, var(--zea-pc, #fff))",
  font: "var(--glia-font, var(--zea-sans, system-ui, sans-serif))",
  radius: "var(--glia-radius, 12px)"
};
function pushBlock(blocks, b) {
  const last = blocks[blocks.length - 1];
  if (b.type === "thinking_delta" && last?.type === "thinking_delta")
    return [...blocks.slice(0, -1), { type: "thinking_delta", text: last.text + b.text }];
  if (b.type === "text_delta" && last?.type === "text_delta")
    return [...blocks.slice(0, -1), { type: "text_delta", text: last.text + b.text }];
  return [...blocks, b];
}
function renderMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, '<code class="glia-code">$1</code>').replace(/\n/g, "<br/>");
}
function GliaChat({
  agentId,
  conversationId,
  apiKey,
  baseUrl,
  placeholder = "Mensaje para el agente...",
  welcomeMessage = "\xA1Hola! Soy tu agente. \xBFEn qu\xE9 puedo ayudarte?",
  className = "",
  colors: colorsOverride,
  renderMessage,
  renderInput
}) {
  const c = { ...defaultColors, ...colorsOverride };
  const css = (o) => o;
  const [streamBlocks, setStreamBlocks] = react.useState([]);
  const [thinkingOpen, setThinkingOpen] = react.useState(true);
  const streamRef = react.useRef([]);
  const { send, cancel, isStreaming, messages } = useGlia({
    agentId,
    conversationId,
    apiKey,
    baseUrl,
    onDelta: react.useCallback((text) => {
      streamRef.current = pushBlock(streamRef.current, { type: "text_delta", text });
      setStreamBlocks([...streamRef.current]);
    }, []),
    onThinking: react.useCallback((text) => {
      streamRef.current = pushBlock(streamRef.current, { type: "thinking_delta", text });
      setStreamBlocks([...streamRef.current]);
    }, []),
    onTool: react.useCallback((name, input2) => {
      streamRef.current = pushBlock(streamRef.current, { type: "tool_call", name, input: input2 });
      setStreamBlocks([...streamRef.current]);
    }, []),
    onDone: react.useCallback(() => {
      streamRef.current = [];
      setStreamBlocks([]);
    }, []),
    onCancelled: react.useCallback(() => {
      streamRef.current = [];
      setStreamBlocks([]);
    }, [])
  });
  const [input, setInput] = react.useState("");
  const [cancelling, setCancelling] = react.useState(false);
  const feedRef = react.useRef(null);
  react.useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamBlocks]);
  react.useEffect(() => {
    if (!isStreaming) setCancelling(false);
  }, [isStreaming]);
  const handleSend = () => {
    const t = input.trim();
    if (t && !isStreaming) {
      send(t);
      setInput("");
    }
  };
  const handleCancel = () => {
    setCancelling(true);
    cancel();
  };
  const defaultMessage = (msg) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-msg", style: css({ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }), children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-bubble", style: css({
    maxWidth: "85%",
    padding: "10px 14px",
    borderRadius: c.radius,
    fontSize: 13,
    lineHeight: 1.55,
    background: msg.role === "user" ? c.userBubble : c.agentBubble,
    color: msg.role === "user" ? c.userBubbleText : c.agentBubbleText,
    borderBottomRightRadius: msg.role === "user" ? "4px" : c.radius,
    borderBottomLeftRadius: msg.role !== "user" ? "4px" : c.radius
  }), children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-md", dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } }) }) }, msg.id);
  const defaultInput = /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-input-area", style: css({ padding: "12px 16px", borderTop: `1px solid ${c.inputBorder}`, flexShrink: 0 }), children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-input-row", style: css({
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    background: c.inputBg,
    border: `1px solid ${c.inputBorder}`,
    borderRadius: c.radius,
    padding: "8px 12px"
  }), children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      "textarea",
      {
        value: input,
        onChange: (e) => setInput(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        },
        placeholder: isStreaming ? "El agente est\xE1 respondiendo..." : placeholder,
        rows: 2,
        disabled: isStreaming,
        className: "glia-textarea",
        style: css({
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          color: c.text,
          fontSize: 13,
          fontFamily: c.font,
          opacity: isStreaming ? 0.5 : 1
        })
      }
    ),
    isStreaming ? /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleCancel, disabled: cancelling, className: "glia-btn-cancel", style: css({
      width: 32,
      height: 32,
      borderRadius: "50%",
      border: "none",
      background: cancelling ? c.inputBorder : c.primary,
      color: cancelling ? c.textMuted : c.primaryText,
      cursor: cancelling ? "default" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 14,
      flexShrink: 0
    }), children: cancelling ? "\u23F3" : "\u25A0" }) : /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleSend, className: "glia-btn-send", style: css({
      width: 32,
      height: 32,
      borderRadius: "50%",
      border: "none",
      background: input.trim() ? c.primary : c.inputBorder,
      color: c.primaryText,
      cursor: input.trim() ? "pointer" : "default",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 16,
      flexShrink: 0,
      opacity: input.trim() ? 1 : 0.4
    }), children: "\u2191" })
  ] }) });
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `glia-root ${className}`, style: css({ display: "flex", flexDirection: "column", height: "100%", background: c.bg, fontFamily: c.font }), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { ref: feedRef, className: "glia-feed", style: css({ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }), children: [
      messages.length === 0 && !isStreaming && /* @__PURE__ */ jsxRuntime.jsx("p", { className: "glia-welcome", style: css({ textAlign: "center", fontSize: 13, color: c.textMuted, marginTop: "40%" }), children: welcomeMessage }),
      messages.map((msg) => renderMessage ? renderMessage(msg, defaultMessage(msg)) : defaultMessage(msg)),
      streamBlocks.length > 0 && /* @__PURE__ */ jsxRuntime.jsx(StreamingView, { blocks: streamBlocks, colors: c, thinkingOpen, onToggleThinking: () => setThinkingOpen((o) => !o) }),
      isStreaming && streamBlocks.length === 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-thinking-indicator", style: css({ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }), children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { style: css({ width: 6, height: 6, borderRadius: "50%", background: c.thinkingText, animation: "glia-pulse 1.2s ease-in-out infinite" }) }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { style: css({ fontSize: 12, color: c.textMuted }), children: "Pensando..." })
      ] })
    ] }),
    renderInput ? renderInput(defaultInput) : defaultInput,
    /* @__PURE__ */ jsxRuntime.jsx("style", { children: "@keyframes glia-pulse{0%,100%{opacity:1}50%{opacity:0.3}}.glia-code{background:var(--glia-code-bg,var(--zea-b2,#1e2432));padding:1px 5px;border-radius:4px;font-size:0.9em}" })
  ] });
}
function StreamingView({ blocks, colors: c, thinkingOpen, onToggleThinking }) {
  const css = (o) => o;
  const hasThinking = blocks.some((b) => b.type.startsWith("thinking"));
  const textBlocks = blocks.filter((b) => b.type === "text_delta");
  const lastText = textBlocks[textBlocks.length - 1]?.text || "";
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-stream", style: css({ display: "flex", flexDirection: "column", gap: 8 }), children: [
    hasThinking && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-thinking", style: css({ borderRadius: c.radius, overflow: "hidden" }), children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { onClick: onToggleThinking, className: "glia-thinking-toggle", style: css({
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "6px 12px",
        border: "none",
        cursor: "pointer",
        background: c.thinkingBg,
        color: c.thinkingText,
        fontSize: 11,
        fontFamily: c.font,
        fontWeight: 600
      }), children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: thinkingOpen ? "\u25BC" : "\u25B6" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { style: css({ padding: "1px 6px", borderRadius: 4, background: c.thinkingBorder, fontSize: 10 }), children: "thinking" })
      ] }),
      thinkingOpen && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-thinking-body", style: css({
        padding: "8px 12px",
        background: c.thinkingBg,
        borderLeft: `2px solid ${c.thinkingBorder}`,
        fontSize: 12,
        lineHeight: 1.5,
        color: c.thinkingText,
        whiteSpace: "pre-wrap",
        fontStyle: "italic"
      }), children: blocks.filter((b) => b.type === "thinking_delta").map((b) => b.text).join("") })
    ] }),
    blocks.filter((b) => b.type === "tool_call").map((b, i) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-tool", style: css({
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 8,
      background: c.toolBg,
      border: `1px solid ${c.toolBorder}`,
      fontSize: 12,
      color: c.toolText
    }), children: [
      /* @__PURE__ */ jsxRuntime.jsxs("span", { style: css({ fontWeight: 600 }), children: [
        "\u{1F527} ",
        b.name
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: css({ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }), children: typeof b.input === "string" ? b.input : JSON.stringify(b.input) })
    ] }, i)),
    blocks.filter((b) => b.type === "tool_result").map((b, i) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-result", style: css({
      padding: "8px 12px",
      borderRadius: 8,
      background: c.resultBg,
      border: `1px solid ${c.resultBorder}`,
      fontSize: 11,
      lineHeight: 1.5,
      maxHeight: 150,
      overflowY: "auto",
      color: c.resultText,
      whiteSpace: "pre-wrap",
      fontFamily: "monospace"
    }), children: b.content.slice(0, 2e3) }, i)),
    lastText && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-bubble glia-stream-text", style: css({
      padding: "10px 14px",
      borderRadius: c.radius,
      background: c.agentBubble,
      color: c.agentBubbleText,
      fontSize: 13,
      lineHeight: 1.55,
      maxWidth: "85%",
      borderBottomLeftRadius: "4px"
    }), children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-md", dangerouslySetInnerHTML: { __html: renderMarkdown(lastText) } }) })
  ] });
}
function GliaCopilot({ agentId, apiKey, baseUrl, open = false, onClose }) {
  const [isOpen, setIsOpen] = react.useState(open);
  const [width, setWidth] = react.useState(440);
  const toggle = () => {
    setIsOpen(!isOpen);
    if (isOpen) onClose?.();
  };
  if (!isOpen) {
    return /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        onClick: toggle,
        className: "fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 z-50 flex items-center justify-center text-2xl",
        children: "\u{1F4AC}"
      }
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fixed inset-0 z-40 bg-black/10", onClick: toggle }),
    /* @__PURE__ */ jsxRuntime.jsxs(
      "aside",
      {
        className: "fixed right-0 top-0 h-full z-50 flex flex-col border-l bg-white shadow-xl",
        style: { width: `${width}px` },
        children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2 p-3 border-b", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-semibold text-sm flex-1", children: "Copilot" }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => {
            }, className: "p-1 hover:bg-gray-100 rounded", title: "Refresh", children: "\u21BB" }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: toggle, className: "p-1 hover:bg-gray-100 rounded", title: "Close", children: "\u2715" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(GliaChat, { agentId, apiKey, baseUrl })
        ]
      }
    )
  ] });
}
function GliaConversationList({ conversations, activeId, onSelect, agents = [] }) {
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 p-2", children: [
    agents.map((agent) => /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        onClick: () => {
        },
        className: "w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex items-center gap-2",
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600", children: agent.name.slice(0, 2).toUpperCase() }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium truncate", children: agent.name })
        ]
      },
      agent.id
    )),
    conversations.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-gray-400 text-center py-4", children: "No conversations yet" }),
    conversations.map((conv) => /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        onClick: () => onSelect?.(conv.id),
        className: `w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex flex-col ${activeId === conv.id ? "bg-blue-50" : ""}`,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium truncate", children: conv.title || "Nueva conversaci\xF3n" }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-xs text-gray-400", children: [
            conv.messageCount,
            " mensajes"
          ] })
        ]
      },
      conv.id
    ))
  ] });
}
function GliaFileBrowser({ files, loading, onSelect }) {
  if (loading) return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-4 text-sm text-gray-400", children: "Cargando..." });
  if (files.length === 0) return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-4 text-sm text-gray-400", children: "No hay archivos" });
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col text-sm", children: files.map((f, i) => /* @__PURE__ */ jsxRuntime.jsxs(
    "button",
    {
      onClick: () => onSelect?.(f),
      className: "flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 text-left",
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: f.type === "dir" ? "\u{1F4C1}" : f.ext === ".md" ? "\u{1F4DD}" : "\u{1F4C4}" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "truncate flex-1", children: f.name }),
        f.type === "file" && /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-xs text-gray-400", children: [
          Math.round(f.size / 1024),
          "KB"
        ] })
      ]
    },
    i
  )) });
}
function GliaSkillEditor({ skills, loading, onCreate, onDelete }) {
  if (loading) return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-4 text-sm text-gray-400", children: "Cargando..." });
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-1 p-2", children: skills.map((skill) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50", children: [
    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs", children: skill.custom ? "\u{1F7E2}" : "  " }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex-1 min-w-0", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-sm font-medium truncate", children: skill.name }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs text-gray-400 truncate", children: skill.description })
    ] }),
    skill.custom && /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        onClick: () => onDelete?.(skill.name),
        className: "text-xs text-red-500 hover:text-red-700",
        children: "\xD7"
      }
    )
  ] }, skill.name)) });
}

exports.GliaChat = GliaChat;
exports.GliaConversationList = GliaConversationList;
exports.GliaCopilot = GliaCopilot;
exports.GliaFileBrowser = GliaFileBrowser;
exports.GliaSkillEditor = GliaSkillEditor;
exports.useGlia = useGlia;
exports.useGliaAgents = useGliaAgents;
exports.useGliaConversations = useGliaConversations;
exports.useGliaFiles = useGliaFiles;
exports.useGliaSkills = useGliaSkills;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map