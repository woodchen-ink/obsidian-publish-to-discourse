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
        const regex = /!\[\[(.*?)\]\]/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    }

    // 处理嵌入内容
    async processEmbeds(embedReferences: string[], activeFileName: string): Promise<string[]> {
        const uploadedUrls: string[] = [];
        for (const ref of embedReferences) {
            // 处理带有#的文件路径，分离文件名和标题部分
            let filePart = ref;
            const hashIndex = filePart.indexOf("#");
            if (hashIndex >= 0) {
                filePart = filePart.substring(0, hashIndex).trim();
            }
            
            const filePath = this.app.metadataCache.getFirstLinkpathDest(filePart, activeFileName)?.path;
            if (filePath) {
                const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
                if (abstractFile instanceof TFile) {
                    // 检查是否为图片或PDF文件
                    if (isImageFile(abstractFile)) {
                        const imageUrl = await this.api.uploadImage(abstractFile);
                        uploadedUrls.push(imageUrl || "");
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
            const obsRef = `![[${ref}]]`;
            // 只有当上传URL不为空时（即为图片）才替换为Markdown格式的图片链接
            if (uploadedUrls[index]) {
                const discoRef = `![${ref}](${uploadedUrls[index]})`;
                processedContent = processedContent.replace(obsRef, discoRef);
            }
        });
        return processedContent;
    }
} 