export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
}

export interface Message {
  message_id: number;
  from?: TelegramUser;
  chat: Chat;
  date: number;
  text?: string;
}

export interface Chat {
  id: number;
  type: string;
  first_name?: string;
  username?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: Message;
  data?: string;
}
