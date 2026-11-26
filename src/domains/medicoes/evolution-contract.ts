import type { OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import type { thirdPartyMeasurementsForProject } from "../terceirizados/obra-measurements.js";

export type MeasurementTask = {
  id: string;
  nome: string;
  titulo?: boolean;
  origemProgresso?: string;
  diasTrabalhados: number;
  custo: number;
  progresso: number;
};

export type ProgressSource = {
  contratoId: string;
  contrato: string;
  etapaId: string;
  etapa: string;
  pct: number;
  pctEnviado: number;
};

type TechnicalMeasurementItem = {
  tarefaId: string;
  nome: string;
  pctDiario: number;
  pctConfirmado: number;
  custo: number;
  pctTerceiros?: number;
  fontesTerceiros?: Pick<ProgressSource, "contratoId" | "etapaId" | "pct">[];
};

export type TechnicalMeasurement = {
  id: string;
  obraId: string;
  data: string;
  dataMedicao?: string;
  numero: number;
  responsavel?: string;
  observacao?: string;
  itens: TechnicalMeasurementItem[];
  avancoFisico: number;
  version?: number;
  status?: string;
};

export type LinkedContractStage = {
  id: string;
  nome: string;
  tarefaId: string;
  valor: number;
  pctAprovado: number;
  pctEnviado: number;
};

export type ContractOverview = Omit<ReturnType<typeof thirdPartyMeasurementsForProject>[number], "etapas"> & {
  etapas: LinkedContractStage[];
};

type ContractStage = {
  id: string;
  tarefaId?: string;
};

export type MeasurementData = Record<string, unknown> & {
  obras?: { id: string; name: string; status?: string }[];
  planos?: { obraId: string; tarefas?: object[] }[];
  rdos?: object[];
  terceirizados?: { id: string; version?: number; etapas?: ContractStage[] }[];
  medicoesTerc?: object[];
  medicoesObra?: TechnicalMeasurement[];
  medicoes?: { medicaoTecnicaId?: string; status: string; valorPrevisto?: number }[];
};

type MeasurementCommand = {
  idempotencyKey: string;
  actorId: string;
  actorName: string;
} & (
  | {
      type: typeof OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED;
      expectedVersion: number;
      payload: { measurement: TechnicalMeasurement };
    }
  | {
      type: typeof OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED;
      expectedVersion: number;
      payload: { measurementId: string; reason: string };
    }
  | {
      type: typeof OPERATIONAL_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED;
      expectedVersion: number;
      payload: { contractId: string; stages: ContractStage[] };
    }
  | {
      type: typeof OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_BILLED;
      payload: { id: string; medicaoTecnicaId?: string; competencia: string; dataVencimento: string };
    }
);

type MeasurementActions = {
  data: MeasurementData;
  currentUser?: { id?: string; nome?: string; role?: string } | null;
  dispatchCommand?: ((command: MeasurementCommand | ((data: MeasurementData) => MeasurementCommand)) =>
    Promise<{ ok: boolean; reason?: string; data?: MeasurementData } | null | undefined>) | null;
  showToast?: (message: string, tone?: "warn" | "error") => void;
  onAbrirTerceiro?: ((contratoId: string, novaMedicao: boolean) => void) | null;
};

export type MeasurementEvolutionProps = MeasurementActions & {
  update: (data: MeasurementData) => void;
  obraIdFixo?: string;
  onAbrirPlanejamento?: ((obraId: string) => void) | null;
};

export type ThirdPartyMeasurementProps = Pick<MeasurementEvolutionProps,
  "data" | "currentUser" | "dispatchCommand" | "showToast" | "onAbrirTerceiro"
> & {
  obraId: string;
  tarefas: Pick<MeasurementTask, "id" | "nome">[];
};
