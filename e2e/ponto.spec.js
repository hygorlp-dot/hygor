import { expect, test } from "@playwright/test";

const PROFILE = {
  id: "qa-eng",
  nome: "Engenheiro QA",
  email: "qa@arcd.test",
  role: "engenheiro",
  obraId: "obra-qa",
  active: true,
  accessTabs: ["home", "ponto", "equipe"],
};

const initialState = () => ({
  usuarios: [PROFILE],
  obras: [{ id: "obra-qa", name: "TESTE QA — Obra Ponto", status: "active" }],
  employees: [{
    id: "emp-qa",
    name: "TESTE QA — Funcionário Ponto",
    role: "Pedreiro",
    obra: "obra-qa",
    active: true,
    startDate: "2000-01-01",
    dailyRate: 100,
    vtDaily: 10,
    vrDaily: 15,
  }],
  attendance: {},
  attendanceLocks: {},
  unlockRequests: [],
  dailyCheckDate: "",
  changeLog: [],
  config: { paymentHolidays: [] },
});

const installIsolatedBackend = async (page, stateOverride = {}, options = {}) => {
  let state = { ...initialState(), ...stateOverride };
  const saves = [];

  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON?.() || {};

    if (body.action === "profiles") {
      return route.fulfill({ json: { usuarios: [PROFILE], precisaSetup: false } });
    }
    if (body.action === "auth-login") {
      return route.fulfill({
        json: {
          accessToken: "qa-access-token",
          refreshToken: "qa-refresh-token",
          usuario: PROFILE,
          data: state,
          updatedAt: "2026-07-27T00:00:00.000Z",
        },
      });
    }
    if (body.action === "auth-refresh") {
      return route.fulfill({
        json: { accessToken: "qa-access-token", refreshToken: "qa-refresh-token" },
      });
    }
    if (body.action === "load") {
      return route.fulfill({
        json: {
          usuario: PROFILE,
          data: state,
          updatedAt: "2026-07-27T00:00:00.000Z",
        },
      });
    }
    if(String(body.action||"").startsWith("attendance-")){
      saves.push(structuredClone(body));
      let result={};
      if(body.action==="attendance-upsert"){
        const attendance={...(state.attendance||{})};
        const days={...(attendance[body.employeeId]||{})};
        if(body.record?.status)days[body.date]=structuredClone(body.record);
        else delete days[body.date];
        attendance[body.employeeId]=days;
        state={...state,attendance};
        if(body.confirmDailyCheck)state.dailyCheckDate=body.date;
        result={attendance:[{
          employeeId:body.employeeId,date:body.date,
          obraId:body.selectedObraId||body.record?.obraId||"",
          record:body.record?.status?structuredClone(body.record):null,
        }],dailyCheckDate:state.dailyCheckDate||""};
      }
      if(body.action==="attendance-batch-upsert"){
        const attendance={...(state.attendance||{})};
        const confirmed=[];
        for(const patch of body.patches||[]){
          const days={...(attendance[patch.employeeId]||{})};
          if(patch.record?.status)days[patch.date]=structuredClone(patch.record);
          else delete days[patch.date];
          attendance[patch.employeeId]=days;
          confirmed.push({
            employeeId:patch.employeeId,date:patch.date,
            obraId:patch.selectedObraId||patch.record?.obraId||"",
            record:patch.record?.status?structuredClone(patch.record):null,
          });
        }
        state={...state,attendance};
        if(body.confirmDailyCheck)state.dailyCheckDate=body.patches?.[0]?.date||state.dailyCheckDate;
        result={attendance:confirmed,dailyCheckDate:state.dailyCheckDate||""};
      }
      if(body.action==="attendance-daily-check"){
        state={...state,dailyCheckDate:body.date};
        result={dailyCheckDate:body.date};
      }
      if(body.action==="attendance-lock"){
        const id=`${body.date}__${body.obraId}`;
        const lock={id,obraId:body.obraId,date:body.date,locked:true};
        state={...state,attendanceLocks:{...(state.attendanceLocks||{}),[id]:lock}};
        result={lock};
      }
      if(options.saveDelayMs)await new Promise(resolve=>setTimeout(resolve,options.saveDelayMs));
      return route.fulfill({json:{ok:true,result,updatedAt:new Date().toISOString()}});
    }
    if (body.action === "save-sections") {
      saves.push(structuredClone(body.sections || {}));
      state = { ...state, ...(body.sections || {}) };
      if(options.saveDelayMs)await new Promise(resolve=>setTimeout(resolve,options.saveDelayMs));
      return route.fulfill({
        json: {
          ok: true,
          updatedAt: new Date().toISOString(),
          savedSections: Object.keys(body.sections || {}),
        },
      });
    }
    if(body.action === "save"){
      saves.push(structuredClone(body.payload||{}));
      state=structuredClone(body.payload||state);
      if(options.saveDelayMs)await new Promise(resolve=>setTimeout(resolve,options.saveDelayMs));
      return route.fulfill({json:{
        ok:true,updatedAt:new Date().toISOString(),data:state,
      }});
    }

    return route.fulfill({ json: { ok: true, usuario: PROFILE, data: state } });
  });
  await page.route("**/api/presence", route =>
    route.fulfill({ json: { ok: true, presencas: [] } }));

  return {
    getState: () => state,
    getSaves: () => saves,
  };
};

const login = async page => {
  await page.goto("/");
  await page.locator("#login-email").fill(PROFILE.email);
  await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button", { name: "Acessar central ARCD" }).click();
  await expect(page.getByText(/Bo[ma] (dia|tarde|noite), Engenheiro\./)).toBeVisible();
};

test("PIN incorreto informa o erro sem iniciar sessão", async ({ page }) => {
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON?.() || {};
    if (body.action === "profiles") {
      return route.fulfill({ json: { usuarios: [PROFILE], precisaSetup: false } });
    }
    if (body.action === "load") {
      return route.fulfill({ status: 401, json: { error: "PIN incorreto." } });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "PIN de acesso" }).click();
  await page.getByRole("button", { name: /Engenheiro QA/ }).click();
  for (const digit of ["1", "2", "3", "4"]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "Confirmar acesso" }).click();

  await expect(page.getByText("PIN incorreto.")).toBeVisible();
  await expect(page.getByText(/Bo[ma] (dia|tarde|noite), Engenheiro\./)).toHaveCount(0);
});

test("dataset legado com aprovação nula não derruba o app após o login", async ({ page }) => {
  await installIsolatedBackend(page, {
    instanciasAprovacao: [
      null,
      { id: "apr-valida", status: "aprovada", snapshotPolitica: null, resultadosEtapas: [] },
    ],
  });

  await login(page);

  await expect(page.getByText("Algo quebrou nesta tela")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir Ponto" })).toBeVisible();
});

test("não deixa atualizar a página enquanto o salvamento ainda está em trânsito", async ({ page }) => {
  const backend=await installIsolatedBackend(page,{}, {saveDelayMs:3000});
  await login(page);
  await page.getByRole("button", { name: "Abrir Ponto" }).click();

  await page.getByRole("button", { name: "Presente", exact:true }).click();
  await expect.poll(()=>backend.getSaves().length).toBeGreaterThan(0);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state","saving");
  await expect(page.getByTestId("save-status")).toHaveAttribute("title","Salvando alterações...");
  const protectedRefresh=await page.evaluate(()=>{
    const event=new Event("beforeunload",{cancelable:true});
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(protectedRefresh).toBe(true);
  await expect.poll(() =>
    backend.getState().attendance?.["emp-qa"]?.[new Date().toLocaleDateString("sv-SE")]?.status
  ).toBe("P");

  // Depois da confirmação da fila, atualizar não exibe bloqueio e o servidor
  // devolve exatamente o fato salvo.
  await page.waitForTimeout(3100);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state","idle");
  await expect(page.getByTestId("save-status")).toHaveAttribute("title",/Salvo às \d{2}:\d{2}/);
  await page.reload();
  await expect(page.getByText(/Bo[ma] (dia|tarde|noite), Engenheiro\./)).toBeVisible();
  await page.getByRole("button", { name: "Abrir Ponto" }).click();
  await expect(page.getByText("1/1 lançados")).toBeVisible();
});

test("engenheiro salva, recarrega e finaliza o ponto da própria obra no mobile", async ({ page }) => {
  const backend = await installIsolatedBackend(page);
  await login(page);

  await page.getByRole("button", { name: "Abrir Ponto" }).click();
  await expect(page.getByText("TESTE QA — Funcionário Ponto")).toBeVisible();
  await expect(page.getByRole("button", { name: "Transferir" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Demitir" })).toHaveCount(0);

  // O primeiro clique deve bastar: a conferência diária é registrada junto
  // com a presença, sem obrigar o engenheiro a executar uma etapa anterior.
  await expect(page.getByRole("button", { name: "Confirmar equipe sem alterações" })).toBeVisible();
  await page.getByRole("button", { name: "Presente", exact: true }).click();
  await expect(page.getByText("1/1 lançados")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar equipe sem alterações" })).toHaveCount(0);

  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("button", { name: "Jornada" }).click();
  await page.getByLabel("Entrada").fill("07:15");
  await page.getByLabel("Saída para intervalo").fill("12:00");
  await page.getByLabel("Retorno do intervalo").fill("13:00");
  await page.getByLabel("Saída", { exact:true }).fill("17:00");
  await expect(page.getByText(/Total: 8h45 · atraso de 15 min/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar jornada" }).click();
  await expect.poll(() =>
    backend.getState().attendance?.["emp-qa"]?.[new Date().toLocaleDateString("sv-SE")]?.workedMinutes
  ).toBe(525);
  await expect(page.getByText("8h45")).toBeVisible();
  await expect(page.getByText("15 min atraso")).toBeVisible();

  await page.getByRole("button", { name: "Hora extra" }).click();
  await page.getByLabel("Quantidade de horas").fill("2");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("2h extra")).toBeVisible();

  await expect.poll(() =>
    backend.getState().attendance?.["emp-qa"]?.[new Date().toLocaleDateString("sv-SE")]?.status
  ).toBe("P");
  expect(backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].obraId)
    .toBe("obra-qa");
  expect(backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].ot)
    .toBe(2);
  expect(backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")])
    .toMatchObject({workedMinutes:525,atrasoMin:15});

  await page.getByRole("button", { name: "Meio dia", exact: true }).click();
  await expect.poll(() =>
    backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].status
  ).toBe("M");
  expect(backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].ot)
    .toBe(2);

  await page.getByRole("button", { name: "Falta", exact: true }).click();
  await expect.poll(() =>
    backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].status
  ).toBe("F");
  expect(backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].ot)
    .toBe(0);
  expect(backend.getState().attendance["emp-qa"][new Date().toLocaleDateString("sv-SE")].workedMinutes)
    .toBe(0);
  await expect(page.getByText("2h extra")).toHaveCount(0);
  await expect(page.getByText("8h45")).toHaveCount(0);

  await page.getByRole("button", { name: "Presente", exact: true }).click();
  await page.getByRole("button", { name: "Jornada" }).click();
  await page.getByLabel("Entrada").fill("07:15");
  await page.getByLabel("Saída para intervalo").fill("12:00");
  await page.getByLabel("Retorno do intervalo").fill("13:00");
  await page.getByLabel("Saída", { exact:true }).fill("17:00");
  await page.getByRole("button", { name: "Salvar jornada" }).click();

  await page.reload();
  await expect(page.getByText(/Bo[ma] (dia|tarde|noite), Engenheiro\./)).toBeVisible();
  await page.getByRole("button", { name: "Abrir Ponto" }).click();
  await expect(page.getByText("1/1 lançados")).toBeVisible();
  await expect(page.getByText("8h45")).toBeVisible();
  await expect(page.getByText("15 min atraso")).toBeVisible();
  await expect(page.getByRole("button", { name: "Presente", exact: true }))
    .toHaveCSS("color", "rgb(255, 255, 255)");

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Finalizar ponto" }).click();
  await expect(page.getByText("Ponto finalizado e bloqueado")).toBeVisible();
  await expect.poll(() => Object.values(backend.getState().attendanceLocks || {}).length)
    .toBe(1);

  const lockSave = backend.getSaves().find(save => save.action==="attendance-lock");
  expect(lockSave).toBeTruthy();
  expect(lockSave.changeLog).toBeUndefined();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
});
