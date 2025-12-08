/**
 * Language Detection Types
 *
 * Shared types for the language detection system.
 */

export interface DetectionResult {
    monacoId: string;
    confidence: number;
    isExecutable: boolean;
}
