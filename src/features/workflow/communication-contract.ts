export type CommunicationUser = {
  id: string;
  nome: string;
  role: string;
  active?: boolean;
};

type CommunicationData = Record<string, unknown> & {
  usuarios?: CommunicationUser[];
  obras?: { id: string; engineerId?: string; status?: string }[];
  rdos?: { obraId: string; data: string }[];
  conferencias?: {
    status?: string;
    pendencias?: { status: string; responsavelAjusteId?: string }[];
  }[];
};

export type CommunicationProps = {
  data: CommunicationData;
  currentUser: CommunicationUser | null;
  showToast: (message: string, tone?: "error") => void;
};

export type RankingAdjustment = {
  id: string;
  userId: string;
  pontos: number;
  motivo: string;
  criadoPor?: string;
  criadoEm?: string;
};

export type RankingListResult = { ok: boolean; ajustes?: RankingAdjustment[] };
export type RankingWriteResult = { ok: boolean; error?: string };
