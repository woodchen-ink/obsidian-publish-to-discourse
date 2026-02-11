import { DiscourseSyncSettings } from './config';

export interface ActiveFile {
    name: string;
    content: string;
    postId?: number;
    tags?: string[];
}

export interface PluginInterface {
    settings: DiscourseSyncSettings;
    activeFile: ActiveFile;
    saveSettings(): Promise<void>;
    publishTopic(): Promise<{ success: boolean; error?: string }>;
}

export interface DiscourseCategory {
    id: number;
    name: string;
    color: string;
    depth: number;
    parent_category_id?: number;
}