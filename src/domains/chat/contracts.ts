export type ChatMention = { id: string; nome: string };

export type ChatParticipant = ChatMention & {
  active?: boolean;
  role?: string;
};

export type ChatAttachment = {
  url: string;
  name: string;
  type?: string;
  size?: number;
};

export type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  mentions?: ChatMention[] | null;
  attachment?: ChatAttachment | null;
  createdAt: string;
  deletedAt?: string | null;
};

export type ChatMute = { userId: string };

export type ChatListResult = {
  ok: boolean;
  mensagens?: ChatMessage[];
  mutados?: ChatMute[];
};

export type ChatWriteResult = { ok: boolean; error?: string };
export type ChatUploadResult = ChatWriteResult & { url?: string };

export type FloatingChatProps = {
  currentUser: ChatParticipant | null;
  usuarios: ChatParticipant[];
  showToast?: (message: string, tone?: "info" | "error") => void;
  bottomOffset?: number | string;
};
