"""Completa apenas Fulano/Siclano e anexa os PDFs pela API real isolada.

Credenciais ficam fora do repositório. Não executa pagamento, não cria evento
de ponto, não muda relógio e não altera produção. Reenvio conserva documentos.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
API = 'https://ponto-homologacao.vercel.app/api/data'
PROJECT = 'ukkzpttnbyylkyujzwnv'
VERSION = 'fulano-siclano-v1'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--access', required=True, help='Arquivo privado de acesso à homologação.')
    parser.add_argument('--report', default='.tools/homologacao-seed-report.json')
    parser.add_argument('--skip-documents', action='store_true')
    args = parser.parse_args()
    access_file = Path(args.access).resolve()
    access = json.loads(access_file.read_text())
    if access.get('endpoint') != API or access.get('projectId') != PROJECT:
        raise ValueError('Destino isolado não confirmado; nenhuma gravação realizada.')
    if access_file.is_relative_to(ROOT):
        raise ValueError('Guarde as credenciais fora do repositório.')

    def request(body, route='data', authenticated=True):
        payload = {'ambienteApp': 'homologacao', **body}
        if authenticated:
            payload.update({'accessToken': access['accessToken']})
        encoded = json.dumps(payload).encode()
        req = urllib.request.Request(API.replace('/api/data', '/api/' + route), data=encoded,
                                     headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            try:
                problem = json.load(error)
                reason = problem.get('error') or problem.get('reason') or 'Pedido recusado'
            except (ValueError, OSError):
                reason = 'Resposta de erro sem JSON'
            raise RuntimeError(f"{body.get('action', body.get('documentAction', 'pedido'))}: HTTP {error.code}: {str(reason)[:300]}") from None
        if result.get('ok') is False:
            raise RuntimeError(str(result.get('error') or result.get('reason') or 'Operação recusada')[:300])
        return result

    marker = request({'action': 'ponto-ambiente'}, authenticated=False)
    if marker.get('ambiente') != 'homologacao':
        raise ValueError('Marcador do banco não confirmou homologação.')
    login = request({'action': 'auth-login', 'email': access['email'], 'password': access['password']}, authenticated=False)
    access.update({key: login[key] for key in ('accessToken', 'refreshToken')})
    access_file.write_text(json.dumps(access, indent=2) + '\n')
    access_file.chmod(0o600)
    data = login['data']
    personas = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        'import {simulationEmployees} from "./scripts/simulacao/fulano-siclano.mjs";console.log(JSON.stringify(simulationEmployees()));'], cwd=ROOT))
    report = {'environment': marker['ambiente'], 'projectId': PROJECT, 'endpoint': API,
              'version': VERSION, 'employees': [], 'documents': [], 'simulatedPayments': False}

    def save_employee(employee, key, expected_version):
        return request({'action': 'operational-command', 'command': {'type': 'FUNCIONARIO_SALVO',
            'idempotencyKey': key, 'expectedVersion': expected_version, 'payload': {'employee': employee}}})

    for persona in personas:
        data = request({'action': 'load'})['data']
        previous = next((row for row in data.get('employees', []) if row['id'] == persona['id']), None)
        if not previous or previous.get('testData') is not True:
            raise ValueError('Apenas os dois cadastros de teste existentes podem ser completados.')
        if previous.get('simulation', {}).get('version') == VERSION:
            report['employees'].append({'id': persona['id'], 'result': 'preserved'})
            continue
        if previous.get('cadastroPendente') is not True or previous.get('startDate') or previous.get('dailyRate') or previous.get('monthlySalary'):
            raise ValueError('Cadastro já trabalhado; preserve a edição e revise a origem.')
        result = save_employee({**previous, **persona}, f"{VERSION}_admissao_{persona['id']}", previous.get('version', 0))
        report['employees'].append({'id': persona['id'], 'result': 'completed', 'idempotent': result.get('idempotent', False)})

    establishments = request({'action': 'ponto-estabelecimentos'})['estabelecimentos']
    matches = [row for row in establishments if row.get('nome') == 'K1-10 - SIMULAÇÃO']
    if len(matches) > 1:
        raise ValueError('Há estabelecimentos de teste duplicados; revise antes de vincular.')
    establishment = matches[0] if matches else request({'action': 'ponto-estabelecimento-salvar',
        'estabelecimento': {'nome': 'K1-10 - SIMULAÇÃO', 'tipoInscricao': 'CNPJ',
                           'numeroInscricao': '00000001000136', 'timezone': 'America/Recife', 'ativo': True}})['estabelecimento']
    request({'action': 'ponto-estabelecimento-vincular-obra', 'obraId': 'piloto-k110', 'estabelecimentoId': establishment['id']})
    request({'action': 'ponto-responsavel-pin', 'userId': access['userId'], 'pin': access['pin'], 'obras': ['piloto-k110']})
    report['establishmentId'] = establishment['id']
    report['biometricsResponsibleConfigured'] = True

    if not args.skip_documents:
        folder = ROOT / 'scripts/simulacao/documentos'
        documents = json.loads((folder / 'manifest.json').read_text())
        for document in documents:
            raw = (folder / document['fileName']).read_bytes()
            if hashlib.sha256(raw).hexdigest() != document['sha256']:
                raise ValueError('Arquivo de teste mudou depois da conferência.')
            result = request({'folder': 'rh', 'documentAction': 'upload', **document,
                              'dataUrl': 'data:application/pdf;base64,' + base64.b64encode(raw).decode()}, route='upload')
            stored = result['document']
            if stored['sha256'] != document['sha256'] or stored['employeeId'] != document['employeeId']:
                raise ValueError('Documento existente divergente; nenhuma substituição automática.')
            # Open and download using the same private signed URL as the UI.
            opened = request({'folder': 'rh', 'documentAction': 'open', 'employeeId': document['employeeId'],
                              'documentId': document['documentId']}, route='upload')
            with urllib.request.urlopen(opened['url'], timeout=30) as response:
                downloaded = response.read()
            if hashlib.sha256(downloaded).hexdigest() != document['sha256']:
                raise ValueError('Download privado divergente do arquivo enviado.')
            report['documents'].append({'employeeId': document['employeeId'], 'documentId': document['documentId'],
                                        'category': document['category'], 'sha256': document['sha256'],
                                        'uploadAndDownloadVerified': True})
        for persona in personas:
            data = request({'action': 'load'})['data']
            current = next(row for row in data['employees'] if row['id'] == persona['id'])
            listed = request({'folder': 'rh', 'documentAction': 'list', 'employeeId': persona['id']}, route='upload')['documents']
            expected = [row for row in documents if row['employeeId'] == persona['id']]
            if not all(any(stored['id'] == row['documentId'] and stored['sha256'] == row['sha256'] for stored in listed) for row in expected):
                raise ValueError('Prontuário não contém todos os anexos conferidos.')
            if current.get('simulation', {}).get('documentsStatus') == 'anexados_em_homologacao':
                continue
            updated = {**current, 'pendingFields': [item for item in current.get('pendingFields', []) if item != 'documentos_a_enviar'],
                       'simulation': {**current['simulation'], 'documentsStatus': 'anexados_em_homologacao',
                                      'documentIds': [row['documentId'] for row in expected]}}
            save_employee(updated, f"{VERSION}_prontuario_{persona['id']}", current.get('version', 0))

    target = ROOT / args.report
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'environment': marker['ambiente'], 'employeeCount': len(report['employees']),
                      'documentsVerified': len(report['documents']), 'report': str(target)}))


if __name__ == '__main__':
    main()
