import base64
import hashlib
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from comprovantes import Cofre
from processador import Processador, endereco, identidade_telefone, prontidao_liberada


class CofreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.now=1_800_000_000
        self.path=Path(self.tmp.name)/'cofre.sqlite';self.c=Cofre(self.path,lambda:self.now)
        # Dados isolados de teste. A validação criptográfica ocorre no worker.
        self.raw=b'%PDF-1.7\nsimulacao isolada'
        self.b64=base64.b64encode(self.raw).decode()
        self.m={'companyId':'teste','employeeId':'pessoa-a','eventId':'e1','nsr':1,
            'marcadoEm':'2026-11-05T10:00:00Z','status':'assinado_validado','padrao':'PAdES',
            'sha256':hashlib.sha256(self.raw).hexdigest()}
        self.policy=Path(self.tmp.name)/'politica.json'
        self.policy.write_text(json.dumps({'companyId':'teste','modo':'somente_pdf_oficial',
            'envioHabilitado':True,'bloqueios':[],'escopoSolicitado':{'dataLocal':'2026-11-05',
            'normalDesde':'2026-11-06','normalNovasBatidas':True,'incluirDiasAnteriores':False,'fuso':'America/Bahia',
            'remetenteInformado':'5581888888888'}}))

    def tearDown(self):self.c.fechar();self.tmp.cleanup()
    def salvar(self):return self.c.salvar('teste',self.b64,self.m)

    def processador_envio(self,waha):
        p=Processador({'companyId':'teste','estabelecimentos':[],'wahaSessao':'isolada',
            'politicaEnvioArquivo':str(self.policy)},self.c,None,waha,
            agora=lambda:datetime.fromisoformat('2026-11-05T22:00:00+00:00'))
        self.c.db.execute('INSERT OR REPLACE INTO origens_entrega VALUES (?,?,?)',
            ('teste','e1',json.dumps({**self.m,'tipoEvento':'saida'})))
        self.c.db.commit()
        return p

    def test_idempotencia_imutabilidade_e_integridade(self):
        self.assertFalse(self.salvar()['existente']);self.assertTrue(self.salvar()['existente'])
        self.assertEqual(self.c.obter('teste','e1')['base64'],self.b64)
        with self.assertRaises(ValueError):self.c.salvar('outra',self.b64,self.m)
        with self.assertRaises(ValueError):self.c.salvar('teste',base64.b64encode(b'%PDF-alterado').decode(),self.m)
        self.c.db.execute("UPDATE recibos SET pdf=?",(b'%PDF-adulterado',));self.c.db.commit()
        with self.assertRaises(ValueError):self.c.obter('teste','e1')

    def test_acesso_nao_cruza_empresa_ou_funcionario(self):
        self.salvar();a=self.c.acesso('teste','pessoa-a')['token'];b=self.c.acesso('teste','pessoa-b')['token']
        self.assertEqual(len(self.c.consultar('teste',a)['comprovantes']),1)
        self.assertEqual(self.c.consultar('teste',b)['comprovantes'],[])
        for company,token,event in [('outra',a,None),('teste',b,'e1'),('teste','52998224725',None)]:
            with self.assertRaises(ValueError):self.c.consultar(company,token,event)
        self.assertNotIn(a,str(self.c.db.execute('SELECT * FROM acessos').fetchall()))

    def test_revogacao_rotacao_e_expiracao(self):
        a=self.c.acesso('teste','pessoa-a')['token'];b=self.c.acesso('teste','pessoa-a')['token']
        with self.assertRaises(ValueError):self.c.consultar('teste',a)
        self.c.revogar('teste','pessoa-a')
        with self.assertRaises(ValueError):self.c.consultar('teste',b)
        c=self.c.acesso('teste','pessoa-a')['token'];self.now+=91*86400
        with self.assertRaises(ValueError):self.c.consultar('teste',c)

    def test_nao_envia_sem_confirmacao_nem_repete_apos_queda(self):
        self.salvar()
        self.assertIsNone(self.c.reservar_envio('teste','e1','5581999999999'))
        self.c.contato('teste','pessoa-a','5581999999999','rh-teste')
        self.assertIsNone(self.c.reservar_envio('teste','e1','5581888888888'))
        self.assertIsNotNone(self.c.reservar_envio('teste','e1','5581999999999'))
        self.c.fechar();self.c=Cofre(self.path,lambda:self.now)
        self.assertIsNone(self.c.reservar_envio('teste','e1','5581999999999'))
        self.assertEqual(self.c.pendencias('teste')['envios'],{'incerto':1})

    def test_processamento_reinicia_sem_perder_bloqueios_e_sem_enviar(self):
        calls=[]
        def api(body):
            calls.append(body)
            if body['operacao']=='listar':return {'eventos':[{**self.m,'tipoEvento':'saida'}],'proximoNsr':1}
            return {'error':'INPI_PENDENTE'}
        p=Processador({'companyId':'teste','estabelecimentos':['estab'],'politicaEnvioArquivo':str(self.policy)},self.c,api,
            agora=lambda:datetime.fromisoformat('2026-11-05T22:00:00+00:00'))
        self.assertEqual(p.rodada()['emissao'],{'bloqueado':1})
        p.rodada();self.assertEqual(sum(x['operacao']=='emitir' for x in calls),1)
        self.now+=301;self.salvar();p.rodada()
        self.assertEqual(p.rodada()['emissao'],{'emitido':1})
        self.assertEqual(self.c.cursor('teste','estab'),1)

    def test_historico_nao_e_emitido_nem_bloqueia_novas_saidas(self):
        calls=[]
        def api(body):
            calls.append(body)
            if body['operacao']=='listar':return {'eventos':[
                {**self.m,'eventId':'antigo','nsr':1,'marcadoEm':'2026-11-04T10:00:00Z','tipoEvento':'saida'},
                {**self.m,'eventId':'entrada','nsr':2,'tipoEvento':'entrada'},
                {**self.m,'eventId':'nova','nsr':3,'tipoEvento':'saida'}],'proximoNsr':3}
            return {'error':'INPI_PENDENTE'}
        p=Processador({'companyId':'teste','estabelecimentos':['estab'],'politicaEnvioArquivo':str(self.policy)},self.c,api,
            agora=lambda:datetime.fromisoformat('2026-11-05T22:00:00+00:00'))
        p.rodada()
        self.assertEqual([c['eventId'] for c in calls if c['operacao']=='emitir'],['nova'])
        self.assertEqual(self.c.pendencias('teste')['emissao'],{'fora_do_escopo':2,'bloqueado':1})

    def test_envio_pdf_somente_para_destinatario_confirmado(self):
        self.salvar();self.c.contato('teste','pessoa-a','5581999999999','rh-teste');calls=[]
        def waha(path,payload):
            calls.append((path,payload))
            if path=='/api/sessions/isolada':return {'status':'WORKING','me':{'id':'5581888888888@c.us'}}
            if payload is None:return {'numberExists':True,'chatId':'123456@lid'}
            return {'id':'mensagem-sintetica'}
        p=self.processador_envio(waha)
        self.assertEqual(p.rodada()['envios'],{'aceito_pelo_provedor':1});p.rodada()
        self.assertEqual(len(calls),3)
        self.assertEqual(calls[2][1]['file']['data'],self.b64)
        self.assertEqual(calls[2][1]['chatId'],'123456@lid')

    def test_timeout_de_envio_nao_reenvia(self):
        self.salvar();self.c.contato('teste','pessoa-a','5581999999999','rh-teste');calls=[]
        def waha(path,payload):
            calls.append(path)
            if path=='/api/sessions/isolada':return {'status':'WORKING','me':{'id':'5581888888888@c.us'}}
            if payload is None:return {'numberExists':True,'chatId':'123456@lid'}
            raise TimeoutError()
        p=self.processador_envio(waha)
        p.rodada();p.rodada();self.assertEqual(len(calls),3)
        self.assertEqual(self.c.pendencias('teste')['envios'],{'incerto':1})

    def test_filtro_nao_contata_provedor_nem_reserva_recibo_proibido(self):
        self.salvar();self.c.contato('teste','pessoa-a','5581999999999','rh-teste');calls=[]
        p=self.processador_envio(lambda *args:calls.append(args))
        self.c.db.execute('UPDATE origens_entrega SET origem=?',(json.dumps({**self.m,'tipoEvento':'entrada'}),))
        self.c.db.commit();p.rodada()
        self.assertEqual(calls,[])
        self.assertEqual(self.c.pendencias('teste')['envios'],{'pendente':1})

    def test_conta_remetente_trocada_nao_envia_nem_reserva(self):
        self.salvar();self.c.contato('teste','pessoa-a','5581999999999','rh-teste');calls=[]
        def waha(path,payload):
            calls.append(path)
            return {'status':'WORKING','me':{'id':'5581777777777@c.us'}}
        p=self.processador_envio(waha);p.rodada()
        self.assertEqual(calls,['/api/sessions/isolada'])
        self.assertEqual(self.c.pendencias('teste')['envios'],{'pendente':1})

    def test_identidade_brasileira_com_nono_digito_sem_aceitar_outro_ddd(self):
        self.assertEqual(identidade_telefone('5581989751300'),identidade_telefone('558189751300'))
        self.assertNotEqual(identidade_telefone('5581989751300'),identidade_telefone('557189751300'))
        self.assertNotEqual(identidade_telefone('5581989751300'),identidade_telefone('558188751300'))

    def test_prontidao_exige_todas_evidencias_e_worker_conectado(self):
        codigos=['INPI','DESENVOLVEDOR','ASSINATURA','ATESTADO','INTEGRIDADE','AFD','AEJ',
                 'ACESSO_TRABALHADOR','HLB','ARP','COLETOR']
        resposta={'workerConectado':True,'prontidao':{'podePrepararEmissao':True,
            'requisitos':[{'codigo':c,'status':'evidencia_informada'} for c in codigos]}}
        self.assertTrue(prontidao_liberada(resposta))
        resposta['workerConectado']=False;self.assertFalse(prontidao_liberada(resposta))
        resposta['workerConectado']=True
        resposta['prontidao']['requisitos'][0]['status']='pendente'
        self.assertFalse(prontidao_liberada(resposta))
        resposta['prontidao']['requisitos']=[]
        self.assertFalse(prontidao_liberada(resposta))
        for value in ({},None,{'error':'indisponivel'}):self.assertFalse(prontidao_liberada(value))

    def test_liberacao_automatica_reavaliada_sem_alterar_bloqueio_persistido(self):
        self.salvar()
        p=self.processador_envio(lambda *args:{})
        p.config.update({'exigirProntidaoFiscal':True,'estabelecimentos':['estab']})
        policy=json.loads(self.policy.read_text());policy.update({'envioHabilitado':False,'ativarQuandoPronto':True})
        self.policy.write_text(json.dumps(policy))
        codigos=['INPI','DESENVOLVEDOR','ASSINATURA','ATESTADO','INTEGRIDADE','AFD','AEJ',
                 'ACESSO_TRABALHADOR','HLB','ARP','COLETOR']
        ready={'workerConectado':True,'prontidao':{'podePrepararEmissao':True,
            'requisitos':[{'codigo':c,'status':'evidencia_informada'} for c in codigos]}}
        calls=[]
        def api(body):
            calls.append(body['operacao'])
            return ready if body['operacao']=='prontidao' else {'eventos':[],'proximoNsr':0}
        p.api=api;p.rodada()
        self.assertTrue(p.politica()['envioHabilitado'])
        self.assertFalse(json.loads(self.policy.read_text())['envioHabilitado'])
        ready['workerConectado']=False;calls.clear()
        self.assertEqual(p.rodada()['situacao'],'aguardando_prontidao_fiscal')
        self.assertEqual(calls,['listar','prontidao'])
        self.assertFalse(p.politica()['envioHabilitado'])

    def test_fila_vazia_nao_consume_conexao_do_tunel(self):
        calls=[]
        p=self.processador_envio(lambda *args:self.fail('não chamar WAHA'))
        p.config.update({'exigirProntidaoFiscal':True,'estabelecimentos':['estab']})
        def api(body):
            calls.append(body['operacao'])
            return {'eventos':[],'proximoNsr':0}
        p.api=api
        self.assertEqual(p.rodada()['situacao'],'sem_batidas_elegiveis')
        self.assertEqual(calls,['listar'])

    def test_https_sem_credenciais_embutidas(self):
        for url in ['http://servidor.invalid','https://user:senha@host.invalid','https://host.invalid?segredo=x']:
            with self.assertRaises(ValueError):endereco(url)
        self.assertEqual(endereco('http://127.0.0.1:3075',local=True),'http://127.0.0.1:3075')

    def test_paginacao_nao_oculta_acervo_nem_duplica_com_novas_batidas(self):
        for n in range(201):
            self.m['eventId']='e'+str(n).zfill(4);self.m['nsr']=n+1;self.salvar()
        token=self.c.acesso('teste','pessoa-a')['token']
        first=self.c.consultar('teste',token)
        self.assertEqual(len(first['comprovantes']),200);self.assertIsNotNone(first['proximo'])
        self.now+=1;self.m['eventId']='nova';self.m['nsr']=202;self.salvar()
        second=self.c.consultar('teste',token,antes=first['proximo'])
        self.assertEqual(len(second['comprovantes']),1)
        ids=[e['eventId'] for e in first['comprovantes']+second['comprovantes']]
        self.assertEqual(len(set(ids)),201)


if __name__=='__main__':unittest.main()
