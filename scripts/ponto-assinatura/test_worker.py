import base64
import json
import threading
import unittest
from http.server import HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from worker import handler, renderizar


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.token='segredo-exclusivo-teste-nao-produzir-0000'
        self.server=HTTPServer(('127.0.0.1',0),handler({},self.token))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.base='http://127.0.0.1:'+str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join()

    def post(self,path,payload,token=None):
        headers={'Content-Type':'application/json'}
        if token:headers['Authorization']='Bearer '+token
        return urlopen(Request(self.base+path,data=json.dumps(payload).encode(),headers=headers),timeout=5)

    def test_nao_autorizado_nao_renderiza(self):
        with self.assertRaises(HTTPError) as failure:self.post('/renderizar',{'fields':[['CPF','teste']]})
        self.assertEqual(failure.exception.code,403)
        failure.exception.close()

    def test_renderizacao_privada_e_campos_escapados(self):
        with self.post('/renderizar',{'fields':[['Nome','PESSOA SINTETICA <script>']]},self.token) as response:
            result=json.load(response)
        self.assertTrue(base64.b64decode(result['base64']).startswith(b'%PDF-'))
        self.assertEqual(set(result),{'base64'})

    def test_padrao_invalido_nao_assina_nem_expoe_segredos(self):
        with self.assertRaises(HTTPError) as failure:self.post('/assinar',{'desenvolvedor':{'tipo':None,'numero':None},'padrao':'inseguro'},self.token)
        body=failure.exception.read().decode()
        self.assertEqual(failure.exception.code,422);self.assertNotIn(self.token,body)
        failure.exception.close()

    def test_renderizador_nao_aceita_html_ou_campos_arbitrarios(self):
        for fields in [None,[],[['nome']],[[123,'x']], [['nome','x'*1001]]]:
            with self.assertRaises(ValueError):renderizar(fields,{})


if __name__=='__main__':unittest.main()
