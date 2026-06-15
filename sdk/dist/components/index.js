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

exports.GliaChat = GliaChat;
exports.GliaConversationList = GliaConversationList;
exports.GliaCopilot = GliaCopilot;
exports.GliaFileBrowser = GliaFileBrowser;
exports.GliaFileViewer = GliaFileViewer;
exports.GliaSkillEditor = GliaSkillEditor;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map