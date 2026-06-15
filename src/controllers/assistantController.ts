import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { updateUserProfileFields } from '../services/userProfileService';
import {
  AssistantChatMessage,
  AssistantServiceError,
  generateAssistantReply,
} from '../services/assistantService';

const isChatMessage = (value: unknown): value is AssistantChatMessage => {
  if (!value || typeof value !== 'object') return false;

  const message = value as Partial<AssistantChatMessage>;
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.text === 'string' &&
    message.text.trim().length > 0
  );
};

// @desc    Send a chat-only AI assistant message
// @route   POST /api/assistant/chat
export const chatWithAssistant = async (req: AuthRequest, res: Response) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!message) {
    return res.status(400).json({ message: 'Message is required.' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ message: 'Message is too long.' });
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history.filter(isChatMessage).slice(-12)
    : [];

  try {
    const reply = await generateAssistantReply(message, history);
    const monthlyUsage = req.user?.settings?.monthlyUsage || {};

    if (req.user) {
      try {
        await updateUserProfileFields(req.user.firebaseId, {
          settings: {
            ...(req.user.settings || {}),
            monthlyUsage: {
              ...monthlyUsage,
              aiAssistantQuestions: (monthlyUsage.aiAssistantQuestions || 0) + 1,
            },
          },
        });
      } catch (usageError) {
        console.error('Assistant usage update error:', {
          message: usageError instanceof Error ? usageError.message : 'Unknown usage update error',
        });
      }
    }

    return res.json({
      reply,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      console.error('Assistant chat error:', {
        status: error.status,
        message: error.message,
        providerMessage: error.providerMessage,
      });
    } else {
      console.error('Assistant chat error:', {
        message: error instanceof Error ? error.message : 'Unknown assistant error',
      });
    }

    return res.status(502).json({
      message: 'AI assistant is unavailable right now. Please try again shortly.',
    });
  }
};
