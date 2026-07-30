import {describe,expect,it,vi} from "vitest";
import {createAttendanceCommandQueue} from "./attendance-command-queue";

const deferred=()=>{
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  return {promise,resolve};
};

const upsert=(employeeId,date,operationId)=>({
  action:"attendance-upsert",
  operationId,
  employeeId,
  date,
  selectedObraId:"obra-1",
  record:{status:"P",obraId:"obra-1"},
});

describe("fila de comandos do ponto",()=>{
  it("envia o primeiro clique imediatamente",async()=>{
    const execute=vi.fn().mockResolvedValue({ok:true});
    const queue=createAttendanceCommandQueue({execute,createOperationId:()=>"batch-1"});

    await expect(queue.enqueue(upsert("e1","2026-07-30","op-1"))).resolves.toEqual({ok:true});
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].action).toBe("attendance-upsert");
  });

  it("agrupa em um lote as marcações feitas enquanto há um envio em andamento",async()=>{
    const first=deferred();
    const execute=vi.fn()
      .mockImplementationOnce(()=>first.promise)
      .mockResolvedValueOnce({ok:true,result:{attendance:[]}});
    const queue=createAttendanceCommandQueue({execute,createOperationId:()=>"batch-1"});

    const p1=queue.enqueue(upsert("e1","2026-07-30","op-1"));
    const p2=queue.enqueue(upsert("e2","2026-07-30","op-2"));
    const p3=queue.enqueue(upsert("e3","2026-07-30","op-3"));
    expect(execute).toHaveBeenCalledTimes(1);

    first.resolve({ok:true});
    await p1;
    await Promise.all([p2,p3]);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1][0]).toMatchObject({
      action:"attendance-batch-upsert",
      operationId:"batch-1",
      patches:[
        {employeeId:"e2",date:"2026-07-30"},
        {employeeId:"e3",date:"2026-07-30"},
      ],
    });
    expect(queue.hasPending()).toBe(false);
  });

  it("preserva a ordem ao encontrar um comando que não pode ser agrupado",async()=>{
    const first=deferred();
    const execute=vi.fn()
      .mockImplementationOnce(()=>first.promise)
      .mockResolvedValue({ok:true});
    const queue=createAttendanceCommandQueue({execute,createOperationId:()=>"batch-1"});

    const p1=queue.enqueue(upsert("e1","2026-07-30","op-1"));
    const p2=queue.enqueue({action:"attendance-daily-check",operationId:"op-2",date:"2026-07-30"});
    const p3=queue.enqueue(upsert("e2","2026-07-30","op-3"));
    first.resolve({ok:true});
    await Promise.all([p1,p2,p3]);

    expect(execute.mock.calls.map(call=>call[0].action)).toEqual([
      "attendance-upsert",
      "attendance-daily-check",
      "attendance-upsert",
    ]);
  });
});

