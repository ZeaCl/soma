export { useGlia, useGliaAgents, useGliaConversations, useGliaFileContent, useGliaFiles, useGliaSkills } from './hooks/index.mjs';
export { G as GliaChat, a as GliaChatColors, b as GliaChatMessage, c as GliaChatProps, d as GliaConversationList, e as GliaCopilot, f as GliaFileBrowser, g as GliaFileViewer, h as GliaSkillEditor } from './index-CcHjEs8k.mjs';
import React from 'react';
export { G as GliaAgent, a as GliaConversation, b as GliaFile, c as GliaMessage, d as GliaSkill, e as GliaStreamEvent, U as UseGliaOptions, f as UseGliaReturn } from './index-DWjQUqKI.mjs';

declare function SomaPanel(): React.JSX.Element;

interface SkillManagerProps {
    token: string;
    somaUrl?: string;
    onSkillAssigned?: () => void;
}
declare function SkillManager({ token, somaUrl, onSkillAssigned }: SkillManagerProps): React.JSX.Element;

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

export { type SandboxFile, type SandboxProvider, SkillManager, SomaPanel, createMemorySandboxProvider, createRestSandboxProvider };
