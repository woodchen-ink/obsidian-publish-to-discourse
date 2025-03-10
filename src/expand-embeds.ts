/**
 * expandEmbeds.ts
 *
 * This module provides a recursive function to expand Obsidian-style embedded links (`![[file]]` and `![[file#heading]]`) 
 * by inlining their referenced content. It supports:
 * 
 * - Resolving full-note and section-level embeds (`![[file#subsection]]`)
 * - Expanding embedded content recursively while preventing infinite loops
 * - Handling multiple instances of the same embedded section within the same note
 * - Skipping the expansion of images (`png, jpg, gif, etc.`) and PDFs while preserving their original links
 *
 * The function maintains a call stack to track active expansions, ensuring that duplicate references in the same 
 * recursion chain are ignored (to prevent loops), while allowing repeated embeds elsewhere in the note.
 */

import { App, TFile, CachedMetadata } from "obsidian";

/**
 * 将frontmatter转换为Markdown引用格式
 */
function convertFrontmatterToQuote(content: string): string {
  // 检查是否有frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return content;

  // 提取frontmatter内容
  const fmContent = fmMatch[1];
  
  // 将frontmatter内容转换为引用格式
  const quotedFm = fmContent
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  
  // 替换原始frontmatter
  return content.replace(/^---\n[\s\S]*?\n---\n/, `${quotedFm}\n\n`);
}

/**
 * Recursively expands embedded content (including subpath references),
 * allowing the same (file+subpath) to appear multiple times if it's *not*
 * in the same immediate recursion stack.
 */
export async function expandEmbeds(
  app: App,
  file: TFile,
  stack: string[] = [],
  subpath?: string
): Promise<string> {
  const sp = subpath ?? "<entireFile>";
  const currentKey = `${file.path}::${sp}`;

  // If it's already on the current expansion stack, we have a cycle => skip
  if (stack.includes(currentKey)) {
    return "";
  }

  // Push it on stack
  stack.push(currentKey);

  // Now do the usual reading
  const raw = await app.vault.read(file);
  const embedRegex = /!\[\[([^\]]+)\]\]/g;

  // We'll do a standard async replacement
  const expandedWholeFile = await replaceAsync(raw, embedRegex, async (fullMatch, link) => {
    let [filePart] = link.split("|");

    let sub: string | undefined;
    const hashIndex = filePart.indexOf("#");
    if (hashIndex >= 0) {
      sub = filePart.substring(hashIndex + 1).trim();
      filePart = filePart.substring(0, hashIndex).trim();
    }

    const linkedTFile = app.metadataCache.getFirstLinkpathDest(filePart, file.path);
    if (!linkedTFile) {
      // The file doesn't exist
      return "";
    }

    // If it's an image, keep the link
    if (isIgnoredFile(linkedTFile)) {
      return fullMatch;
    }

    // Recursively expand that subpath
    const expandedContent = await expandEmbeds(app, linkedTFile, stack, sub);
    
    // 将嵌入内容中的frontmatter转换为引用格式
    return convertFrontmatterToQuote(expandedContent);
  });

  // Pop it from stack
  stack.pop();

  // If subpath was specified, slice out that portion
  if (subpath) {
    return sliceSubpathContent(app, file, expandedWholeFile, subpath);
  }

  return expandedWholeFile;
}

/**
 * If the user references a heading or a block (e.g. "#Heading" or "#^blockID"),
 * we slice out just that portion from the fully expanded content.
 */
function sliceSubpathContent(
  app: App,
  tfile: TFile,
  fileContent: string,
  subpath: string
): string {
  const fileCache = app.metadataCache.getFileCache(tfile);
  if (!fileCache) return fileContent;

  // Block reference => if subpath starts with '^'
  if (subpath.startsWith("^")) {
    const blockId = subpath.slice(1);
    const block = fileCache.blocks?.[blockId];
    if (!block) {
      return "";
    }
    const { start, end } = block.position;
    if (!end) {
      // Goes to EOF if no explicit end
      const slicedContent = fileContent.substring(start.offset);
      return convertFrontmatterToQuote(slicedContent);
    } else {
      const slicedContent = fileContent.substring(start.offset, end.offset);
      return convertFrontmatterToQuote(slicedContent);
    }
  }

  // Otherwise treat it as a heading
  return sliceHeading(fileContent, fileCache, subpath);
}

/**
 * Finds a heading by case-insensitive match and returns everything until 
 * the next heading of the same or shallower level.
 */
function sliceHeading(content: string, fileCache: CachedMetadata, headingName: string): string {
  if (!fileCache.headings) return content;
  const target = headingName.toLowerCase();

  // Step 1: find the heading
  let foundHeadingIndex = -1;
  for (let i = 0; i < fileCache.headings.length; i++) {
    if (fileCache.headings[i].heading.toLowerCase() === target) {
      foundHeadingIndex = i;
      break;
    }
  }
  if (foundHeadingIndex === -1) {
    return ""; // no heading matched
  }

  // Step 2: find the end offset for that heading's section
  const heading = fileCache.headings[foundHeadingIndex];
  const startOffset = heading.position.start.offset;
  const thisLevel = heading.level;

  // We'll search forward for the next heading of the same or shallower level
  let endOffset = content.length;
  for (let j = foundHeadingIndex + 1; j < fileCache.headings.length; j++) {
    const h = fileCache.headings[j];
    if (h.level <= thisLevel) {
      endOffset = h.position.start.offset;
      break;
    }
  }
  console.log(`"Sliceheading for ${heading}, level ${thisLevel}, offsets ${startOffset} and ${endOffset}."`)

  const slicedContent = content.substring(startOffset, endOffset).trim();
  return convertFrontmatterToQuote(slicedContent);
}

/**
 * Checks if a TFile is an image or PDF by extension
 */
function isIgnoredFile(file: TFile): boolean {
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "pdf"];
  return imageExtensions.includes(file.extension.toLowerCase());
}

/**
 * A helper for asynchronous regex replacements
 */
async function replaceAsync(
  str: string,
  regex: RegExp,
  asyncFn: (match: string, ...args: any[]) => Promise<string>
): Promise<string> {
  const matches: Array<{ match: string; args: any[]; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(str)) !== null) {
    matches.push({ match: m[0], args: m.slice(1), index: m.index });
  }

  let result = "";
  let lastIndex = str.length;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { match, args, index } = matches[i];
    const afterMatchIndex = index + match.length;
    const replacement = await asyncFn(match, ...args);
    result = str.substring(afterMatchIndex, lastIndex) + result;
    result = replacement + result;
    lastIndex = index;
  }
  result = str.substring(0, lastIndex) + result;
  return result;
}
