import { U as UseGliaOptions, f as UseGliaReturn, G as GliaAgent, a as GliaConversation, b as GliaFile, d as GliaSkill } from '../index-DQvGYkyZ.mjs';

declare function useGlia(options: UseGliaOptions): UseGliaReturn;

declare function useGliaConversations(apiKey: string, baseUrl?: string): {
    conversations: GliaConversation[];
    loading: boolean;
    refresh: () => Promise<void>;
};
declare function useGliaFiles(apiKey: string, baseUrl?: string): {
    files: GliaFile[];
    loading: boolean;
    refresh: (subpath?: string) => Promise<void>;
    upload: (name: string, data: string, path?: string) => Promise<boolean>;
    mkdir: (path: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    rename: (path: string, newName: string) => Promise<void>;
};
declare function useGliaSkills(apiKey: string, baseUrl?: string): {
    skills: GliaSkill[];
    loading: boolean;
    refresh: () => Promise<void>;
    create: (name: string, content: string) => Promise<boolean>;
    deleteSkill: (name: string) => Promise<void>;
};
declare function useGliaAgents(apiKey: string, baseUrl?: string): {
    agents: GliaAgent[];
    loading: boolean;
    refresh: () => Promise<void>;
};

export { useGlia, useGliaAgents, useGliaConversations, useGliaFiles, useGliaSkills };
