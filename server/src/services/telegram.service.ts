import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/ApiError';

const API_BASE = 'https://api.telegram.org/bot';

export type TelegramChatId = number | string;

export interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: unknown;
}

export interface AnswerCallbackOptions {
  text?: string;
  showAlert?: boolean;
}

export interface TelegramUserInfo {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export class TelegramService {
  private readonly token: string;

  constructor(token = env.telegramBotToken) {
    this.token = token;
  }

  get configured(): boolean {
    return Boolean(this.token);
  }

  private endpoint(method: string): string {
    return `${API_BASE}${this.token}/${method}`;
  }

  async call(
    method: string,
    body: Record<string, unknown> = {},
    maxRetries = 2
  ): Promise<any> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.endpoint(method), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = (data as any)?.description ?? `Telegram API error (${response.status})`;
          const err = new AppError(message, 502, 'TELEGRAM_API_ERROR');
          lastError = err;
          if (attempt < maxRetries) {
            await this.sleep(500 * (attempt + 1));
            continue;
          }
          throw err;
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown Telegram error');
        if (attempt < maxRetries) {
          await this.sleep(500 * (attempt + 1));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError;
  }

  async sendMessage(
    chatId: TelegramChatId,
    text: string,
    options: SendMessageOptions = {},
    maxRetries = 2
  ): Promise<any> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options.parseMode) body.parse_mode = options.parseMode;
    if (options.replyMarkup) body.reply_markup = options.replyMarkup;

    try {
      return await this.call('sendMessage', body, maxRetries);
    } catch (error) {
      logger.error('Failed to send Telegram message', error, { chatId });
      throw error;
    }
  }

  async editMessageText(
    chatId: TelegramChatId,
    messageId: number,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<any> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };
    if (options.parseMode) body.parse_mode = options.parseMode;
    if (options.replyMarkup) body.reply_markup = options.replyMarkup;
    return this.call('editMessageText', body);
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    options: AnswerCallbackOptions = {}
  ): Promise<any> {
    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };
    if (options.text) body.text = options.text;
    if (options.showAlert) body.show_alert = options.showAlert;
    return this.call('answerCallbackQuery', body);
  }

  async getChatMember(chatId: TelegramChatId, userId: number): Promise<any> {
    return this.call('getChatMember', { chat_id: chatId, user_id: userId });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const telegramService = new TelegramService();
