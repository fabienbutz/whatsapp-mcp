/**
 * Check if transcription is available
 */
export declare function isTranscriptionAvailable(): boolean;
/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioBase64 Base64 encoded audio data
 * @param mimeType MIME type of the audio (e.g., 'audio/ogg', 'audio/mpeg')
 * @returns Transcribed text or null on error
 */
export declare function transcribeAudio(audioBase64: string, mimeType: string): Promise<{
    text: string;
    language?: string;
} | null>;
/**
 * Check if media analysis (vision) is available
 */
export declare function isAnalysisAvailable(): boolean;
/**
 * Analyze media content using OpenAI GPT-4o Vision
 * Supports images (describe content) and documents (OCR + summarize)
 * @param base64Data Base64 encoded media data
 * @param mimeType MIME type of the media
 * @returns Analysis result with description text
 */
export declare function analyzeMedia(base64Data: string, mimeType: string): Promise<{
    description: string;
    type: 'image' | 'document';
} | null>;
