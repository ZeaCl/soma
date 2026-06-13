'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/components/GliaChat.tsx
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
        const d = JSON.parse(event.data);
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
function GliaChat({
  agentId,
  conversationId,
  apiKey,
  baseUrl,
  placeholder = "Mensaje para el agente...",
  welcomeMessage = "\xA1Hola! Soy tu agente. \xBFEn qu\xE9 puedo ayudarte?",
  suggestions = [],
  className = ""
}) {
  const { send, cancel, isStreaming, messages, streamContent } = useGlia({
    agentId,
    conversationId,
    apiKey,
    baseUrl
  });
  const [input, setInput] = react.useState("");
  const [cancelling, setCancelling] = react.useState(false);
  const feedRef = react.useRef(null);
  react.useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamContent]);
  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    send(text);
    setInput("");
  };
  const handleCancel = () => {
    setCancelling(true);
    cancel();
  };
  react.useEffect(() => {
    if (!isStreaming) setCancelling(false);
  }, [isStreaming]);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `flex flex-col h-full ${className}`, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { ref: feedRef, className: "flex-1 overflow-y-auto p-4 space-y-4", children: [
      messages.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-center text-sm text-gray-400 mt-[40%]", children: welcomeMessage }),
      messages.map((msg) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: `flex ${msg.role === "user" ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: `max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "whitespace-pre-wrap", children: msg.content }) }) }, msg.id)),
      isStreaming && streamContent && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-gray-100", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "whitespace-pre-wrap", children: streamContent }) }) }),
      isStreaming && !streamContent && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-4 py-2.5 text-sm text-gray-400", children: "Pensando..." }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "border-t p-3", children: [
      suggestions.length > 0 && !isStreaming && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex gap-2 mb-2 overflow-x-auto pb-1", children: suggestions.map((s, i) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: () => setInput(s.label),
          className: "shrink-0 px-3 py-1 rounded-full text-xs border hover:bg-gray-50",
          children: s.label
        },
        i
      )) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-end gap-2 border rounded-xl p-2 bg-gray-50", children: [
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
            className: "flex-1 resize-none border-none bg-transparent outline-none text-sm p-1",
            style: { opacity: isStreaming ? 0.5 : 1 }
          }
        ),
        isStreaming ? /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            onClick: handleCancel,
            disabled: cancelling,
            className: "w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white text-lg",
            title: "Detener",
            children: cancelling ? "\u23F3" : "\u25A0"
          }
        ) : /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            onClick: handleSend,
            className: "w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white",
            style: { opacity: input.trim() ? 1 : 0.4 },
            children: "\u2191"
          }
        )
      ] })
    ] })
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
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map