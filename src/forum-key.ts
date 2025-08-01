/**
 * 论坛标识生成器
 * 从 baseURL 提取有意义的论坛标识，用于元数据存储
 */

// 常见的子域名，这些会被忽略以提取真正的主域名
const COMMON_SUBDOMAINS = new Set([
    'www', 'api', 'cdn', 'static', 'assets', 'img', 'images'
]);

// 顶级域名列表，用于正确识别主域名
const COMMON_TLDS = new Set([
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'co.uk', 'co.jp', 'com.au', 'com.cn', 'co.in', 'md'
]);

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
        
        // 分割域名部分
        const parts = hostname.split('.');
        
        if (parts.length < 2) {
            // 单个部分，直接返回
            return sanitizeKey(parts[0]);
        }
        
        // 找到主域名和子域名
        const { subdomain, mainDomain } = extractDomainParts(parts);
        
        // 组合标识
        if (subdomain && !COMMON_SUBDOMAINS.has(subdomain)) {
            return sanitizeKey(`${subdomain}_${mainDomain}`);
        }
        
        return sanitizeKey(mainDomain);
        
    } catch (error) {
        // URL 解析失败，使用简化处理
        console.warn('Failed to parse forum URL:', baseUrl, error);
        return sanitizeKey(baseUrl.replace(/[^a-zA-Z0-9]/g, '_')).substring(0, 20);
    }
}

/**
 * 提取域名的子域名和主域名部分
 */
function extractDomainParts(parts: string[]): { subdomain: string | null; mainDomain: string } {
    if (parts.length === 2) {
        // 只有主域名和顶级域名
        return {
            subdomain: null,
            mainDomain: parts[0]
        };
    }
    
    // 检查是否是复合顶级域名 (如 co.uk)
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    const isCompoundTLD = COMMON_TLDS.has(lastTwo);
    
    if (isCompoundTLD && parts.length >= 3) {
        // 复合顶级域名: subdomain.example.co.uk
        const mainDomainIndex = parts.length - 3;
        return {
            subdomain: parts.length > 3 ? parts[mainDomainIndex - 1] : null,
            mainDomain: parts[mainDomainIndex]
        };
    } else {
        // 普通顶级域名: subdomain.example.com
        const mainDomainIndex = parts.length - 2;
        return {
            subdomain: parts.length > 2 ? parts[mainDomainIndex - 1] : null,
            mainDomain: parts[mainDomainIndex]
        };
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
        
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            const { subdomain, mainDomain } = extractDomainParts(parts);
            if (subdomain && !COMMON_SUBDOMAINS.has(subdomain)) {
                return `${subdomain}.${mainDomain}`;
            }
            return mainDomain;
        }
        
        return hostname;
    } catch {
        return baseUrl;
    }
}