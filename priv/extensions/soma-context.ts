/**
 * soma-context.ts — Extensión Pi para inyección de Context Bundle (#192 Fase 2).
 *
 * Lee el archivo de contexto escrito por Soma en ~/.pi/agent/context/<session-id>.json
 * e inyecta el historial persistente en la sesión de pi si es una sesión nueva o fría.
 */

import * as fs from "fs";
import * as path from "path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (api: ExtensionAPI) {
  let contextInjected = false;

  api.on("before_agent_start", async (event, ctx) => {
    if (contextInjected) {
      return;
    }

    const sessionId = ctx.sessionManager.getSessionId();
    if (!sessionId) {
      return;
    }

    const homeDir = process.env.HOME || ctx.cwd;
    const contextPath = path.join(homeDir, ".pi", "agent", "context", `${sessionId}.json`);

    if (!fs.existsSync(contextPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(contextPath, "utf-8");
      const bundle = JSON.parse(content);

      if (!bundle) {
        return;
      }

      const hasMessages = Array.isArray(bundle.messages) && bundle.messages.length > 0;
      const hasSummary = typeof bundle.summary === "string" && bundle.summary.trim().length > 0;

      if (!hasMessages && !hasSummary) {
        return;
      }

      // Si la sesión pi ya tiene entradas históricas de turnos previos, no duplicamos
      const entries = ctx.sessionManager.getEntries ? ctx.sessionManager.getEntries() : [];
      const hasPriorMessages = entries.some(
        (e: any) => e.type === "message" || e.type === "turn"
      );

      if (hasPriorMessages) {
        contextInjected = true;
        return;
      }

      let memoryBlock = "\n\n## Memoria y contexto previos reconstruidos desde Postgres (Soma autoritativo):\n";

      if (hasSummary) {
        memoryBlock += `\n### Resumen acumulado de la conversación anterior:\n${bundle.summary.trim()}\n`;
      }

      if (hasMessages) {
        memoryBlock += "\n### Mensajes recientes del hilo:\n";
        for (const msg of bundle.messages) {
          const role = msg.role === "assistant" ? "Asistente" : "Usuario";
          memoryBlock += `\n**[${role}]**: ${msg.content}\n`;
        }
      }

      contextInjected = true;

      return {
        systemPrompt: event.systemPrompt + memoryBlock,
      };
    } catch (err) {
      // Si hay error de parseo o lectura, continuamos silenciosamente sin romper el agente
      return;
    }
  });
}
