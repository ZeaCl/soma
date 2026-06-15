import React from 'react';
import { b as GliaFile, d as GliaSkill } from './index-DWjQUqKI.js';

interface GliaChatProps {
    agentId: string;
    conversationId?: string;
    apiKey?: string;
    baseUrl?: string;
    placeholder?: string;
    welcomeMessage?: string;
    /** CSS class applied to root element */
    className?: string;
    /** Quick color overrides — for full control use CSS variables on parent */
    colors?: Partial<GliaChatColors>;
    /** Custom render functions for specific parts */
    renderMessage?: (msg: GliaChatMessage, defaultRender: React.ReactNode) => React.ReactNode;
    renderInput?: (defaultRender: React.ReactNode) => React.ReactNode;
}
interface GliaChatColors {
    bg: string;
    text: string;
    textMuted: string;
    userBubble: string;
    userBubbleText: string;
    agentBubble: string;
    agentBubbleText: string;
    thinkingBg: string;
    thinkingText: string;
    thinkingBorder: string;
    toolBg: string;
    toolText: string;
    toolBorder: string;
    resultBg: string;
    resultText: string;
    resultBorder: string;
    inputBg: string;
    inputBorder: string;
    primary: string;
    primaryText: string;
    font: string;
    radius: string;
}
interface GliaChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    thinking?: string;
    timestamp: Date;
}
declare function GliaChat({ agentId, conversationId, apiKey, baseUrl, placeholder, welcomeMessage, className, colors: colorsOverride, renderMessage, renderInput, }: GliaChatProps): React.JSX.Element;

interface GliaCopilotProps {
    agentId: string;
    apiKey?: string;
    baseUrl?: string;
    open?: boolean;
    onClose?: () => void;
}
declare function GliaCopilot({ agentId, apiKey, baseUrl, open, onClose }: GliaCopilotProps): React.JSX.Element;

interface GliaConversationListProps {
    conversations: Array<{
        id: string;
        title: string;
        lastMessageAt: string;
        messageCount: number;
    }>;
    activeId?: string;
    onSelect?: (id: string) => void;
    onNew?: (agentId: string) => void;
    agents?: Array<{
        id: string;
        name: string;
    }>;
}
declare function GliaConversationList({ conversations, activeId, onSelect, agents }: GliaConversationListProps): React.JSX.Element;

interface GliaFileBrowserProps {
    files: GliaFile[];
    loading?: boolean;
    onSelect?: (file: GliaFile) => void;
    onUpload?: (name: string, data: string, path?: string) => Promise<boolean>;
    onMkdir?: (path: string) => Promise<void>;
    onDelete?: (path: string) => Promise<void>;
    onRename?: (path: string, newName: string) => Promise<void>;
    /** Si se provee, muestra contenido del archivo al clickear */
    readFile?: (path: string) => Promise<string | null>;
}
declare function GliaFileBrowser({ files, loading, onSelect, readFile }: GliaFileBrowserProps): React.JSX.Element;

interface GliaFileViewerProps {
    content: string | null;
    fileName?: string;
    loading?: boolean;
    error?: string | null;
    onClose?: () => void;
}
declare function GliaFileViewer({ content, fileName, loading, error, onClose }: GliaFileViewerProps): React.JSX.Element;

interface GliaSkillEditorProps {
    skills: GliaSkill[];
    loading?: boolean;
    onCreate?: (name: string, content: string) => Promise<boolean>;
    onDelete?: (name: string) => Promise<void>;
}
declare function GliaSkillEditor({ skills, loading, onCreate, onDelete }: GliaSkillEditorProps): React.JSX.Element;

export { GliaChat as G, type GliaChatColors as a, type GliaChatMessage as b, type GliaChatProps as c, GliaConversationList as d, GliaCopilot as e, GliaFileBrowser as f, GliaFileViewer as g, GliaSkillEditor as h };
