import {chromium, expect} from '@playwright/test';
import {openFinanceModule,selectFinanceArea} from './finance-browser-navigation.mjs';
import {mkdir, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {applyInvoiceCommand} from '../src/domains/financeiro/invoice-commands.js';

function samplePdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for (let page = 0; page < 2; page++) {
    const text = `BT /F1 20 Tf 40 740 Td (NOTA FISCAL QA - PAGINA ${page + 1}) Tj 0 -40 Td (Fornecedor: Loja QA) Tj 0 -40 Td (Valor: R$ 1.000,00) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + page * 2} 0 R >>`, `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
  }
  let content = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(content);
}
const pdf = samplePdf();
const image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/><text x="30" y="70" font-size="26">NOTA FISCAL QA 123</text><text x="30" y="120" font-size="22">Loja QA - R$ 1.000,00</text></svg>')).png().toBuffer();
const user = {id:'conference-qa',nome:'Conferência QA',email:'conference@local.test',role:'admin',active:true};
const documents = [
  {id:'pdf',nome:'nota.pdf',legenda:'DANFE QA',tipo:'application/pdf',url:'https://tenant.sharepoint.com/nota.pdf'},
  {id:'image',nome:'scan.png',tipo:'image/png',url:'https://docs.local.test/scan.png'},
  {id:'xml',nome:'nota.xml',tipo:'application/xml',url:'https://docs.local.test/nota.xml'},
  {id:'word',nome:'documento.docx',url:'https://docs.local.test/documento.docx'},
  {id:'missing',nome:'ausente.png',tipo:'image/png',url:'https://docs.local.test/missing.png'},
  {id:'invalid',nome:'invalido.pdf',tipo:'application/pdf',url:'https://docs.local.test/invalid.pdf'},
  {id:'denied',nome:'protegido.pdf',tipo:'application/pdf',url:'https://tenant.sharepoint.com/protegido.pdf'},
];
const data = {usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'a',name:'Obra Alfa QA',status:'active',oneDriveDriveId:'drive-a'},{id:'b',name:'Obra Beta QA',status:'active',oneDriveDriveId:'drive-b'}],employees:[],attendance:{},notasFiscais:[{id:'nf',obraId:'a',tipo:'nfe',numero:'123',status:'recebida',emissao:'2026-10-30',vencimento:'2026-11-05',valorBruto:1000,valorLiquido:1000,fornecedorNome:'Loja QA',documentos:documents,pagamentos:[]},{id:'empty',obraId:'a',tipo:'nfe',numero:'SEM-ANEXO',status:'recebida',emissao:'2026-10-30',valorBruto:10,valorLiquido:10,documentos:[],pagamentos:[]}]};
const browser = await chromium.launch({headless:true});
const passed = [], errors = [];
await mkdir('artifacts/financeiro', {recursive:true});
try {
  for (const width of [1440,390]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    let protectedReads = 0, writes = 0, sessionData = structuredClone(data), savedCommand;
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
    await page.route('https://docs.local.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      const headers = {'access-control-allow-origin':'*'};
      if (path === '/scan.png') return route.fulfill({contentType:'image/png',body:image,headers});
      if (path === '/nota.xml') return route.fulfill({contentType:'application/xml',body:'<nfeProc><NFe><infNFe><ide><nNF>123</nNF></ide></infNFe></NFe></nfeProc>',headers});
      if (path === '/invalid.pdf') return route.fulfill({contentType:'text/html',body:'<html>Autenticacao necessaria</html>',headers});
      return route.fulfill({status:404,body:'Indisponivel',headers});
    });
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/microsoft/onedrive' && url.searchParams.get('action') === 'file') return route.fulfill({contentType:'application/pdf',body:pdf});
      let body = {}; try { body = route.request().postDataJSON() || {}; } catch {}
      if (body.action === 'file-link') {
        protectedReads++;
        expect(body.driveId).toBe('drive-a');
        if (body.itemId === 'denied') return route.fulfill({status:403,json:{ok:false,error:'Acesso indisponível.'}});
        expect(body.itemId).toBe('pdf');
        return route.fulfill({json:{ok:true,url:'/api/microsoft/onedrive?action=file&driveId=drive-a&itemId=pdf&sig=fixture'}});
      }
      if (body.action === 'operational-command') {
        writes++;
        savedCommand = body.command;
        const result = applyInvoiceCommand(sessionData, body.command, '2026-10-30T15:00:00Z');
        if (result?.ok) sessionData = result.data;
        return route.fulfill({json:{...result,updatedAt:'2026-10-30T15:00:01Z'}});
      }
      if (body.command || body.type || /command|save|update|approve/.test(body.action || '')) writes++;
      return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated',refreshToken:'isolated',usuario:user,data:structuredClone(data),updatedAt:'2026-10-30T15:00:00Z'}});
    });
    await page.goto(process.argv[2]||'http://127.0.0.1:4185');
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-senha').fill('isolated-test');
    await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
    await openFinanceModule(page);
    const nav = page.getByRole('navigation',{name:'Áreas do financeiro'});
    await selectFinanceArea(page,'Documentos');
    await page.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill('123');
    await page.getByRole('button',{name:'Abrir ficha fiscal',exact:true}).click();
    const dialog = page.getByRole('dialog',{name:'Conferir nota 123',exact:true});
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Fornecedor',{exact:true}).fill('Fornecedor conferido QA');
    await dialog.getByRole('combobox',{name:'Obra *',exact:true}).selectOption('b');
    if (width < 901) await dialog.getByRole('tab',{name:'Documento',exact:true}).click();
    await expect(dialog.getByRole('img',{name:'DANFE QA, página 1',exact:true})).toBeVisible();
    await expect(dialog.getByText('Carregando página do PDF…',{exact:true})).toHaveCount(0);
    expect(protectedReads).toBeGreaterThan(0);
    await dialog.getByRole('button',{name:'Próxima',exact:true}).click();
    await expect(dialog.getByRole('img',{name:'DANFE QA, página 2',exact:true})).toBeVisible();
    await dialog.getByLabel('Zoom do PDF',{exact:true}).selectOption('1.5');
    await expect(dialog.locator('canvas')).toHaveCSS('max-width','none');
    passed.push(`${width}: PDF protegido, página e zoom`);
    await dialog.getByLabel('Zoom do PDF',{exact:true}).selectOption('1');
    await dialog.getByRole('button',{name:'Anterior',exact:true}).click();
    if (width >= 901) {
      const original = await dialog.locator('.invoice-conference__original').boundingBox();
      const fields = await dialog.locator('.invoice-conference__fields').boundingBox();
      expect(original.x + original.width).toBeLessThan(fields.x);
    }
    await page.screenshot({path:`artifacts/financeiro/conferencia-original-${width}.png`});
    await dialog.getByLabel('Arquivo para conferência',{exact:true}).selectOption('1');
    await expect(dialog.getByRole('img',{name:'scan.png',exact:true})).toBeVisible();
    await expect.poll(()=>dialog.getByRole('img',{name:'scan.png',exact:true}).evaluate(element=>element.naturalWidth)).toBe(600);
    await dialog.getByLabel('Arquivo para conferência',{exact:true}).selectOption('2');
    await expect(dialog.getByLabel('XML original',{exact:true})).toContainText('<nNF>123</nNF>');
    await dialog.getByLabel('Arquivo para conferência',{exact:true}).selectOption('3');
    await expect(dialog.getByText(/Este formato não tem visualização interna/)).toBeVisible();
    await dialog.getByLabel('Arquivo para conferência',{exact:true}).selectOption('4');
    await expect(dialog.getByText(/Não foi possível visualizar este arquivo aqui/)).toBeVisible();
    await dialog.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(dialog.getByText(/Não foi possível visualizar este arquivo aqui/)).toBeVisible();
    await dialog.getByLabel('Arquivo para conferência',{exact:true}).selectOption('5');
    await expect(dialog.getByText(/Não foi possível visualizar este arquivo aqui/)).toBeVisible();
    await dialog.getByLabel('Arquivo para conferência',{exact:true}).selectOption('6');
    await expect(dialog.getByText(/Não foi possível visualizar este arquivo aqui/)).toBeVisible();
    await expect(dialog.getByRole('link',{name:'Abrir original em nova aba',exact:true})).toHaveAttribute('href','https://tenant.sharepoint.com/protegido.pdf');
    passed.push(`${width}: imagem, XML, formato externo, erro de imagem e PDF inválido`);
    if (width < 901) await dialog.getByRole('tab',{name:'Dados da nota',exact:true}).click();
    await expect(dialog.getByLabel('Fornecedor',{exact:true})).toHaveValue('Fornecedor conferido QA');
    await expect(dialog.getByRole('combobox',{name:'Obra *',exact:true})).toHaveValue('b');
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Voltar à conferência de documentos',exact:true}).click();
    await expect(page.getByLabel('Pesquisar documento ou fornecedor',{exact:true})).toHaveValue('123');
    passed.push(`${width}: campos mantidos ao trocar original/aba e retorno ao filtro`);
    await page.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill('SEM-ANEXO');
    await page.getByRole('button',{name:'Abrir ficha fiscal',exact:true}).click();
    if (width < 901) await page.getByRole('dialog').getByRole('tab',{name:'Documento',exact:true}).click();
    await expect(page.getByRole('dialog').getByText(/Nenhum documento anexado/)).toBeVisible();
    expect(writes).toBe(0);
    passed.push(`${width}: ausência de original orientada; nenhuma gravação automática`);
    if (width < 901) await page.getByRole('dialog').getByRole('tab',{name:'Dados da nota',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Fornecedor',{exact:true}).fill('Fornecedor salvo QA');
    await page.getByRole('button',{name:'Salvar e conferir',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toBe(1);
    expect(savedCommand.type).toBe('NOTA_FISCAL_SALVA');
    expect(sessionData.notasFiscais.find(invoice=>invoice.id==='empty')).toMatchObject({fornecedorNome:'Fornecedor salvo QA',version:1});
    passed.push(`${width}: edição salva pelo comando fiscal existente, somente após confirmação`);
    await page.close();
  }
  expect(errors).toEqual([]);
  await writeFile('artifacts/financeiro/conferencia-original-browser.json',JSON.stringify({passed,errors},null,2));
  console.log(JSON.stringify({passed,errors},null,2));
} finally { await browser.close(); }
