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
  const wsUrl = baseUrl ? `${baseUrl.replace("http", "ws")}/agent-ws` : `ws://${typeof window !== "undefined" ? window.location.host : "localhost"}/agent-ws`;
  const connect = useCallback(() => {
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