"""Consumidor privado e reiniciável. Nunca alterar ARP, folha ou pagamentos.

Executar separadamente do worker HTTP para não bloquear a própria assinatura.
Sem configuração explícita não conecta nem envia mensagens.
"""
import argparse
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from comprovantes import Cofre


class SemRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise ValueError('REDIRECT_RECUSADO')


def endereco(url, local=False):
    p=urlsplit(url)
    if p.username or p.password or p.query or p.fragment or not p.hostname:raise ValueError('ENDERECO_INVALIDO')
    if p.scheme!='https' and not(local and p.scheme=='http' and p.hostname in ['127.0.0.1','localhost','::1']):raise ValueError('HTTPS_OBRIGATORIO')
    return url.rstrip('/')


def requisitar(url,payload,headers):
    request=Request(url,data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json',**headers})
    with build_opener(SemRedirect).open(request,timeout=45) as response:
        data=response.read(30_000_001)
        if len(data)>30_000_000:raise ValueError('RESPOSTA_EXCESSIVA')
        return json.loads(data)


class Processador:
    def __init__(self, config, cofre, api, waha=None):
        self.config,self.cofre,self.api,self.waha=config,cofre,api,waha

    def rodada(self):
        company=self.config['companyId']
        for estab in self.config['estabelecimentos']:
            cursor=self.cofre.cursor(company,estab)
            lote=self.api({'operacao':'listar','estabelecimentoId':estab,'aposNsr':cursor})
            if 'error' in lote:continue
            self.cofre.tarefas(company,estab,lote['eventos'])
            self.cofre.cursor(company,estab,lote['proximoNsr'])
            rows=self.cofre.db.execute("SELECT evento FROM tarefas WHERE company=? AND estabelecimento=? AND estado!='emitido' AND tentativa<? ORDER BY tentativa,nsr LIMIT 3",
                (company,estab,self.cofre.agora()-300)).fetchall()
            for (event,) in rows:
                try:
                    cached=self.cofre.obter(company,event)
                    result={'arquivo':cached} if cached else self.api({'operacao':'emitir','estabelecimentoId':estab,'eventId':event})
                    if result.get('error') or not result.get('arquivo'):
                        self.cofre.estado_tarefa(company,estab,event,'bloqueado');continue
                    # A API já armazenou e o worker validou criptograficamente.
                    existing=self.cofre.obter(company,event)
                    if not existing or existing['manifesto']!=result['arquivo']['manifesto']:raise ValueError('RECIBO_NAO_PERSISTIDO')
                    self.cofre.estado_tarefa(company,estab,event,'emitido')
                except Exception:self.cofre.estado_tarefa(company,estab,event,'indisponivel')
        if self.waha:
            rows=self.cofre.db.execute("SELECT r.evento,c.telefone FROM recibos r JOIN contatos c ON c.company=r.company AND c.funcionario=r.funcionario WHERE r.company=? AND r.envio='pendente' ORDER BY r.criado LIMIT 10",(company,)).fetchall()
            for event,telefone in rows:
                try:
                    # Resolver destinatário e sessão antes de reservar o envio.
                    query=urlencode({'session':self.config['wahaSessao'],'phone':telefone})
                    contact=self.waha('/api/contacts/check-exists?'+query,None)
                    chat=contact.get('chatId','')
                    if contact.get('numberExists') is not True or not re.fullmatch(r'[0-9]+@(lid|c\.us|s\.whatsapp\.net)',chat):continue
                    chat=chat.replace('@s.whatsapp.net','@c.us')
                    file=self.cofre.obter(company,event)
                    if not self.cofre.reservar_envio(company,event,telefone):continue
                    sent=self.waha('/api/sendFile',{'session':self.config['wahaSessao'],'chatId':chat,
                        'file':{'mimetype':'application/pdf','filename':file['nome'],'data':file['base64']},
                        'caption':'MARCELL · Comprovante da sua marcação de ponto. A assinatura digital está incorporada ao PDF.'})
                    if sent.get('id'):self.cofre.confirmar_envio(company,event,str(sent['id']))
                except Exception:pass  # Resultado incerto fica retido, sem reenvio cego.
        return self.cofre.pendencias(company)


def main():
    parser=argparse.ArgumentParser(description='Emissão e entrega privada de comprovantes')
    parser.add_argument('--uma-vez',action='store_true');args=parser.parse_args()
    config=json.loads(Path(os.environ['PONTO_ASSINATURA_CONFIG']).read_text(encoding='utf-8-sig'))
    automatic=config['automacao']
    token=os.environ.get('PONTO_FISCAL_AUTOMACAO_TOKEN','')
    if len(token)<32:raise SystemExit('SEGREDO_AUTOMACAO_AUSENTE')
    url=endereco(automatic['apiUrl'],local=os.environ.get('PONTO_FISCAL_AUTOMACAO_LOCAL')=='1')
    def api(body):return requisitar(url,{'action':'ponto-fiscal-automacao',**body},{'Authorization':'Bearer '+token})
    waha=None
    if os.environ.get('PONTO_WHATSAPP_HABILITADO')=='1':
        base=endereco(automatic['wahaUrl'],local=True)
        key=os.environ.get('PONTO_WHATSAPP_API_KEY','')
        if not key:raise SystemExit('SEGREDO_WHATSAPP_AUSENTE')
        def waha(path,payload):return requisitar(base+path,payload,{'X-Api-Key':key})
    cofre=Cofre(config['cofreArquivo'])
    try:
        processor=Processador(automatic,cofre,api,waha)
        while True:
            try:print(json.dumps(processor.rodada()),flush=True)
            except Exception:print('{"situacao":"processamento_indisponivel"}',flush=True)
            if args.uma_vez:break
            time.sleep(15)
    finally:cofre.fechar()


if __name__=='__main__':main()
