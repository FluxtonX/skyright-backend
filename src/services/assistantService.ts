import axios from 'axios';

type ChatRole = 'user' | 'assistant';

export interface AssistantChatMessage {
  role: ChatRole;
  text: string;
}

export class AssistantServiceError extends Error {
  status?: number;
  providerMessage?: string;

  constructor(message: string, status?: number, providerMessage?: string) {
    super(message);
    this.name = 'AssistantServiceError';
    this.status = status;
    this.providerMessage = providerMessage;
  }
}

const systemPrompt = [
  'You are FlyRedi AI Assistant, a concise travel and passenger-rights chat assistant.',
  'Help users with flight disruptions, delays, cancellations, baggage, refunds, compensation, claims, and trip support.',
  'Keep answers practical, accurate, and easy to act on.',
  'Do not claim to submit claims, book travel, open files, or perform account actions from this chat.',
  'If a situation depends on route, airline, date, jurisdiction, or documents, ask for the missing details.',
  'Avoid markdown tables. Use short paragraphs or simple numbered steps.',
].join(' ');

export const generateAssistantReply = async (
  message: string,
  history: AssistantChatMessage[] = [],
) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = [
    ...history.slice(-12).map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  try {
    const response = await axios.post(
      endpoint,
      {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 700,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        timeout: 20000,
      },
    );

    const text = response.data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      throw new AssistantServiceError('Gemini returned an empty response.');
    }

    return text;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const providerMessage = error.response?.data?.error?.message;
      throw new AssistantServiceError(
        'Gemini request failed.',
        error.response?.status,
        typeof providerMessage === 'string' ? providerMessage : undefined,
      );
    }

    throw error;
  }
};
