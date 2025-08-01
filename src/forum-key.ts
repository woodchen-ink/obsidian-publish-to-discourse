/**
 * 论坛标识生成器
 * 从 baseURL 提取有意义的论坛标识，用于元数据存储
 */


/**
 * 从 baseURL 提取论坛标识
 * 
 * 规则：
 * - https://meta.cursor.com → meta_cursor
 * - https://forum.obsidian.md → forum_obsidian  
 * - https://discourse.example.com → discourse_example
 * - https://example.com → example
 * - https://127.0.0.1:3000 → 127-0-0-1-3000
 * 
 * @param baseUrl 论坛的完整URL
 * @returns 论坛标识字符串
 */
export function generateForumKey(baseUrl: string): string {
    try {
        const url = new URL(baseUrl);
        const hostname = url.hostname.toLowerCase();
        const port = url.port;
        
        // 处理 IP 地址
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            const ipKey = hostname.replace(/\./g, '-');
            return port ? `${ipKey}-${port}` : ipKey;
        }
        
        // 使用正则表达式提取域名部分（排除最后一个.及其后面的部分）
        const domainMatch = hostname.match(/^(.+)\.([^.]+)$/);
        if (!domainMatch) {
            // 没有点号，直接返回
            return sanitizeKey(hostname);
        }
        
        const [, beforeLastDot] = domainMatch;
        
        // 进一步分析 beforeLastDot 部分
        const beforeParts = beforeLastDot.split('.');
        
        if (beforeParts.length === 1) {
            // 格式：example.com
            return sanitizeKey(beforeParts[0]);
        } else {
            // 格式：subdomain.example.com 或 sub.domain.example.com
            // 直接使用最后两个部分：subdomain_mainDomain
            const mainDomain = beforeParts[beforeParts.length - 1];
            const subdomain = beforeParts[beforeParts.length - 2];
            
            return sanitizeKey(`${subdomain}_${mainDomain}`);
        }
        
    } catch (error) {
        // URL 解析失败，使用简化处理
        console.warn('Failed to parse forum URL:', baseUrl, error);
        return sanitizeKey(baseUrl.replace(/[^a-zA-Z0-9]/g, '_')).substring(0, 20);
    }
}

/**
 * 清理和规范化标识符
 */
function sanitizeKey(key: string): string {
    return key
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // 替换特殊字符为下划线
        .replace(/_+/g, '_')              // 合并多个下划线
        .replace(/^_|_$/g, '')            // 移除首尾下划线
        .toLowerCase();
}

/**
 * 检测两个URL是否指向同一个论坛
 * 用于去重和验证
 */
export function isSameForum(url1: string, url2: string): boolean {
    try {
        const parsed1 = new URL(url1);
        const parsed2 = new URL(url2);
        
        return parsed1.hostname.toLowerCase() === parsed2.hostname.toLowerCase() &&
               parsed1.port === parsed2.port;
    } catch {
        return false;
    }
}

/**
 * 获取论坛的显示名称
 * 用于UI显示，比标识更友好
 */
export function getForumDisplayName(baseUrl: string): string {
    try {
        const url = new URL(baseUrl);
        const hostname = url.hostname.toLowerCase();
        
        // IP地址直接显示
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return url.port ? `${hostname}:${url.port}` : hostname;
        }
        
        // 使用正则表达式提取域名部分
        const domainMatch = hostname.match(/^(.+)\.([^.]+)$/);
        if (!domainMatch) {
            return hostname;
        }
        
        const [, beforeLastDot] = domainMatch;
        const beforeParts = beforeLastDot.split('.');
        
        if (beforeParts.length === 1) {
            // 格式：example.com
            return beforeParts[0];
        } else {
            // 格式：subdomain.example.com
            // 直接使用最后两个部分：subdomain.mainDomain
            const mainDomain = beforeParts[beforeParts.length - 1];
            const subdomain = beforeParts[beforeParts.length - 2];
            
            return `${subdomain}.${mainDomain}`;
        }
    } catch {
        return baseUrl;
    }
}