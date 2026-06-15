import { U as UseGliaOptions, f as UseGliaReturn, G as GliaAgent, a as GliaConversation, b as GliaFile, d as GliaSkill } from '../index-DWjQUqKI.js';

declare function useGlia(options: UseGliaOptions): UseGliaReturn;

declare function useGliaConversations(token: string, baseUrl?: string): {
    conversations: GliaConversation[];
    loading: boolean;
    refresh: () => Promise<void>;
};
declare function useGliaFiles(token: string, baseUrl?: string): {
    files: GliaFile[];
    loading: boolean;
    refresh: (subpath?: string) => Promise<void>;
    upload: (name: string, data: string, path?: string) => Promise<boolean>;
    mkdir: (path: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    rename: (path: string, newName: string) => Promise<void>;
};
declare function useGliaFileContent(token: string, baseUrl?: string): {
    content: string | null;
    loading: boolean;
    error: string | null;
    readFile: (path: string) => Promise<string | null>;
    clear: () => void;
};
declare function useGliaSkills(token: string, baseUrl?: string): {
    skills: GliaSkill[];
    loading: boolean;
    refresh: () => Promise<void>;
    create: (name: string, content: string) => Promise<boolean>;
    deleteSkill: (name: string) => Promise<void>;
};
declare function useGliaAgents(token: string, baseUrl?: string): {
    agents: GliaAgent[];
    loading: boolean;
    refresh: () => Promise<void>;
    createAgent: (data: {
        name: string;
        email: string;
        password: string;
        skills?: string[];
        system_prompt?: string;
    }) => Promise<any>;
};

export { useGlia, useGliaAgents, useGliaConversations, useGliaFileContent, useGliaFiles, useGliaSkills };
