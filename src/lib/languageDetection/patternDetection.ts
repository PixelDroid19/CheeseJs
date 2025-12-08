/**
 * Pattern-Based Language Detection
 *
 * Synchronous language detection using regex patterns.
 * Provides immediate results for heuristic detection.
 */

import type { DetectionResult } from './types';
import {
    DEFINITIVE_PYTHON_PATTERNS,
    DEFINITIVE_JS_PATTERNS,
    DEFINITIVE_TS_PATTERNS,
    PYTHON_PATTERNS,
    TYPESCRIPT_PATTERNS,
    JAVASCRIPT_PATTERNS,
} from './patterns';

/**
 * Detect language using pattern matching
 * @param content - The code content to analyze
 * @returns Detection result with language and confidence
 */
export function patternBasedDetection(content: string): DetectionResult {
    // Empty content - default to TypeScript
    if (!content || content.trim().length === 0) {
        return { monacoId: 'typescript', confidence: 1.0, isExecutable: true };
    }

    const trimmed = content.trim();

    // =========================================================================
    // DEFINITIVE PATTERN MATCHING (highest priority)
    // These patterns are UNIQUE to their language - no ambiguity
    // Order matters: Python first, then TypeScript (superset of JS), then JS
    // =========================================================================

    // Check definitive Python patterns FIRST
    for (const pattern of DEFINITIVE_PYTHON_PATTERNS) {
        if (pattern.test(trimmed)) {
            console.log(`[Detection] Definitive Python pattern matched: ${pattern}`);
            return { monacoId: 'python', confidence: 0.95, isExecutable: true };
        }
    }

    // Check definitive TypeScript patterns (before JS, since TS is superset)
    for (const pattern of DEFINITIVE_TS_PATTERNS) {
        if (pattern.test(trimmed)) {
            console.log(
                `[Detection] Definitive TypeScript pattern matched: ${pattern}`
            );
            return { monacoId: 'typescript', confidence: 0.95, isExecutable: true };
        }
    }

    // Check definitive JS patterns
    for (const pattern of DEFINITIVE_JS_PATTERNS) {
        if (pattern.test(trimmed)) {
            console.log(`[Detection] Definitive JS pattern matched: ${pattern}`);
            return { monacoId: 'javascript', confidence: 0.95, isExecutable: true };
        }
    }

    // =========================================================================
    // SCORING-BASED DETECTION (for ambiguous code)
    // =========================================================================

    // Very short content without definitive patterns - default to TypeScript
    if (trimmed.length < 10) {
        return { monacoId: 'typescript', confidence: 1.0, isExecutable: true };
    }

    const scores = { python: 0, typescript: 0, javascript: 0 };

    for (const [pattern, weight] of PYTHON_PATTERNS) {
        if (pattern.test(content)) scores.python += weight;
    }
    for (const [pattern, weight] of TYPESCRIPT_PATTERNS) {
        if (pattern.test(content)) scores.typescript += weight;
    }
    for (const [pattern, weight] of JAVASCRIPT_PATTERNS) {
        if (pattern.test(content)) scores.javascript += weight;
    }

    // TypeScript inherits JavaScript patterns
    scores.typescript += scores.javascript * 0.5;

    let winner: 'python' | 'typescript' | 'javascript' = 'typescript';
    let maxScore = scores.typescript;

    if (scores.python > maxScore) {
        winner = 'python';
        maxScore = scores.python;
    }
    if (scores.javascript > maxScore && scores.typescript <= scores.javascript) {
        winner = 'javascript';
        maxScore = scores.javascript;
    }

    const totalScore = scores.python + scores.typescript + scores.javascript;
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

    return {
        monacoId: winner,
        confidence,
        isExecutable: true,
    };
}

/**
 * Check for definitive Python patterns
 */
export function matchesDefinitivePython(content: string): boolean {
    const trimmed = content?.trim() || '';
    return DEFINITIVE_PYTHON_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check for definitive TypeScript patterns
 */
export function matchesDefinitiveTypeScript(content: string): boolean {
    const trimmed = content?.trim() || '';
    return DEFINITIVE_TS_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check for definitive JavaScript patterns
 */
export function matchesDefinitiveJavaScript(content: string): boolean {
    const trimmed = content?.trim() || '';
    return DEFINITIVE_JS_PATTERNS.some((pattern) => pattern.test(trimmed));
}
