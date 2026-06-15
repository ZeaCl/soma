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
  const wsUrl = baseUrl ? `${baseUrl.replace("https", "wss").replace("http", "ws")}${options.wsPath || "/agent-ws"}` : `${typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws"}://${typeof window !== "undefined" ? window.location.host : "localhost"}${options.wsPath || "/agent-ws"}`;
  const contentRef = react.useRef("");
  const thinkingRef = react.useRef("");
  const connect = react.useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      console.log("[useGlia] ws open \u2192 sending init");
      ws.send(JSON.stringify({ type: "init", uid: agentId, cid: conversationId }));
    };
    ws.onmessage = (event) => {
      try {
        let raw;
        if (typeof event.data === "string") {
          raw = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(event.data);
        } else if (event.data instanceof Blob) {
          event.data.text().then((text) => {
            processMessage(text, ws);
          }).catch(() => {
          });
          return;
        } else {
          console.warn("[useGlia] unknown message type:", typeof event.data, event.data);
          return;
        }
        processMessage(raw, ws);
      } catch (e) {
        console.error("[useGlia] onmessage error:", e, "raw type:", typeof event.data);
      }
    };
    function processMessage(raw, ws2) {
      const d = JSON.parse(raw);
      switch (d.type) {
        case "ready":
          readyRef.current = true;
          setIsConnected(true);
          console.log("[useGlia] \u2190 ready, pending:", pendingRef.current.length);
          for (const t of pendingRef.current) {
            ws2.send(JSON.stringify({ type: "prompt", text: t }));
          }
          pendingRef.current = [];
          break;
        case "thinking_start":
          setIsStreaming(true);
          thinkingRef.current = "";
          break;
        case "thinking":
          thinkingRef.current += d.text;
          onThinking?.(d.text);
          break;
        case "thinking_end":
          break;
        case "delta":
          streamRef.current += d.text;
          contentRef.current = streamRef.current;
          setStreamContent(streamRef.current);
          onDelta?.(d.text);
          break;
        case "tool":
          onTool?.(d.name, d.input);
          break;
        case "done": {
          setIsStreaming(false);
          const content = contentRef.current || streamRef.current;
          console.log("[useGlia] \u2190 done, content length:", content.length, "contentRef:", !!contentRef.current, "streamRef:", !!streamRef.current);
          const thinking = thinkingRef.current.trim() || void 0;
          console.log("[useGlia] \u2190 done, content:", content.length, "thinking:", (thinking || "").length, "contentRef:", !!contentRef.current);
          if (content || thinking) {
            setMessages((prev) => [...prev, {
              id: crypto.randomUUID(),
              role: "assistant",
              content: content || "(sin respuesta)",
              thinking,
              timestamp: /* @__PURE__ */ new Date()
            }]);
            contentRef.current = "";
            streamRef.current = "";
            thinkingRef.current = "";
            setStreamContent("");
          } else {
            console.warn("[useGlia] \u2190 done but NO content accumulated \u2014 message lost");
          }
          onDone?.();
          break;
        }
        case "cancelled": {
          setIsStreaming(false);
          const content = contentRef.current || streamRef.current || "";
          if (content) {
            setMessages((prev) => [...prev, {
              id: crypto.randomUUID(),
              role: "assistant",
              content: content + "\n\n_\u23F9\uFE0F Cancelado_",
              thinking: thinkingRef.current.trim() || void 0,
              timestamp: /* @__PURE__ */ new Date()
            }]);
            contentRef.current = "";
            streamRef.current = "";
            thinkingRef.current = "";
            setStreamContent("");
          }
          onCancelled?.();
          break;
        }
        case "error":
          setIsStreaming(false);
          console.error("[useGlia] \u2190 error:", d.message);
          onError?.(d.message);
          break;
      }
    }
    ws.onclose = () => {
      setIsConnected(false);
      console.log("[useGlia] ws closed");
    };
    ws.onerror = () => {
      console.error("[useGlia] ws error");
      onError?.("Connection error");
    };
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
var apiFetch = (url, token, options = {}) => fetch(url, {
  ...options,
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers
  }
});
function useGliaConversations(token, baseUrl = "") {
  const [conversations, setConversations] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/conversations`, token);
      if (res.ok) {
        const { data } = await res.json();
        setConversations(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, token]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  return { conversations, loading, refresh };
}
function useGliaFiles(token, baseUrl = "") {
  const [files, setFiles] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async (subpath = "") => {
    setLoading(true);
    try {
      const res = await apiFetch(`${api}/files?path=${encodeURIComponent(subpath)}`, token);
      if (res.ok) {
        const { files: data } = await res.json();
        setFiles(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, token]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  const upload = async (name, data, path = "") => {
    const res = await apiFetch(`${api}/files/upload`, token, {
      method: "POST",
      body: JSON.stringify({ name, data, path })
    });
    if (res.ok) refresh(path);
    return res.ok;
  };
  const mkdir = async (path) => {
    const res = await apiFetch(`${api}/files/mkdir`, token, {
      method: "POST",
      body: JSON.stringify({ path })
    });
    if (res.ok) refresh();
  };
  const remove = async (path) => {
    await apiFetch(`${api}/files?path=${encodeURIComponent(path)}`, token, { method: "DELETE" });
    refresh();
  };
  const rename = async (path, newName) => {
    const res = await apiFetch(`${api}/files/rename`, token, {
      method: "PUT",
      body: JSON.stringify({ path, newName })
    });
    if (res.ok) refresh();
  };
  return { files, loading, refresh, upload, mkdir, remove, rename };
}
function useGliaFileContent(token, baseUrl = "") {
  const [content, setContent] = react.useState(null);
  const [loading, setLoading] = react.useState(false);
  const [error, setError] = react.useState(null);
  const api = `${baseUrl || ""}/api/v1`;
  const readFile = react.useCallback(async (path) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${api}/files/content?path=${encodeURIComponent(path)}`, token);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setContent(text);
      return text;
    } catch (e) {
      setError(e.message);
      setContent(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, token]);
  const clear = react.useCallback(() => {
    setContent(null);
    setError(null);
  }, []);
  return { content, loading, error, readFile, clear };
}
function useGliaSkills(token, baseUrl = "") {
  const [skills, setSkills] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/skills`, token);
      if (res.ok) {
        const { data } = await res.json();
        setSkills(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, token]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  const create = async (name, content) => {
    const res = await apiFetch(`${api}/skills`, token, {
      method: "POST",
      body: JSON.stringify({ name, content })
    });
    if (res.ok) refresh();
    return res.ok;
  };
  const deleteSkill = async (name) => {
    await apiFetch(`${api}/skills/${name}`, token, { method: "DELETE" });
    refresh();
  };
  const assignToAgents = async (skillName, agentIds) => {
    const res = await apiFetch(`${api}/skills/${skillName}/agents`, token, {
      method: "PUT",
      body: JSON.stringify({ agentIds })
    });
    if (res.ok) refresh();
    return res.ok;
  };
  const getAgentSkills = async (agentId) => {
    try {
      const res = await apiFetch(`${api}/agents/${agentId}/skills`, token);
      if (res.ok) {
        const { data } = await res.json();
        return Array.isArray(data) ? data.map((s) => typeof s === "string" ? s : s.name) : [];
      }
    } catch {
    }
    return [];
  };
  const getContent = async (skillName) => {
    try {
      const res = await apiFetch(`${api}/skills/${skillName}`, token);
      if (res.ok) {
        const { data } = await res.json();
        return data?.content || null;
      }
    } catch {
    }
    return null;
  };
  return { skills, loading, refresh, create, deleteSkill, assignToAgents, getAgentSkills, getContent };
}
function useGliaAgents(token, baseUrl = "") {
  const [agents, setAgents] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = react.useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/agents`, token);
      if (res.ok) {
        const { data } = await res.json();
        setAgents(data);
      }
    } catch {
    }
    setLoading(false);
  }, [api, token]);
  react.useEffect(() => {
    refresh();
  }, [refresh]);
  const createAgent = async (data) => {
    const res = await apiFetch(`${api}/agents`, token, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { data: agent } = await res.json();
    setAgents((prev) => [...prev, agent]);
    return agent;
  };
  return { agents, loading, refresh, createAgent };
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
  const [thinkingOpenIds, setThinkingOpenIds] = react.useState({});
  const toggleMsgThinking = react.useCallback((id) => {
    setThinkingOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const defaultMessage = (msg) => {
    const thinkingOpen2 = !!thinkingOpenIds[msg.id];
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-msg", style: css({ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }), children: [
      msg.thinking && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "glia-thinking-persisted", style: css({ maxWidth: "85%", borderRadius: c.radius, overflow: "hidden" }), children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { onClick: () => toggleMsgThinking(msg.id), style: css({
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "4px 10px",
          border: "none",
          cursor: "pointer",
          background: c.thinkingBg,
          color: c.thinkingText,
          fontSize: 10,
          fontFamily: c.font,
          fontWeight: 600,
          borderRadius: thinkingOpen2 ? `${c.radius} ${c.radius} 0 0` : c.radius
        }), children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { style: css({ fontSize: 10 }), children: thinkingOpen2 ? "\u25BC" : "\u25B6" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { style: css({ padding: "0px 5px", borderRadius: 3, background: c.thinkingBorder, fontSize: 9 }), children: "thinking" })
        ] }),
        thinkingOpen2 && /* @__PURE__ */ jsxRuntime.jsx("div", { style: css({
          padding: "6px 10px",
          background: c.thinkingBg,
          borderLeft: `2px solid ${c.thinkingBorder}`,
          fontSize: 11,
          lineHeight: 1.5,
          color: c.thinkingText,
          whiteSpace: "pre-wrap",
          fontStyle: "italic"
        }), children: msg.thinking })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-bubble", style: css({
        maxWidth: "85%",
        padding: "10px 14px",
        borderRadius: c.radius,
        fontSize: 13,
        lineHeight: 1.55,
        background: msg.role === "user" ? c.userBubble : c.agentBubble,
        color: msg.role === "user" ? c.userBubbleText : c.agentBubbleText,
        borderBottomRightRadius: msg.role === "user" ? "4px" : c.radius,
        borderBottomLeftRadius: msg.role !== "user" ? "4px" : c.radius
      }), children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "glia-md", dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } }) })
    ] }, msg.id);
  };
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
var S = {
  bg: "#0d1117",
  row: "#161b22",
  bc: "#21262d",
  tx: "#e6edf3",
  mu: "#8b949e",
  pr: "#58a6ff"};
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fileIcon(f) {
  if (f.type === "dir") return "\u{1F4C1}";
  const ext = f.ext?.toLowerCase() || "";
  if ([".md", ".markdown"].includes(ext)) return "\u{1F4DD}";
  if ([".json"].includes(ext)) return "\u{1F4CB}";
  if ([".js", ".ts", ".tsx", ".jsx"].includes(ext)) return "\u26A1";
  if ([".txt", ".log"].includes(ext)) return "\u{1F4C4}";
  if ([".csv", ".xlsx", ".xls"].includes(ext)) return "\u{1F4CA}";
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg"].includes(ext)) return "\u{1F5BC}\uFE0F";
  return "\u{1F4C4}";
}
function GliaFileBrowser({ files, loading, onSelect, readFile }) {
  const [viewingFile, setViewingFile] = react.useState(null);
  const [currentPath, setCurrentPath] = react.useState("");
  const handleFileClick = async (f) => {
    if (f.type === "dir") {
      setCurrentPath(f.name);
      onSelect?.(f);
      return;
    }
    if (readFile) {
      setViewingFile({ name: f.name, content: null, loading: true });
      const content = await readFile(f.name);
      setViewingFile({ name: f.name, content, loading: false });
    } else {
      onSelect?.(f);
    }
  };
  const closeViewer = () => setViewingFile(null);
  if (loading) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: S.mu, fontSize: 13, fontFamily: "system-ui, sans-serif" }, children: "Cargando archivos..." });
  }
  if (files.length === 0) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: S.mu, fontSize: 13, fontFamily: "system-ui, sans-serif" }, children: "No hay archivos." });
  }
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  if (viewingFile) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${S.bc}`, background: S.row }, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: 12, color: S.tx }, children: [
          "\u{1F4C4} ",
          viewingFile.name
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: closeViewer, style: { background: "none", border: "none", color: S.mu, cursor: "pointer", fontSize: 16 }, children: "\u2190 Volver" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { style: { flex: 1, overflow: "auto", padding: 16, background: S.bg, color: S.tx, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: viewingFile.loading ? "Cargando..." : viewingFile.content || "(archivo vac\xEDo)" })
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontFamily: "system-ui, sans-serif", fontSize: 13 }, children: /* @__PURE__ */ jsxRuntime.jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
    /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { style: { borderBottom: `1px solid ${S.bc}` }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("th", { style: { padding: "6px 12px", textAlign: "left", color: S.mu, fontWeight: 500, width: 30 } }),
      /* @__PURE__ */ jsxRuntime.jsx("th", { style: { padding: "6px 12px", textAlign: "left", color: S.mu, fontWeight: 500 }, children: "Nombre" }),
      /* @__PURE__ */ jsxRuntime.jsx("th", { style: { padding: "6px 12px", textAlign: "left", color: S.mu, fontWeight: 500, width: 70 }, children: "Tipo" }),
      /* @__PURE__ */ jsxRuntime.jsx("th", { style: { padding: "6px 12px", textAlign: "right", color: S.mu, fontWeight: 500, width: 80 }, children: "Tama\xF1o" })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: sorted.map((f, i) => /* @__PURE__ */ jsxRuntime.jsxs(
      "tr",
      {
        onClick: () => handleFileClick(f),
        style: {
          cursor: "pointer",
          borderBottom: `1px solid ${S.bc}`,
          background: i % 2 === 0 ? S.row : S.bg
        },
        onMouseEnter: (e) => e.currentTarget.style.background = `${S.pr}10`,
        onMouseLeave: (e) => e.currentTarget.style.background = i % 2 === 0 ? S.row : S.bg,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "6px 12px", textAlign: "center" }, children: fileIcon(f) }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "6px 12px", color: f.type === "dir" ? S.pr : S.tx }, children: f.name }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "6px 12px", color: S.mu }, children: f.type === "dir" ? "Directorio" : f.ext || "archivo" }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "6px 12px", textAlign: "right", color: S.mu }, children: f.type === "file" ? formatSize(f.size) : "\u2014" })
        ]
      },
      i
    )) })
  ] }) });
}
function GliaFileViewer({ content, fileName, loading, error, onClose }) {
  if (loading) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: "#8b949e", fontSize: 13, fontFamily: "system-ui, sans-serif" }, children: "Cargando contenido..." });
  }
  if (error) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: 16, color: "#f85149", fontSize: 13, fontFamily: "system-ui, sans-serif" }, children: [
      "Error: ",
      error
    ] });
  }
  if (content === null) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: "#8b949e", fontSize: 13, fontFamily: "system-ui, sans-serif" }, children: "Seleccion\xE1 un archivo para ver su contenido." });
  }
  const isMarkdown = fileName?.endsWith(".md");
  const ext = fileName?.split(".").pop()?.toLowerCase();
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderBottom: "1px solid #21262d",
      background: "#161b22",
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: 12, color: "#8b949e" }, children: [
        "\u{1F4C4} ",
        fileName || "archivo",
        ext && /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { marginLeft: 8, color: "#484f58" }, children: [
          ".",
          ext
        ] })
      ] }),
      onClose && /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: onClose,
          style: { background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 16, padding: 0 },
          children: "\u2715"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { style: {
      flex: 1,
      overflow: "auto",
      padding: 16,
      background: "#0d1117",
      color: "#e6edf3",
      fontSize: 13,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontFamily: isMarkdown ? "system-ui, sans-serif" : "'SF Mono', 'Fira Code', monospace"
    }, children: content }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
      padding: "4px 12px",
      borderTop: "1px solid #21262d",
      background: "#161b22",
      fontSize: 10,
      color: "#484f58",
      flexShrink: 0
    }, children: [
      content.length.toLocaleString(),
      " bytes \xB7 ",
      content.split("\n").length,
      " l\xEDneas"
    ] })
  ] });
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
var S2 = {
  bg: "#0d1117",
  row: "#161b22",
  bc: "#21262d",
  tx: "#e6edf3",
  mu: "#8b949e",
  ha: "#484f58",
  green: "#238636",
  red: "#f85149"};
function AgentSkillPanel({ agentId, token, somaUrl = "http://soma.zea.localhost", onRefresh }) {
  const [allSkills, setAllSkills] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const [error, setError] = react.useState(null);
  const [viewingSkill, setViewingSkill] = react.useState(null);
  const [skillContent, setSkillContent] = react.useState(null);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = `${somaUrl}/api/v1`;
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/skills`, { headers });
      if (res.ok) setAllSkills((await res.json()).data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  react.useEffect(() => {
    load();
  }, [token, agentId]);
  const assignedSkills = allSkills.filter((s) => (s.agents || []).includes(agentId));
  const availableSkills = allSkills.filter((s) => !(s.agents || []).includes(agentId));
  const assign = async (skillName) => {
    const currentAgents = allSkills.find((s) => s.name === skillName)?.agents || [];
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ agentIds: [...currentAgents, agentId] })
    });
    onRefresh?.();
    load();
  };
  const unassign = async (skillName) => {
    const currentAgents = (allSkills.find((s) => s.name === skillName)?.agents || []).filter((id) => id !== agentId);
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ agentIds: currentAgents })
    });
    onRefresh?.();
    load();
  };
  const viewContent = async (skillName) => {
    if (viewingSkill === skillName) {
      setViewingSkill(null);
      return;
    }
    setViewingSkill(skillName);
    try {
      const res = await fetch(`${api}/skills/${skillName}`, { headers });
      if (res.ok) setSkillContent((await res.json()).data?.content || null);
    } catch {
      setSkillContent(null);
    }
  };
  if (loading) return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: S2.mu, fontSize: 13 }, children: "Loading skills..." });
  if (error) return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: S2.red, fontSize: 13 }, children: error });
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 13, height: "100%", overflow: "auto" }, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("h3", { style: { fontSize: 14, fontWeight: 600, color: S2.tx, marginBottom: 8 }, children: [
      "\u{1F4CB} Skills asignadas (",
      assignedSkills.length,
      ")"
    ] }),
    assignedSkills.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: S2.mu, marginBottom: 16 }, children: "No hay skills asignadas a este agente." }),
    assignedSkills.map((s) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: "8px 12px", marginBottom: 6, background: S2.row, borderRadius: 6, border: `1px solid ${S2.bc}` }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { cursor: "pointer", flex: 1 }, onClick: () => viewContent(s.name), children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: S2.tx, fontWeight: 500 }, children: s.name }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: S2.ha, fontSize: 11, marginTop: 2 }, children: s.description?.slice(0, 100) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => unassign(s.name), style: {
          background: S2.red,
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "3px 8px",
          cursor: "pointer",
          fontSize: 10,
          fontFamily: "inherit",
          flexShrink: 0
        }, children: "\u2715 Desinstalar" })
      ] }),
      viewingSkill === s.name && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { marginTop: 8, padding: 8, background: S2.bg, borderRadius: 4, fontSize: 10, color: S2.tx, maxHeight: 150, overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace" }, children: skillContent || "(sin contenido)" })
    ] }, s.name)),
    /* @__PURE__ */ jsxRuntime.jsxs("h3", { style: { fontSize: 14, fontWeight: 600, color: S2.tx, marginBottom: 8, marginTop: 20 }, children: [
      "\u{1F4E6} Skills disponibles (",
      availableSkills.length,
      ")"
    ] }),
    availableSkills.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: S2.mu }, children: "Todas las skills est\xE1n asignadas." }),
    availableSkills.map((s) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: "8px 12px", marginBottom: 6, background: S2.row, borderRadius: 6, border: `1px dashed ${S2.bc}`, opacity: 0.7 }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { cursor: "pointer", flex: 1 }, onClick: () => viewContent(s.name), children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: S2.tx, fontWeight: 500 }, children: s.name }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: S2.ha, fontSize: 11, marginTop: 2 }, children: s.description?.slice(0, 100) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => assign(s.name), style: {
          background: S2.green,
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "3px 8px",
          cursor: "pointer",
          fontSize: 10,
          fontFamily: "inherit",
          flexShrink: 0
        }, children: "+ Instalar" })
      ] }),
      viewingSkill === s.name && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { marginTop: 8, padding: 8, background: S2.bg, borderRadius: 4, fontSize: 10, color: S2.tx, maxHeight: 150, overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace" }, children: skillContent || "(sin contenido)" })
    ] }, s.name))
  ] });
}
var Z = {
  mu: "#8b949e",
  pr: "#58a6ff"
};
function SomaPanel() {
  const [view, setView] = react.useState("files");
  const navItem = (v, label, icon) => /* @__PURE__ */ jsxRuntime.jsxs(
    "button",
    {
      onClick: () => setView(v),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 16px",
        border: "none",
        cursor: "pointer",
        background: view === v ? `${Z.pr}15` : "transparent",
        color: view === v ? Z.pr : Z.mu,
        fontSize: 13,
        fontFamily: "system-ui, sans-serif",
        textAlign: "left"
      },
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: 14, width: 20, textAlign: "center" }, children: icon }),
        label
      ]
    }
  );
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
    navItem("files", "Files", "\u{1F4C1}"),
    navItem("skills", "Skills", "\u{1F6E0}\uFE0F")
  ] });
}
var S3 = {
  bg: "#0d1117",
  row: "#161b22",
  bc: "#21262d",
  tx: "#e6edf3",
  mu: "#8b949e",
  pr: "#58a6ff",
  ha: "#484f58",
  green: "#238636",
  red: "#f85149"};
function SkillManager({ token, somaUrl = "http://soma.zea.localhost", onSkillAssigned }) {
  const [skills, setSkills] = react.useState([]);
  const [agents, setAgents] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const [error, setError] = react.useState(null);
  const [showAdd, setShowAdd] = react.useState(false);
  const [newName, setNewName] = react.useState("");
  const [newContent, setNewContent] = react.useState("");
  const [viewingSkill, setViewingSkill] = react.useState(null);
  const [skillContent, setSkillContent] = react.useState(null);
  const [search, setSearch] = react.useState("");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = `${somaUrl}/api/v1`;
  const load = async () => {
    setLoading(true);
    try {
      const [sr, ar] = await Promise.all([
        fetch(`${api}/skills`, { headers }),
        fetch(`${api}/agents`, { headers })
      ]);
      if (sr.ok) setSkills((await sr.json()).data || []);
      if (ar.ok) setAgents((await ar.json()).data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  react.useEffect(() => {
    load();
  }, [token]);
  const addSkill = async () => {
    if (!newName.trim()) return;
    const safeName = newName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    await fetch(`${api}/skills`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: safeName, content: newContent })
    });
    setNewName("");
    setNewContent("");
    setShowAdd(false);
    load();
  };
  const assignToAgent = async (skillName, agentId) => {
    const currentAgents = skills.find((s) => s.name === skillName)?.agents || [];
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ agentIds: [...currentAgents, agentId] })
    });
    onSkillAssigned?.();
    load();
  };
  const unassignFromAgent = async (skillName, agentId) => {
    const currentAgents = (skills.find((s) => s.name === skillName)?.agents || []).filter((id) => id !== agentId);
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ agentIds: currentAgents })
    });
    load();
  };
  const viewContent = async (skillName) => {
    if (viewingSkill === skillName) {
      setViewingSkill(null);
      return;
    }
    setViewingSkill(skillName);
    try {
      const res = await fetch(`${api}/skills/${skillName}`, { headers });
      if (res.ok) setSkillContent((await res.json()).data?.content || null);
    } catch {
      setSkillContent(null);
    }
  };
  const deleteSkill = async (skillName) => {
    await fetch(`${api}/skills/${skillName}`, { method: "DELETE", headers });
    load();
  };
  const getAgentName = (id) => agents.find((a) => a.id === id)?.name || id?.slice(0, 8) || "?";
  const filtered = skills.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase())
  );
  if (loading) return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: S3.mu, fontSize: 12 }, children: "Loading skills..." });
  if (error) return /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: 16, color: S3.red, fontSize: 12 }, children: error });
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { fontFamily: "system-ui, sans-serif" }, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: `1px solid ${S3.bc}` }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: 11, fontWeight: 600, color: S3.mu, textTransform: "uppercase" }, children: [
        "Skills (",
        skills.length,
        ")"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", gap: 4 }, children: /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => setShowAdd(!showAdd), style: { background: S3.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }, children: "+ Add" }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { style: { padding: "4px 16px" }, children: /* @__PURE__ */ jsxRuntime.jsx("input", { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "\u{1F50D} Filter skills...", style: { width: "100%", background: S3.bg, border: `1px solid ${S3.bc}`, borderRadius: 4, color: S3.tx, padding: "3px 8px", fontSize: 11, fontFamily: "inherit", outline: "none", boxSizing: "border-box" } }) }),
    showAdd && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 6 }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("input", { value: newName, onChange: (e) => setNewName(e.target.value), placeholder: "skill-name", style: inputStyle }),
      /* @__PURE__ */ jsxRuntime.jsx("textarea", { value: newContent, onChange: (e) => setNewContent(e.target.value), placeholder: "SKILL.md content...", rows: 3, style: { ...inputStyle, resize: "vertical", minHeight: 60 } }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: addSkill, style: { background: S3.green, color: "#fff", border: "none", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }, children: "Create Skill" })
    ] }),
    filtered.map((s) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: "6px 16px", borderBottom: `1px solid ${S3.bc}` }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { flex: 1, minWidth: 0, cursor: "pointer" }, onClick: () => viewContent(s.name), children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: 12, color: S3.tx, fontWeight: 500 }, children: s.name }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: 10, color: S3.ha, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }, children: s.description?.slice(0, 80) }),
          (s.agents || []).length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }, children: (s.agents || []).map((aid) => /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: 9, background: `${S3.pr}20`, color: S3.pr, padding: "0px 5px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 2 }, children: [
            getAgentName(aid),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  unassignFromAgent(s.name, aid);
                },
                style: { background: "none", border: "none", color: S3.red, cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 },
                children: "\xD7"
              }
            )
          ] }, aid)) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }, children: [
          s.custom && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: 8, background: "#3fb95020", color: "#3fb950", padding: "1px 4px", borderRadius: 3 }, children: "custom" }),
          s.builtin && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: 8, background: `${S3.pr}20`, color: S3.pr, padding: "1px 4px", borderRadius: 3 }, children: "builtin" }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              value: "",
              onChange: (e) => {
                if (e.target.value) assignToAgent(s.name, e.target.value);
              },
              style: { background: S3.row, border: `1px solid ${S3.bc}`, borderRadius: 3, color: S3.mu, fontSize: 9, fontFamily: "inherit", padding: "1px 4px", maxWidth: 90 },
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", children: "+ assign" }),
                agents.filter((a) => !(s.agents || []).includes(a.id)).map((a) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: a.id, children: (a.name || a.email || "").slice(0, 14) }, a.id))
              ]
            }
          ),
          s.custom && /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => deleteSkill(s.name), style: { background: "none", border: "none", color: S3.red, cursor: "pointer", fontSize: 10, padding: 0 }, children: "\u{1F5D1}" })
        ] })
      ] }),
      viewingSkill === s.name && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { marginTop: 6, padding: 8, background: S3.bg, borderRadius: 4, border: `1px solid ${S3.bc}`, fontSize: 10, color: S3.tx, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace" }, children: skillContent || "(sin contenido)" })
    ] }, s.name))
  ] });
}
var inputStyle = {
  width: "100%",
  background: S3.bg,
  border: `1px solid ${S3.bc}`,
  borderRadius: 4,
  color: S3.tx,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box"
};

// src/sandbox/rest-provider.ts
function createRestSandboxProvider(options = {}) {
  const base = options.baseUrl || "";
  const getHeaders = options.authHeaders || (() => options.apiKey ? { "x-api-key": options.apiKey } : {});
  async function apiFetch2(path, init) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...getHeaders(), ...init?.headers || {} }
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    return res.json();
  }
  return {
    async listFiles(p) {
      const data = await apiFetch2(`/api/v1/files?path=${encodeURIComponent(p)}`);
      return (data.files || []).map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        ext: f.ext
      }));
    },
    async readFile(p) {
      const res = await fetch(`${base}/api/v1/files/content?path=${encodeURIComponent(p)}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`Read failed: ${res.status}`);
      return res.text();
    },
    async writeFile(p, content) {
      const name = p.split("/").pop() || "file";
      const dir = p.split("/").slice(0, -1).join("/");
      const data = btoa(unescape(encodeURIComponent(content)));
      await apiFetch2("/api/v1/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data, path: dir })
      });
    },
    async deleteFile(p) {
      await apiFetch2(`/api/v1/files?path=${encodeURIComponent(p)}`, { method: "DELETE" });
    },
    async mkdir(p) {
      await apiFetch2("/api/v1/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: p })
      });
    }
  };
}

// src/sandbox/memory-provider.ts
function createMemorySandboxProvider() {
  const files = /* @__PURE__ */ new Map();
  function normPath(p) {
    return p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  }
  return {
    async listFiles(p) {
      const base = normPath(p);
      const seen = /* @__PURE__ */ new Set();
      const result = [];
      for (const [fp, content] of files) {
        if (!fp.startsWith(base === "/" ? "" : base)) continue;
        const relative = fp.slice(base === "/" ? 1 : base.length + 1);
        const parts = relative.split("/");
        const name = parts[0];
        if (seen.has(name)) continue;
        seen.add(name);
        if (parts.length === 1) {
          result.push({ name, type: "file", size: content.length });
        } else {
          result.push({ name, type: "dir", size: 0 });
        }
      }
      return result;
    },
    async readFile(p) {
      const key = normPath(p);
      const content = files.get(key);
      if (content === void 0) throw new Error(`File not found: ${p}`);
      return content;
    },
    async writeFile(p, content) {
      files.set(normPath(p), content);
    },
    async deleteFile(p) {
      files.delete(normPath(p));
    },
    async mkdir(_p) {
    }
  };
}

exports.AgentSkillPanel = AgentSkillPanel;
exports.GliaChat = GliaChat;
exports.GliaConversationList = GliaConversationList;
exports.GliaCopilot = GliaCopilot;
exports.GliaFileBrowser = GliaFileBrowser;
exports.GliaFileViewer = GliaFileViewer;
exports.GliaSkillEditor = GliaSkillEditor;
exports.SkillManager = SkillManager;
exports.SomaPanel = SomaPanel;
exports.createMemorySandboxProvider = createMemorySandboxProvider;
exports.createRestSandboxProvider = createRestSandboxProvider;
exports.useGlia = useGlia;
exports.useGliaAgents = useGliaAgents;
exports.useGliaConversations = useGliaConversations;
exports.useGliaFileContent = useGliaFileContent;
exports.useGliaFiles = useGliaFiles;
exports.useGliaSkills = useGliaSkills;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map