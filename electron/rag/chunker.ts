/**
 * Smart Chunking Module
 *
 * Provides code-aware and semantic chunking for RAG ingestion.
 * Three strategies:
 * - CodeChunker: splits on function/class/method boundaries for code files
 * - ProseChunker: groups by headings/paragraphs for markdown/prose
 * - FallbackChunker: recursive character splitter (the original approach)
 *
 * Default chunk target: ~2000 chars (~500 tokens), 200 char overlap.
 */

/** Metadata about where a chunk came from within a document */
export interface ChunkMeta {
  startLine: number;
  endLine: number;
  /** 'code-block' | 'function' | 'class' | 'section' | 'paragraph' | 'fallback' */
  chunkType: string;
  /** For code: the symbol name (function/class name) if detected */
  symbolName?: string;
  /** For prose: the heading this chunk falls under */
  heading?: string;
}

export interface SmartChunk {
  content: string;
  meta: ChunkMeta;
}

// Default settings: ~500 tokens target, 200 char overlap
const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 200;

// Extensions that should use code-aware chunking
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.kt',
]);

// Extensions that should use prose-aware chunking
const PROSE_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst']);

/**
 * Dispatch to the appropriate chunker based on file extension.
 * If no extension is provided, falls back to auto-detection.
 */
export function smartChunk(
  text: string,
  extension?: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): SmartChunk[] {
  if (!text || text.trim().length === 0) return [];

  const ext = extension?.toLowerCase();

  if (ext && CODE_EXTENSIONS.has(ext)) {
    return chunkCode(text, chunkSize, overlap);
  }

  if (ext && PROSE_EXTENSIONS.has(ext)) {
    return chunkProse(text, chunkSize, overlap);
  }

  // For unknown extensions or no extension, use fallback
  return chunkFallback(text, chunkSize, overlap);
}

// ---------------------------------------------------------------------------
// Code Chunker
// ---------------------------------------------------------------------------

/**
 * Regex patterns that detect top-level code boundaries.
 * We look for lines that start a new logical block.
 */
const CODE_BOUNDARY_PATTERNS = [
  // JS/TS: export, function, class, interface, type, enum, const/let/var with assignment
  /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+/,
  /^(?:export\s+)?(?:default\s+)?function\s*\*?\s*\w/,
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*\w/,
  /^(?:export\s+)?interface\s+/,
  /^(?:export\s+)?type\s+\w+\s*[=<]/,
  /^(?:export\s+)?enum\s+/,
  /^(?:export\s+)?(?:const|let|var)\s+\w+\s*[=:]/,
  // Python: def, class
  /^(?:async\s+)?def\s+\w/,
  /^class\s+\w/,
  // Decorators (Python, TS)
  /^@\w/,
  // Go: func, type
  /^func\s+/,
  /^type\s+\w+\s+(?:struct|interface)/,
  // Rust: fn, struct, impl, enum, trait, pub
  /^(?:pub\s+)?(?:async\s+)?fn\s+/,
  /^(?:pub\s+)?struct\s+/,
  /^(?:pub\s+)?enum\s+/,
  /^(?:pub\s+)?trait\s+/,
  /^impl\s+/,
];

/**
 * Try to extract a symbol name from a boundary line.
 */
function extractSymbolName(line: string): string | undefined {
  // class Foo, interface Foo, enum Foo, struct Foo, trait Foo, impl Foo
  const classMatch = line.match(
    /(?:class|interface|enum|struct|trait|impl)\s+(\w+)/
  );
  if (classMatch) return classMatch[1];

  // function foo, def foo, fn foo, func foo
  const funcMatch = line.match(
    /(?:function\s*\*?\s*|def\s+|fn\s+|func\s+)(\w+)/
  );
  if (funcMatch) return funcMatch[1];

  // const foo =, let foo =, var foo =, type Foo =
  const varMatch = line.match(/(?:const|let|var|type)\s+(\w+)/);
  if (varMatch) return varMatch[1];

  return undefined;
}

/**
 * Check if a trimmed line matches any code boundary pattern.
 */
function isCodeBoundary(trimmedLine: string): boolean {
  return CODE_BOUNDARY_PATTERNS.some((pattern) => pattern.test(trimmedLine));
}

/**
 * Split code into chunks based on top-level declarations.
 * If a single declaration is too large, it falls back to character splitting.
 */
function chunkCode(
  text: string,
  chunkSize: number,
  overlap: number
): SmartChunk[] {
  const lines = text.split('\n');
  const segments: {
    startLine: number;
    endLine: number;
    symbolName?: string;
  }[] = [];

  let currentStart = 0;
  let currentSymbol: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.length === 0) continue;

    if (isCodeBoundary(trimmed) && i > currentStart) {
      // Close previous segment
      segments.push({
        startLine: currentStart,
        endLine: i - 1,
        symbolName: currentSymbol,
      });
      currentStart = i;
      currentSymbol = extractSymbolName(trimmed);
    } else if (i === 0) {
      // First line might be a boundary
      if (isCodeBoundary(trimmed)) {
        currentSymbol = extractSymbolName(trimmed);
      }
    }
  }

  // Push final segment
  if (currentStart < lines.length) {
    segments.push({
      startLine: currentStart,
      endLine: lines.length - 1,
      symbolName: currentSymbol,
    });
  }

  // Now merge small segments or split large ones
  return mergeAndSplitSegments(lines, segments, chunkSize, overlap, 'code');
}

// ---------------------------------------------------------------------------
// Prose Chunker
// ---------------------------------------------------------------------------

/** Markdown heading pattern (# through ######) */
const MD_HEADING_PATTERN = /^(#{1,6})\s+(.+)/;

/**
 * Split prose/markdown into chunks based on headings and paragraph groups.
 */
function chunkProse(
  text: string,
  chunkSize: number,
  overlap: number
): SmartChunk[] {
  const lines = text.split('\n');
  const segments: {
    startLine: number;
    endLine: number;
    heading?: string;
  }[] = [];

  let currentStart = 0;
  let currentHeading: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(MD_HEADING_PATTERN);
    if (headingMatch && i > currentStart) {
      // Close previous segment
      segments.push({
        startLine: currentStart,
        endLine: i - 1,
        heading: currentHeading,
      });
      currentStart = i;
      currentHeading = headingMatch[2].trim();
    } else if (headingMatch && i === 0) {
      currentHeading = headingMatch[2].trim();
    }

    // Also split on double blank lines (major section breaks) within non-heading content
    if (
      i > currentStart + 1 &&
      lines[i].trim() === '' &&
      i + 1 < lines.length &&
      lines[i + 1].trim() === ''
    ) {
      const segmentText = lines.slice(currentStart, i).join('\n');
      if (segmentText.trim().length > chunkSize) {
        // Segment is large, let merge/split handle it
        segments.push({
          startLine: currentStart,
          endLine: i - 1,
          heading: currentHeading,
        });
        currentStart = i + 1;
        // Don't reset heading - it carries over
      }
    }
  }

  // Push final segment
  if (currentStart < lines.length) {
    segments.push({
      startLine: currentStart,
      endLine: lines.length - 1,
      heading: currentHeading,
    });
  }

  return mergeAndSplitSegments(lines, segments, chunkSize, overlap, 'prose');
}

// ---------------------------------------------------------------------------
// Fallback Chunker (improved version of the original)
// ---------------------------------------------------------------------------

/**
 * Recursive character text splitter with line tracking.
 * This is the original algorithm enhanced with line number metadata.
 */
function chunkFallback(
  text: string,
  chunkSize: number,
  overlap: number
): SmartChunk[] {
  const lines = text.split('\n');
  const chunks: SmartChunk[] = [];

  let currentChunkLines: string[] = [];
  let currentChunkStartLine = 0;
  let currentLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline

    if (
      currentLength + lineLength > chunkSize &&
      currentChunkLines.length > 0
    ) {
      // Emit current chunk
      chunks.push({
        content: currentChunkLines.join('\n').trim(),
        meta: {
          startLine: currentChunkStartLine,
          endLine: currentChunkStartLine + currentChunkLines.length - 1,
          chunkType: 'fallback',
        },
      });

      // Calculate overlap: keep trailing lines that fit within overlap chars
      const overlapLines: string[] = [];
      let overlapLen = 0;
      for (let j = currentChunkLines.length - 1; j >= 0; j--) {
        const len = currentChunkLines[j].length + 1;
        if (overlapLen + len > overlap) break;
        overlapLines.unshift(currentChunkLines[j]);
        overlapLen += len;
      }

      const overlapLineCount = overlapLines.length;
      currentChunkStartLine =
        currentChunkStartLine + currentChunkLines.length - overlapLineCount;
      currentChunkLines = [...overlapLines];
      currentLength = overlapLen;
    }

    currentChunkLines.push(lines[i]);
    currentLength += lineLength;
  }

  // Emit remaining
  if (currentChunkLines.length > 0) {
    const content = currentChunkLines.join('\n').trim();
    if (content.length > 0) {
      chunks.push({
        content,
        meta: {
          startLine: currentChunkStartLine,
          endLine: currentChunkStartLine + currentChunkLines.length - 1,
          chunkType: 'fallback',
        },
      });
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Segment merging / splitting utilities
// ---------------------------------------------------------------------------

interface Segment {
  startLine: number;
  endLine: number;
  symbolName?: string;
  heading?: string;
}

/**
 * Take raw segments (from code or prose boundary detection) and:
 * - Merge adjacent small segments until they approach chunkSize
 * - Split segments that exceed chunkSize using the fallback splitter
 * This ensures all output chunks are within a reasonable size range.
 */
function mergeAndSplitSegments(
  lines: string[],
  segments: Segment[],
  chunkSize: number,
  overlap: number,
  mode: 'code' | 'prose'
): SmartChunk[] {
  if (segments.length === 0) return [];

  const result: SmartChunk[] = [];

  // First pass: merge small adjacent segments
  const merged: Segment[] = [];
  let accum: Segment | null = null;

  for (const seg of segments) {
    const segText = lines.slice(seg.startLine, seg.endLine + 1).join('\n');
    const segLen = segText.length;

    if (!accum) {
      accum = { ...seg };
      continue;
    }

    const accumText = lines
      .slice(accum.startLine, accum.endLine + 1)
      .join('\n');
    const accumLen = accumText.length;

    // Merge if combined size fits within chunkSize
    if (accumLen + segLen + 1 <= chunkSize) {
      accum.endLine = seg.endLine;
      // Keep the first symbol/heading as the label
      if (!accum.symbolName && seg.symbolName) {
        accum.symbolName = seg.symbolName;
      }
      if (!accum.heading && seg.heading) {
        accum.heading = seg.heading;
      }
    } else {
      merged.push(accum);
      accum = { ...seg };
    }
  }
  if (accum) merged.push(accum);

  // Second pass: split oversized segments, emit normal ones
  for (const seg of merged) {
    const segText = lines.slice(seg.startLine, seg.endLine + 1).join('\n');

    if (segText.length <= chunkSize * 1.2) {
      // Within acceptable range (allow 20% overshoot for natural boundaries)
      const trimmed = segText.trim();
      if (trimmed.length > 0) {
        result.push({
          content: trimmed,
          meta: {
            startLine: seg.startLine + 1, // 1-based
            endLine: seg.endLine + 1, // 1-based
            chunkType:
              mode === 'code'
                ? seg.symbolName
                  ? 'function'
                  : 'code-block'
                : seg.heading
                  ? 'section'
                  : 'paragraph',
            symbolName: seg.symbolName,
            heading: seg.heading,
          },
        });
      }
    } else {
      // Too large - sub-split with fallback, adjusting line offsets
      const subText = lines.slice(seg.startLine, seg.endLine + 1).join('\n');
      const subChunks = chunkFallback(subText, chunkSize, overlap);
      for (const sc of subChunks) {
        result.push({
          content: sc.content,
          meta: {
            startLine: seg.startLine + sc.meta.startLine + 1, // adjust to absolute 1-based
            endLine: seg.startLine + sc.meta.endLine + 1,
            chunkType: sc.meta.chunkType,
            symbolName: seg.symbolName,
            heading: seg.heading,
          },
        });
      }
    }
  }

  return result;
}
