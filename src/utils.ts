import { TFile } from 'obsidian';
import * as yaml from 'yaml';


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