import { DiscourseSyncSettings } from './config';

export interface ActiveFile {
    name: string;
    content: string;
    postId?: number;
}

export interface PluginInterface {
    settings: DiscourseSyncSettings;
    activeFile: ActiveFile;
    saveSettings(): Promise<void>;
    publishTopic(): Promise<{ success: boolean; error?: string }>;
} 