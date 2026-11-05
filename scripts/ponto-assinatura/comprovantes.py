"""Cofre privado de comprovantes. Não grava nem corrige batidas ou pagamentos.

SQLite e PDFs ficam fora do repositório, em volume privado persistente. O token
individual só permite consultar o próprio acervo. Nunca usar CPF como senha.
"""
import base64
import hashlib
import json
import math
import re
import secrets
import sqlite3
import time
from pathlib import Path


def exigir(ok):
    if not ok: raise ValueError('COMPROVANTE_OU_ACESSO_INVALIDO')


class Cofre:
    def __init__(self, arquivo, agora=time.time):
        self.agora = agora
        path = Path(arquivo)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(path)
        path.chmod(0o600)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS recibos (
            company TEXT NOT NULL, evento TEXT NOT NULL, funcionario TEXT NOT NULL,
            manifesto TEXT NOT NULL, pdf BLOB NOT NULL, criado REAL NOT NULL,
            envio TEXT NOT NULL DEFAULT 'pendente', mensagem TEXT,
            PRIMARY KEY(company,evento));
          CREATE TABLE IF NOT EXISTS acessos (
            hash TEXT PRIMARY KEY, company TEXT NOT NULL, funcionario TEXT NOT NULL,
            expira REAL NOT NULL, revogado INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS contatos (
            company TEXT NOT NULL, funcionario TEXT NOT NULL, telefone TEXT NOT NULL,
            responsavel TEXT NOT NULL, conferido REAL NOT NULL,
            PRIMARY KEY(company,funcionario));
          CREATE TABLE IF NOT EXISTS tarefas (
            company TEXT NOT NULL, estabelecimento TEXT NOT NULL, evento TEXT NOT NULL,
            nsr INTEGER NOT NULL, estado TEXT NOT NULL, tentativa REAL NOT NULL,
            PRIMARY KEY(company,estabelecimento,evento));
          CREATE TABLE IF NOT EXISTS cursores (
            company TEXT NOT NULL, estabelecimento TEXT NOT NULL, nsr INTEGER NOT NULL,
            PRIMARY KEY(company,estabelecimento));
        ''')

    def fechar(self): self.db.close()

    def salvar(self, company, base64pdf, manifesto):
        exigir(isinstance(manifesto,dict) and manifesto.get('companyId') == company)
        exigir(manifesto.get('status') == 'assinado_validado' and manifesto.get('padrao') == 'PAdES')
        exigir(type(manifesto.get('nsr')) is int and 1<=manifesto['nsr']<=999999999)
        exigir(isinstance(manifesto.get('marcadoEm'),str) and len(manifesto['marcadoEm'])<=40)
        evento, funcionario = manifesto.get('eventId'), manifesto.get('employeeId')
        exigir(isinstance(evento,str) and 1 <= len(evento) <= 100 and isinstance(funcionario,str) and 1 <= len(funcionario) <= 100)
        raw = base64.b64decode(base64pdf, validate=True)
        exigir(0 < len(raw) <= 20_000_000 and raw.startswith(b'%PDF-'))
        exigir(hashlib.sha256(raw).hexdigest() == manifesto.get('sha256'))
        existing = self.db.execute('SELECT manifesto,pdf FROM recibos WHERE company=? AND evento=?',(company,evento)).fetchone()
        if existing:
            exigir(existing[1] == raw and json.loads(existing[0]).get('employeeId') == funcionario)
            return {'salvo':True,'existente':True}
        with self.db:
            self.db.execute('INSERT INTO recibos(company,evento,funcionario,manifesto,pdf,criado) VALUES(?,?,?,?,?,?)',
                (company,evento,funcionario,json.dumps(manifesto),raw,self.agora()))
        return {'salvo':True,'existente':False}

    def obter(self, company, evento):
        row = self.db.execute('SELECT manifesto,pdf FROM recibos WHERE company=? AND evento=?',(company,evento)).fetchone()
        if not row:return None
        manifesto = json.loads(row[0])
        exigir(hashlib.sha256(row[1]).hexdigest() == manifesto['sha256'])
        return {'nome':'comprovante-'+str(manifesto['nsr'])+'.pdf','mime':'application/pdf',
            'base64':base64.b64encode(row[1]).decode(),'manifesto':manifesto}

    def acesso(self, company, funcionario):
        exigir(isinstance(funcionario,str) and 1 <= len(funcionario) <= 100)
        token = secrets.token_urlsafe(32)
        expira = self.agora()+90*86400
        with self.db:
            self.db.execute('UPDATE acessos SET revogado=1 WHERE company=? AND funcionario=?',(company,funcionario))
            self.db.execute('INSERT INTO acessos VALUES(?,?,?,?,0)',(hashlib.sha256(token.encode()).hexdigest(),company,funcionario,expira))
        return {'token':token,'expiraEm':expira}

    def revogar(self, company, funcionario):
        with self.db:self.db.execute('UPDATE acessos SET revogado=1 WHERE company=? AND funcionario=?',(company,funcionario))
        return {'revogado':True}

    def titular(self, company, token):
        exigir(isinstance(token,str) and re.fullmatch(r'[A-Za-z0-9_-]{43}',token))
        row = self.db.execute('SELECT funcionario FROM acessos WHERE hash=? AND company=? AND revogado=0 AND expira>?',
            (hashlib.sha256(token.encode()).hexdigest(),company,self.agora())).fetchone()
        exigir(row is not None)
        return row[0]

    def consultar(self, company, token, evento=None, antes=None):
        funcionario = self.titular(company,token)
        if evento:
            row = self.db.execute('SELECT 1 FROM recibos WHERE company=? AND funcionario=? AND evento=?',(company,funcionario,evento)).fetchone()
            exigir(row is not None)
            return {'arquivo':self.obter(company,evento)}
        # Inclui marcações antigas recebidas tardiamente. Não apaga o acervo.
        filtro,params='',(company,funcionario)
        if antes is not None:
            exigir(isinstance(antes,dict) and isinstance(antes.get('criado'),(int,float)) and math.isfinite(antes['criado'])
                and isinstance(antes.get('eventId'),str) and len(antes['eventId'])<=100)
            filtro=' AND (criado<? OR (criado=? AND evento>?))'
            params+=(antes['criado'],antes['criado'],antes['eventId'])
        rows = self.db.execute('SELECT evento,manifesto,criado FROM recibos WHERE company=? AND funcionario=?'+filtro+' ORDER BY criado DESC,evento LIMIT 201',params).fetchall()
        visible=rows[:200]
        return {'comprovantes':[{'eventId':e,'nsr':json.loads(m)['nsr'],'marcadoEm':json.loads(m)['marcadoEm'],
            'timezone':json.loads(m).get('timezone','UTC'),'disponivelEm':t} for e,m,t in visible],
            'proximo':{'criado':visible[-1][2],'eventId':visible[-1][0]} if len(rows)>200 else None}

    def contato(self, company, funcionario, telefone, responsavel):
        exigir(isinstance(telefone,str) and re.fullmatch(r'55[1-9][0-9]{9,10}',telefone))
        exigir(isinstance(responsavel,str) and 1 <= len(responsavel) <= 100)
        with self.db:self.db.execute('INSERT OR REPLACE INTO contatos VALUES(?,?,?,?,?)',
            (company,funcionario,telefone,responsavel,self.agora()))
        return {'confirmado':True}

    def reservar_envio(self, company, evento, telefone):
        # Commit ANTES do POST. Queda após envio não provoca reenvio automático.
        with self.db:
            row = self.db.execute('SELECT r.funcionario,c.telefone FROM recibos r JOIN contatos c ON c.company=r.company AND c.funcionario=r.funcionario WHERE r.company=? AND r.evento=? AND r.envio=?',
                (company,evento,'pendente')).fetchone()
            if row and row[1] != telefone:return None
            if not row:return None
            changed = self.db.execute("UPDATE recibos SET envio='incerto' WHERE company=? AND evento=? AND envio='pendente'",(company,evento)).rowcount
            return {'telefone':row[1]} if changed else None

    def confirmar_envio(self, company, evento, mensagem):
        exigir(isinstance(mensagem,str) and 1 <= len(mensagem) <= 500)
        with self.db:self.db.execute("UPDATE recibos SET envio='aceito_pelo_provedor',mensagem=? WHERE company=? AND evento=? AND envio='incerto'",(mensagem,company,evento))

    def tarefas(self, company, estabelecimento, eventos):
        with self.db:
            for e in eventos:self.db.execute('INSERT OR IGNORE INTO tarefas VALUES(?,?,?,?,?,?)',
                (company,estabelecimento,e['eventId'],e['nsr'],'pendente',0))

    def cursor(self, company, estabelecimento, nsr=None):
        if nsr is not None:
            with self.db:self.db.execute('INSERT INTO cursores VALUES(?,?,?) ON CONFLICT(company,estabelecimento) DO UPDATE SET nsr=max(nsr,excluded.nsr)',(company,estabelecimento,nsr))
        row=self.db.execute('SELECT nsr FROM cursores WHERE company=? AND estabelecimento=?',(company,estabelecimento)).fetchone()
        return row[0] if row else 0

    def estado_tarefa(self, company, estabelecimento, evento, estado):
        with self.db:self.db.execute('UPDATE tarefas SET estado=?,tentativa=? WHERE company=? AND estabelecimento=? AND evento=?',
            (estado,self.agora(),company,estabelecimento,evento))

    def pendencias(self, company):
        return {'emissao':dict(self.db.execute('SELECT estado,count(*) FROM tarefas WHERE company=? GROUP BY estado',(company,)).fetchall()),
            'envios':dict(self.db.execute('SELECT envio,count(*) FROM recibos WHERE company=? GROUP BY envio',(company,)).fetchall())}
