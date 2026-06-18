export { useGlia, useGliaAgents, useGliaConversations, useGliaFileContent, useGliaFiles, useGliaSkills } from './hooks/index.mjs';
export { A as AgentSkillPanel, G as GliaChat, a as GliaChatColors, b as GliaChatMessage, c as GliaChatProps, d as GliaConversationList, e as GliaCopilot, f as GliaFileBrowser, g as GliaFileViewer, h as GliaSkillEditor } from './index-DH4DS-pc.mjs';
import React from 'react';
export { G as GliaAgent, a as GliaConversation, b as GliaFile, c as GliaMessage, d as GliaSkill, e as GliaStreamEvent, U as UseGliaOptions, f as UseGliaReturn } from './index-DWjQUqKI.mjs';

declare function SomaPanel(): React.JSX.Element;

interface SkillManagerProps {
    token: string;
    somaUrl?: string;
    onSkillAssigned?: () => void;
}
declare function SkillManager({ token, somaUrl, onSkillAssigned }: SkillManagerProps): React.JSX.Element;

interface WorkspaceFile {
    name: string;
    type: 'file' | 'dir';
    size: number;
    ext?: string;
}
interface UserWorkspaceProps {
    /** Tipo de owner: 'user' | 'agent' | 'org' */
    ownerType?: 'user' | 'agent' | 'org';
    /** ID del usuario/agente/org */
    ownerId: string;
    /** Org ID para workspace compartido */
    orgId?: string;
    /** URL base de Soma */
    baseUrl?: string;
    /** API key o factory de auth headers */
    authHeaders?: () => Record<string, string>;
    /** Color scheme override */
    colors?: Partial<UserWorkspaceColors>;
    /** Callback al seleccionar archivo */
    onSelectFile?: (file: WorkspaceFile) => void;
    /** Mostrar uploader */
    showUpload?: boolean;
}
interface UserWorkspaceColors {
    bg: string;
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
    error: string;
    success: string;
    radius: string;
}
declare function useUserWorkspace(options: {
    ownerType: 'user' | 'agent' | 'org';
    ownerId: string;
    orgId?: string;
    baseUrl?: string;
    authHeaders?: () => Record<string, string>;
}): {
    files: WorkspaceFile[];
    loading: boolean;
    error: string | null;
    currentPath: string;
    setCurrentPath: React.Dispatch<React.SetStateAction<string>>;
    fetchFiles: (path?: string) => Promise<void>;
    navigateTo: (dirName: string) => void;
    navigateUp: () => void;
    upload: (name: string, data: string, path?: string) => Promise<boolean>;
};
declare function UserWorkspace({ ownerType, ownerId, orgId, baseUrl, authHeaders, colors: colorOverrides, onSelectFile, showUpload, }: UserWorkspaceProps): React.JSX.Element;

interface UserFileDropZoneProps {
    /** Called when files are successfully uploaded */
    onUploaded?: () => void;
    /** Upload function: (name, base64data, path?) => Promise<boolean> */
    onUpload: (name: string, base64data: string, path?: string) => Promise<boolean>;
    /** Current directory path for upload */
    currentPath?: string;
    /** Accepted file extensions */
    accept?: string;
    /** Custom colors */
    colors?: {
        bg?: string;
        border?: string;
        primary?: string;
        text?: string;
        textSecondary?: string;
    };
    /** Disable drag-and-drop */
    disableDrag?: boolean;
}
/**
 * Drag-and-drop file upload zone.
 * Generic — works with any upload backend.
 * Drop here, use in sidebar or main content area.
 */
declare function UserFileDropZone({ onUploaded, onUpload, currentPath, accept, colors: cOverride, disableDrag, }: UserFileDropZoneProps): React.JSX.Element;

/**
 * SandboxProvider — abstraction for agent file storage.
 *
 * Implement this interface to plug any storage backend (S3, GCS, local FS, memory)
 * into GliaFileBrowser without depending on Soma's REST API.
 */
interface SandboxFile {
    name: string;
    type: 'file' | 'dir';
    size: number;
    ext?: string;
}
interface SandboxProvider {
    /** List files and directories at the given path */
    listFiles(path: string): Promise<SandboxFile[]>;
    /** Read file content as string */
    readFile(path: string): Promise<string>;
    /** Write content to a file, creating parent directories as needed */
    writeFile(path: string, content: string): Promise<void>;
    /** Delete a file or empty directory */
    deleteFile(path: string): Promise<void>;
    /** Create a directory */
    mkdir(path: string): Promise<void>;
    /** Optional: get Git-like commit history */
    history?(path: string): Promise<Array<{
        hash: string;
        message: string;
    }>>;
}

/**
 * RestSandboxProvider — connects to Soma's /api/v1/files REST API.
 *
 * This is the default provider when no custom sandbox is passed to GliaFileBrowser.
 */

interface RestSandboxOptions {
    baseUrl?: string;
    apiKey?: string;
    authHeaders?: () => Record<string, string>;
}
declare function createRestSandboxProvider(options?: RestSandboxOptions): SandboxProvider;

/**
 * MemorySandboxProvider — in-memory file storage for tests and demos.
 */

declare function createMemorySandboxProvider(): SandboxProvider;

export { type SandboxFile, type SandboxProvider, SkillManager, SomaPanel, UserFileDropZone, type UserFileDropZoneProps, UserWorkspace, type UserWorkspaceColors, type UserWorkspaceProps, type WorkspaceFile, createMemorySandboxProvider, createRestSandboxProvider, useUserWorkspace };
