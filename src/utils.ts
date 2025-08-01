import { TFile } from 'obsidian';
import * as yaml from 'yaml';
import { generateForumKey } from './forum-key';


// 从内容中提取Front Matter
export function getFrontMatter(content: string): any {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        try {
            return yaml.parse(fmMatch[1]);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// 移除内容中的Front Matter
export function removeFrontMatter(content: string): string {
    return content.replace(/^---[\s\S]*?---\n/, '');
}

// 检查文件是否为图片或PDF
export function isImageFile(file: TFile): boolean {
    const imageExtensions = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "pdf"];
    return imageExtensions.includes(file.extension.toLowerCase());
}

// 多论坛元数据管理
export interface ForumMetadata {
    post_id: number;
    topic_id: number;
    url: string;
    category_id: number;
    tags: string[];
}

// 获取特定论坛的元数据
export function getForumMetadata(content: string, baseUrl: string): ForumMetadata | null {
    const forumKey = generateForumKey(baseUrl);
    const fm = getFrontMatter(content);
    
    if (fm?.[forumKey]) {
        return {
            ...fm[forumKey],
            url: fm[`${forumKey}_url`] || ''
        };
    }
    
    return null;
}

// 设置特定论坛的元数据
export function setForumMetadata(content: string, baseUrl: string, metadata: ForumMetadata): string {
    let fm = getFrontMatter(content);
    
    if (!fm) {
        fm = {};
    }
    
    const forumKey = generateForumKey(baseUrl);
    
    // 分离存储：主要数据和URL分开
    const { url, ...mainData } = metadata;
    fm[forumKey] = mainData;
    fm[`${forumKey}_url`] = url;
    
    const contentWithoutFm = removeFrontMatter(content);
    return `---\n${yaml.stringify(fm)}---\n${contentWithoutFm}`;
} 