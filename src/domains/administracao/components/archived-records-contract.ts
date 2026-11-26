import type { OPERATIONAL_COMMAND } from "../../sync/operational-commands.js";

type Work = {
  id: string;
  name: string;
  status?: string;
  address?: string;
  engineer?: string;
  contractValue?: number;
};

type Employee = {
  id: string;
  name: string;
  role?: string;
  version?: number;
  active?: boolean;
  status?: string;
  endDate?: string;
  terminationReason?: string;
};

type ArchivedSnapshot = Record<string, unknown> & {
  obras?: Work[];
  employees?: Employee[];
};

type ReactivateEmployeeCommand = {
  type: typeof OPERATIONAL_COMMAND.EMPLOYEE_SAVED;
  idempotencyKey: string;
  expectedVersion: number;
  payload: {
    employee: Partial<Employee> & {
      active: true;
      status: "ativo";
      endDate: "";
      terminationReason: "";
    };
  };
};

export type ArchivedRecordsProps = {
  data: ArchivedSnapshot;
  update: (data: ArchivedSnapshot) => void;
  showToast?: (message: string, tone?: "error") => void;
  onTab?: (tabId: "obras" | "equipe") => void;
  dispatchCommand: (build: (current: ArchivedSnapshot) => ReactivateEmployeeCommand) =>
    Promise<{ ok: boolean; reason?: string } | null | undefined>;
};
