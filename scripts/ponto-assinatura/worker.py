"""Serviço privado para o backend. Expor somente atrás de HTTPS e autenticação.
Certificado/chave/senha permanecem no processo privado; nenhuma rota os retorna.
"""
import asyncio
import base64
import hmac
import io
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from assinador import assinar, validar
from comprovantes import Cofre


def renderizar(fields, config):
    if not isinstance(fields,list) or not 1<=len(fields)<=30:raise ValueError('CAMPOS_INVALIDOS')
    if any(not isinstance(row,list) or len(row)!=2 or any(not isinstance(v,str) or len(v)>1000 for v in row) for row in fields):raise ValueError('CAMPOS_INVALIDOS')
    output=io.BytesIO()
    style=ParagraphStyle('Corpo',fontName='Helvetica',fontSize=9,leading=13,textColor=colors.HexColor('#0d1b2e'))
    label=ParagraphStyle('Rotulo',parent=style,fontSize=8,leading=12)
    title=ParagraphStyle('Titulo',parent=style,fontSize=14,leading=19,spaceAfter=12)
    small=ParagraphStyle('Nota',parent=style,fontSize=8,leading=12)
    content=[]
    if config.get('logoArquivo'):
        content.append(Image(config['logoArquivo'],width=90,height=31,kind='proportional'))
    else:content.append(Paragraph('MARCELL',title))
    content.append(Spacer(1,12))
    content.append(Paragraph('Comprovante de Registro de Ponto do Trabalhador',title))
    rows=[]
    for name,value in fields:
        safe=escape(value)
        if len(value)==64 and all(c in '0123456789abcdef' for c in value.lower()):safe=safe[:32]+'<br/>'+safe[32:]
        rows.append([Paragraph(escape(name),label),Paragraph(safe,style)])
    table=Table(rows,colWidths=[175,340],hAlign='LEFT')
    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(0,-1),colors.HexColor('#edf3f7')),('LINEBELOW',(0,0),(-1,-1),0.3,colors.HexColor('#d9dde2')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    content.extend([table,Spacer(1,15),Paragraph('A assinatura digital está incorporada ao PDF. Verifique em https://validar.iti.gov.br.',small),Spacer(1,6),Paragraph('Este comprovante registra a marcação original. Não representa aprovação de horas extras ou saldo de banco de horas.',small)])
    SimpleDocTemplate(output,pagesize=A4,leftMargin=40,rightMargin=40,topMargin=36,bottomMargin=36,title='Comprovante de Registro de Ponto do Trabalhador',author='MARCELL').build(content)
    return output.getvalue()


def handler(config, token):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def responder(self,status,body):
            data=json.dumps(body).encode();self.send_response(status)
            self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def do_POST(self):
            if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):
                self.responder(403,{'error':'NAO_AUTORIZADO'});return
            if self.path not in ['/renderizar','/assinar','/recibos/salvar','/recibos/obter','/recibos/acesso','/recibos/revogar','/recibos/contato','/recibos/consultar','/recibos/situacao']:
                self.responder(404,{'error':'ROTA_INVALIDA'});return
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=28_000_000 or self.headers.get('Transfer-Encoding'):raise ValueError('REQUISICAO_INVALIDA')
                self.connection.settimeout(40)
                data=json.loads(self.rfile.read(length))
                if self.path.startswith('/recibos/'):
                    if not config.get('cofreArquivo'):raise ValueError('COFRE_NAO_CONFIGURADO')
                    company=data.get('companyId')
                    if not isinstance(company,str) or not 1<=len(company)<=100:raise ValueError('EMPRESA_INVALIDA')
                    cofre=Cofre(config['cofreArquivo'])
                    try:
                        if self.path=='/recibos/salvar':
                            raw=base64.b64decode(data['base64'],validate=True)
                            report=asyncio.run(validar(raw,'pdf',config))
                            if not all(report.get(k) is True for k in ['integridade','confiavel','icpBrasil','documentoInteiro','desenvolvedorConferido']) or report.get('revogacao')!='verificada':raise ValueError('ASSINATURA_INVALIDA')
                            result=cofre.salvar(company,data['base64'],data['manifesto'])
                        elif self.path=='/recibos/obter':result={'arquivo':cofre.obter(company,data.get('eventId'))}
                        elif self.path=='/recibos/acesso':result=cofre.acesso(company,data.get('employeeId'))
                        elif self.path=='/recibos/revogar':result=cofre.revogar(company,data.get('employeeId'))
                        elif self.path=='/recibos/contato':result=cofre.contato(company,data.get('employeeId'),data.get('telefone'),data.get('responsavel'))
                        elif self.path=='/recibos/situacao':result=cofre.pendencias(company)
                        else:result=cofre.consultar(company,data.get('prova'),data.get('eventId'),data.get('antes'))
                    finally:cofre.fechar()
                elif self.path=='/renderizar':
                    output=renderizar(data.get('fields'),config);result={'base64':base64.b64encode(output).decode()}
                else:
                    expected=config.get('desenvolvedor',{})
                    if data.get('desenvolvedor')!={k:expected.get(k) for k in ['tipo','numero']}:raise ValueError('DESENVOLVEDOR_DIVERGENTE')
                    if data.get('padrao') not in ['PAdES','CAdES detached']:raise ValueError('PADRAO_INVALIDO')
                    raw=base64.b64decode(data['base64'],validate=True)
                    if not 0<len(raw)<=20_000_000:raise ValueError('DOCUMENTO_INVALIDO')
                    output,report=asyncio.run(assinar(raw,'pdf' if data['padrao']=='PAdES' else 'cades',config))
                    result={'base64':base64.b64encode(output).decode(),'verificacao':report}
                self.responder(200,result)
            except Exception:self.responder(422,{'error':'OPERACAO_FISCAL_REPROVADA'})
    return Handler


def main():
    logging.disable(logging.CRITICAL)
    token=os.environ.get('PONTO_FISCAL_WORKER_TOKEN','')
    if len(token)<32:raise SystemExit('SEGREDO_WORKER_FISCAL_AUSENTE')
    config=json.loads(Path(os.environ['PONTO_ASSINATURA_CONFIG']).read_text(encoding='utf-8-sig'))
    # O worker HTTP não opera com CA sintética; isso é exclusivo do ensaio CLI.
    if config.get('modo','producao')!='producao':raise SystemExit('WORKER_EXIGE_CONFIGURACAO_PRODUCAO')
    address=('127.0.0.1',int(os.environ.get('PONTO_FISCAL_WORKER_PORT','3095')))
    print('Worker fiscal privado iniciado em loopback; configurar HTTPS no proxy antes de acesso remoto.',flush=True)
    HTTPServer(address,handler(config,token)).serve_forever()


if __name__=='__main__':main()
