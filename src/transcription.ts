import OpenAI from 'openai';
import { log } from './whatsapp-client.js';

let openaiClient: OpenAI | null = null;
let initializationAttempted = false;

/**
 * Initialize OpenAI client.
 * API key can be provided via:
 * 1. OPENAI_API_KEY environment variable (set in MCP config or shell)
 * 2. .env file in project root (loaded via dotenv)
 */
function getOpenAIClient(): OpenAI | null {
  if (openaiClient) {
    return openaiClient;
  }

  if (initializationAttempted) {
    return null;
  }

  initializationAttempted = true;

  // Check for API key - supports both MCP env config and .env file
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    log('OpenAI API key not found. Transcription features disabled.');
    log('Set OPENAI_API_KEY in your MCP config or .env file.');
    return null;
  }

  try {
    openaiClient = new OpenAI({ apiKey });
    log('OpenAI client initialized successfully');
    return openaiClient;
  } catch (err: any) {
    log(`Failed to initialize OpenAI client: ${err?.message || err}`);
    return null;
  }
}

/**
 * Check if transcription is available
 */
export function isTranscriptionAvailable(): boolean {
  return getOpenAIClient() !== null;
}

/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioBase64 Base64 encoded audio data
 * @param mimeType MIME type of the audio (e.g., 'audio/ogg', 'audio/mpeg')
 * @returns Transcribed text or null on error
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string
): Promise<{ text: string; language?: string } | null> {
  const client = getOpenAIClient();

  if (!client) {
    throw new Error('Transcription not available. Set OPENAI_API_KEY in your MCP config or .env file.');
  }

  try {
    log(`Transcribing audio, mimetype: ${mimeType}, size: ${audioBase64.length} bytes`);

    // Determine file extension from mimetype
    const extensionMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/webm; codecs=opus': 'webm',
    };

    const extension = extensionMap[mimeType] || 'ogg';
    const filename = `audio.${extension}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(audioBase64, 'base64');

    // Create a File-like object for the API
    const file = new File([buffer], filename, { type: mimeType });

    const response = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });

    log(`Transcription successful: "${response.text.substring(0, 50)}..."`);

    return {
      text: response.text,
      language: (response as any).language || undefined,
    };
  } catch (err: any) {
    log(`Transcription failed: ${err?.message || err}`);

    if (err?.status === 401) {
      throw new Error('Invalid OpenAI API key. Check your OPENAI_API_KEY configuration.');
    }

    if (err?.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }

    throw new Error(`Transcription failed: ${err?.message || 'Unknown error'}`);
  }
}

/**
 * Check if media analysis (vision) is available
 */
export function isAnalysisAvailable(): boolean {
  return getOpenAIClient() !== null;
}

/**
 * Analyze media content using OpenAI GPT-4o Vision
 * Supports images (describe content) and documents (OCR + summarize)
 * @param base64Data Base64 encoded media data
 * @param mimeType MIME type of the media
 * @returns Analysis result with description text
 */
export async function analyzeMedia(
  base64Data: string,
  mimeType: string
): Promise<{ description: string; type: 'image' | 'document' } | null> {
  const client = getOpenAIClient();

  if (!client) {
    throw new Error('Analysis not available. Set OPENAI_API_KEY in your MCP config or .env file.');
  }

  const isImage = mimeType.startsWith('image/');
  const isDocument = mimeType === 'application/pdf' || mimeType.startsWith('text/');

  if (!isImage && !isDocument) {
    return null;
  }

  try {
    const mediaType = isImage ? 'image' : 'document';
    log(`Analyzing ${mediaType}, mimetype: ${mimeType}, size: ${base64Data.length} bytes`);

    const prompt = isImage
      ? 'Describe this image in detail. What do you see? If there is text in the image, also extract it.'
      : 'Extract and summarize the text content of this document. Provide both the raw text and a brief summary.';

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
    });

    const description = response.choices[0]?.message?.content || '';
    log(`Analysis successful: "${description.substring(0, 50)}..."`);

    return { description, type: mediaType };
  } catch (err: any) {
    log(`Analysis failed: ${err?.message || err}`);

    if (err?.status === 401) {
      throw new Error('Invalid OpenAI API key. Check your OPENAI_API_KEY configuration.');
    }
    if (err?.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }

    throw new Error(`Analysis failed: ${err?.message || 'Unknown error'}`);
  }
}
