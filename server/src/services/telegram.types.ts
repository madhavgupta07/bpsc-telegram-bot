export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
  poll?: Poll;
  poll_answer?: PollAnswer;
}

export interface Message {
  message_id: number;
  from?: TelegramUser;
  chat: Chat;
  date: number;
  text?: string;
  poll?: Poll;
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

export interface PollOption {
  text: string;
  voter_count: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: 'regular' | 'quiz';
  correct_option_id?: number;
}

export interface PollAnswer {
  poll_id: string;
  user: TelegramUser;
  option_ids: number[];
}
