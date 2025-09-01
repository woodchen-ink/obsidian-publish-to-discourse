import { App, TFile } from 'obsidian';
import { NotifyUser } from './notification';
import { DiscourseAPI } from './api';
import { isImageFile } from './utils';

export class EmbedHandler {
    constructor(
        private app: App,
        private api: DiscourseAPI
    ) {}

    // 提取嵌入引用
    extractEmbedReferences(content: string): string[] {
        const references: string[] = [];
        
        // 匹配 ![[...]] 格式 (Wiki格式)
        const wikiRegex = /!\[\[(.*?)\]\]/g;
        let match;
        while ((match = wikiRegex.exec(content)) !== null) {
            references.push(match[1]);
        }
        
        // 匹配 ![](path) 格式 (Markdown格式)
        const markdownRegex = /!\[.*?\]\(([^)]+)\)/g;
        while ((match = markdownRegex.exec(content)) !== null) {
            // 过滤掉网络URL，只处理本地文件路径
            const path = match[1];
            if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('upload://')) {
                references.push(path);
            }
        }
        
        return references;
    }

    // 处理嵌入内容
    async processEmbeds(embedReferences: string[], activeFileName: string, useRemoteUrl = false): Promise<string[]> {
        const uploadedUrls: string[] = [];
        for (const ref of embedReferences) {
            // 处理带有 # 和 | 的文件路径，分离文件名和标题部分
            let filePart = ref;
            const hashIndex = filePart.indexOf("#");
            if (hashIndex >= 0) {
                filePart = filePart.substring(0, hashIndex).trim();
            }
            
            const pipeIndex = filePart.indexOf("|");
            if (pipeIndex >= 0) {
                filePart = filePart.substring(0, pipeIndex).trim();
            }
            
            const filePath = this.app.metadataCache.getFirstLinkpathDest(filePart, activeFileName)?.path;
            if (filePath) {
                const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
                if (abstractFile instanceof TFile) {
                    // 检查是否为图片或PDF文件
                    if (isImageFile(abstractFile)) {
                        const imageResult = await this.api.uploadImage(abstractFile);
                        if (imageResult) {
                            // 根据配置选择使用短URL还是完整URL
                            const urlToUse = useRemoteUrl && imageResult.fullUrl ? imageResult.fullUrl : imageResult.shortUrl;
                            uploadedUrls.push(urlToUse);
                        } else {
                            uploadedUrls.push("");
                        }
                    } else {
                        // 非图片文件，返回空字符串
                        uploadedUrls.push("");
                    }
                } else {
                    new NotifyUser(this.app, `File not found in vault: ${ref}`).open();
                    uploadedUrls.push("");
                }
            } else {
                new NotifyUser(this.app, `Unable to resolve file path for: ${ref}`).open();
                uploadedUrls.push("");
            }
        }
        return uploadedUrls;
    }

    // 替换内容中的嵌入引用为Markdown格式
    replaceEmbedReferences(content: string, embedReferences: string[], uploadedUrls: string[]): string {
        let processedContent = content;
        
        embedReferences.forEach((ref, index) => {
            if (uploadedUrls[index]) {
                // 处理 ![[...]] 格式 (Wiki格式)
                const wikiRef = `![[${ref}]]`;
                const wikiReplacement = `![${ref}](${uploadedUrls[index]})`;
                processedContent = processedContent.replace(wikiRef, wikiReplacement);
                
                // 处理 ![](path) 格式 (Markdown格式)
                // 创建正则表达式来匹配具体的路径
                const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedRef}\\)`, 'g');
                const markdownReplacement = `![$1](${uploadedUrls[index]})`;
                processedContent = processedContent.replace(markdownRegex, markdownReplacement);
            }
        });
        
        return processedContent;
    }
} 