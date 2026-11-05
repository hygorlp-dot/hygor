import copy
import unittest
from datetime import datetime
from politica_envio import permitido


class PoliticaTests(unittest.TestCase):
    def setUp(self):
        self.p = {'envioHabilitado': True, 'bloqueios': [], 'companyId': 'teste',
                  'modo': 'somente_pdf_oficial', 'escopoSolicitado': {
                      'fuso': 'America/Bahia', 'dataLocal': '2026-11-05',
                      'normalDesde': '2026-11-06', 'normalNovasBatidas': True,
                      'incluirDiasAnteriores': False}}
        self.m = {'companyId': 'teste', 'eventId': 'a', 'employeeId': 'emp', 'nsr': 1,
                  'status': 'assinado_validado', 'padrao': 'PAdES', 'marcadoEm': '2026-11-05T20:00:00Z'}
        self.e = {**self.m, 'tipoEvento': 'saida'}
        self.now = datetime.fromisoformat('2026-11-05T22:00:00+00:00')

    def test_hoje_apenas_saida_identificada(self):
        self.assertTrue(permitido(self.m, self.e, self.p, self.now))
        for tipo in ('entrada', None, 'SAIDA', ''):
            self.e['tipoEvento'] = tipo
            self.assertFalse(permitido(self.m, self.e, self.p, self.now))

    def test_amanha_entrada_e_saida_novas_sem_historico(self):
        self.now = datetime.fromisoformat('2026-11-06T15:00:00+00:00')
        self.assertFalse(permitido(self.m, self.e, self.p, self.now))
        self.m['marcadoEm'] = self.e['marcadoEm'] = '2026-11-06T12:00:00Z'
        for tipo in ('entrada', 'saida', None):
            self.e['tipoEvento'] = tipo
            self.assertTrue(permitido(self.m, self.e, self.p, self.now))

    def test_meia_noite_bahia_nao_utc(self):
        self.m['marcadoEm'] = self.e['marcadoEm'] = '2026-11-06T02:59:59Z'
        self.now = datetime.fromisoformat('2026-11-06T02:59:59+00:00')
        self.e['tipoEvento'] = 'entrada'
        self.assertFalse(permitido(self.m, self.e, self.p, self.now))
        self.e['tipoEvento'] = 'saida'
        self.assertTrue(permitido(self.m, self.e, self.p, self.now))
        self.now = datetime.fromisoformat('2026-11-06T03:00:00+00:00')
        self.assertFalse(permitido(self.m, self.e, self.p, self.now))

    def test_fail_closed_sem_origem_ou_politica(self):
        for politica, origem in (({}, self.e), (self.p, None)):
            self.assertFalse(permitido(self.m, origem, politica, self.now))
        for campo, valor in (('envioHabilitado', False), ('bloqueios', ['pendente']), ('companyId', 'outra')):
            p = copy.deepcopy(self.p); p[campo] = valor
            self.assertFalse(permitido(self.m, self.e, p, self.now))

    def test_origem_incompativel_futuro_sem_fuso_e_nao_oficial(self):
        for campo, valor in (('eventId', 'outro'), ('employeeId', 'outra'), ('nsr', 2), ('marcadoEm', '2026-11-05T19:00:00Z')):
            e = {**self.e, campo: valor}
            self.assertFalse(permitido(self.m, e, self.p, self.now))
        for valor in ('2026-11-05T23:00:00Z', '2026-11-05T18:00:00', 'inválido', '2026-11-04T18:00:00Z'):
            m = {**self.m, 'marcadoEm': valor}; e = {**self.e, 'marcadoEm': valor}
            self.assertFalse(permitido(m, e, self.p, self.now))
        self.m['status'] = 'simulado'
        self.assertFalse(permitido(self.m, self.e, self.p, self.now))


if __name__ == '__main__':
    unittest.main()
