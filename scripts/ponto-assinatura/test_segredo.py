import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from segredo import proteger_windows, senha_do_certificado


class SegredoTests(unittest.TestCase):
    def test_ambiente_e_ausencia_de_senha(self):
        with patch.dict(os.environ,{'SEGREDO_SOMENTE_TESTE':'teste-local'}):
            self.assertEqual(senha_do_certificado({'senhaEnv':'SEGREDO_SOMENTE_TESTE'}),b'teste-local')
        with self.assertRaisesRegex(ValueError,'NAO_CONFIGURADA'):senha_do_certificado({})

    @unittest.skipUnless(os.name=='nt','DPAPI é específico do Windows')
    def test_dpapi_nao_grava_texto_e_rejeita_adulteracao(self):
        original=os.urandom(32)
        encrypted=proteger_windows(original)
        self.assertNotEqual(original,encrypted)
        with tempfile.TemporaryDirectory(prefix='marcell-dpapi-test-') as directory:
            path=Path(directory)/'segredo.dpapi';path.write_bytes(encrypted)
            self.assertEqual(senha_do_certificado({'senhaDpapi':str(path)}),original)
            path.write_bytes(encrypted[:-12]+os.urandom(12))
            with self.assertRaises(ValueError):senha_do_certificado({'senhaDpapi':str(path)})


if __name__=='__main__':unittest.main()
