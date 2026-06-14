import { useRef, useState, useCallback, useEffect } from 'react';

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
  const wsRef = useRef(null);
  const readyRef = useRef(false);
  const pendingRef = useRef([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const streamRef = useRef("");
  const wsUrl = baseUrl ? `${baseUrl.replace("https", "wss").replace("http", "ws")}${options.wsPath || "/agent-ws"}` : `${typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws"}://${typeof window !== "undefined" ? window.location.host : "localhost"}${options.wsPath || "/agent-ws"}`;
  const contentRef = useRef("");
  const thinkingRef = useRef("");
  const connect = useCallback(() => {
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
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
  const send = useCallback((text) => {
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
  const cancel = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "cancel" }));
  }, []);
  const reconnect = useCallback(() => {
    wsRef.current?.close();
    connect();
  }, [connect]);
  return { send, cancel, isConnected, isStreaming, messages, streamContent, reconnect };
}
var apiFetch = (url, options = {}) => fetch(url, options);
function useGliaConversations(apiKey, baseUrl = "") {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = useCallback(async () => {
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
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { conversations, loading, refresh };
}
function useGliaFiles(apiKey, baseUrl = "") {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = useCallback(async (subpath = "") => {
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
  useEffect(() => {
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
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = useCallback(async () => {
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
  useEffect(() => {
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
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = `${baseUrl || ""}/api/v1`;
  const refresh = useCallback(async () => {
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
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { agents, loading, refresh };
}

export { useGlia, useGliaAgents, useGliaConversations, useGliaFiles, useGliaSkills };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map