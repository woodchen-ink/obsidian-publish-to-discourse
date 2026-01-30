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

// 从文章内容中提取标签
// 支持两种格式:
// 1. Frontmatter 中的 tags 字段 (YAML 格式)
// 2. 内容中的 #tag 格式 (Obsidian 行内标签)
export function extractTagsFromContent(content: string): string[] {
    const tags = new Set<string>();

    // 1. 从 Frontmatter 中提取 tags
    const fm = getFrontMatter(content);
    if (fm?.tags) {
        if (Array.isArray(fm.tags)) {
            fm.tags.forEach((tag: string) => tags.add(tag.trim()));
        } else if (typeof fm.tags === 'string') {
            // 处理逗号分隔的字符串格式
            fm.tags.split(',').forEach((tag: string) => tags.add(tag.trim()));
        }
    }

    // 2. 从内容中提取 #tag 格式的标签
    // 移除 Frontmatter 后再匹配，避免匹配到 YAML 中的内容
    const contentWithoutFm = removeFrontMatter(content);

    // 匹配 #tag 格式，支持中英文、数字、下划线、连字符
    // 排除代码块中的内容
    const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;
    const contentWithoutCode = contentWithoutFm.replace(codeBlockRegex, '');

    // 匹配标签: #开头，后面跟字母数字中文下划线连字符，不包含纯数字标签（如 #123）
    // 标签必须在单词边界或行首开始
    const tagRegex = /(?:^|[\s\[\(])#([a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5_\-\/]*)/gm;
    let match;
    while ((match = tagRegex.exec(contentWithoutCode)) !== null) {
        const tag = match[1].trim();
        if (tag) {
            tags.add(tag);
        }
    }

    return Array.from(tags);
} 