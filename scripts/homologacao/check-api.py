"""Verifica a API real isolada, sem imprimir PIN, senha, token ou documentos.

Usa o operador sintético já preparado. --provision vincula essa conta pelo
fluxo normal; --verify-time pede uma medição NTP real, sem ajustar o relógio.
Não cria usuário pelo setup público nem executa SQL.
"""
import argparse
import json
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
API = 'https://ponto-homologacao.vercel.app/api/data'
PROJECT = 'ukkzpttnbyylkyujzwnv'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--access', required=True)
    parser.add_argument('--provision', action='store_true')
    parser.add_argument('--verify-time', action='store_true')
    parser.add_argument('--report', default='.tools/homologacao-api-report.json')
    args = parser.parse_args()
    access_file = Path(args.access).resolve()
    if access_file.is_relative_to(ROOT):
        raise ValueError('Mantenha o arquivo de acesso fora do repositório.')
    access = json.loads(access_file.read_text())
    if access.get('endpoint') != API or access.get('projectId') != PROJECT:
        raise ValueError('Destino isolado não confirmado.')
    report = {'endpoint': API, 'projectId': PROJECT, 'checks': []}

    def request(body, route='data', expected=200):
        payload = {'ambienteApp': 'homologacao', **body}
        req = urllib.request.Request(API.replace('/api/data', '/api/' + route),
                                     data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                status, result = response.status, json.load(response)
        except urllib.error.HTTPError as error:
            status = error.code
            try:
                result = json.load(error)
            except (ValueError, OSError):
                result = {}
        name = body.get('action', 'upload-' + body.get('documentAction', 'check'))
        check = {'action': name, 'status': status, 'passed': status == expected}
        report['checks'].append(check)
        if status != expected:
            raise RuntimeError(f'{name}: HTTP {status}; esperado {expected}.')
        return result

    try:
        marker = request({'action': 'ponto-ambiente'})
        if marker.get('ok') is not True or marker.get('ambiente') != 'homologacao':
            raise ValueError('Marcador real de homologação não confirmado.')
        report['environment'] = marker['ambiente']
        request({'action': 'ponto-parear', 'ambienteApp': 'producao'}, expected=409)
        request({'action': 'setup'}, expected=403)
        request({'action': 'ponto-sincronizar'}, expected=401)
        request({'folder': 'rh', 'documentAction': 'list', 'employeeId': 'piloto-k110-fulano'},
                route='upload', expected=401)
        if args.provision:
            request({'action': 'auth-provision', 'userId': access['userId'], 'pin': access['pin'],
                     'targetUserId': access['userId'], 'password': access['password']})
        login = request({'action': 'auth-login', 'email': access['email'], 'password': access['password']})
        if not login.get('accessToken') or not login.get('refreshToken'):
            raise ValueError('Sessão autenticada não confirmada.')
        access.update({key: login[key] for key in ('accessToken', 'refreshToken')})
        access_file.write_text(json.dumps(access, indent=2) + '\n')
        access_file.chmod(0o600)
        session = {'accessToken': access['accessToken']}
        loaded = request({'action': 'load', **session})
        data = loaded.get('data', {})
        report['syntheticEmployeeCount'] = sum(row.get('id') in ('piloto-k110-fulano', 'piloto-k110-siclano')
                                               for row in data.get('employees', []))
        documents = request({'folder': 'rh', 'documentAction': 'list',
                             'employeeId': 'piloto-k110-fulano', **session}, route='upload')
        report['fulanoDocuments'] = len(documents.get('documents', []))
        if args.verify_time:
            time = request({'action': 'ponto-tempo-verificar', **session})
            verification = time.get('verificacao', {})
            evidence = time.get('tempo', {})
            report['time'] = {'ntpOk': verification.get('ok') is True,
                              'trusted': evidence.get('confiavel') is True,
                              'offsetMs': verification.get('offsetMs'),
                              'uncertaintyMs': verification.get('incertezaMs')}
            if not report['time']['ntpOk'] or not report['time']['trusted']:
                raise RuntimeError('Relógio sem evidência NTP confiável; o aceite de ponto permanece pendente.')
        report['passed'] = True
    except (RuntimeError, ValueError, OSError) as error:
        # Mensagens deste verificador não contêm respostas cruas ou credenciais.
        report['passed'] = False
        report['failure'] = type(error).__name__
        raise
    finally:
        target = ROOT / args.report
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
