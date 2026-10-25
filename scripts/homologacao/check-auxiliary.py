"""Confere presença e resumo público reais, sem enviar chat nem chamar IA paga."""
import argparse
import json
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'ukkzpttnbyylkyujzwnv'
VERCEL = 'https://ponto-homologacao.vercel.app/api'
EDGE = f'https://{PROJECT}.supabase.co/functions/v1/ponto-api-homologacao'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--access', required=True)
    parser.add_argument('--edge', action='store_true')
    parser.add_argument('--report', default='.tools/homologacao-auxiliary-report.json')
    args = parser.parse_args()
    access_file = Path(args.access).resolve()
    if access_file.is_relative_to(ROOT):
        raise ValueError('Mantenha o acesso fora do repositório.')
    access = json.loads(access_file.read_text())
    if access.get('endpoint') != VERCEL + '/data' or access.get('projectId') != PROJECT:
        raise ValueError('Destino isolado não confirmado.')
    base = EDGE if args.edge else VERCEL
    report = {'projectId': PROJECT, 'via': 'edge' if args.edge else 'vercel', 'checks': []}

    def call(route, body, expected=200):
        url = base if args.edge and route == 'data' else base + '/' + route
        req = urllib.request.Request(url, data=json.dumps({'ambienteApp': 'homologacao', **body}).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        start = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                status, value = response.status, json.load(response)
        except urllib.error.HTTPError as error:
            status = error.code
            try:
                value = json.load(error)
            except (ValueError, OSError):
                value = {}
        report['checks'].append({'route': route, 'action': body.get('action'), 'status': status,
                                 'passed': status == expected, 'seconds': round(time.monotonic() - start, 2)})
        if status != expected:
            raise RuntimeError(f'{route}: HTTP {status}; esperado {expected}.')
        return value

    try:
        marker = call('data', {'action': 'ponto-ambiente'})
        if marker.get('ok') is not True or marker.get('ambiente') != 'homologacao':
            raise ValueError('Marcador real ausente.')
        call('presence', {'action': 'heartbeat'}, expected=401)
        call('ai-agent', {'action': 'daily-brief'}, expected=401)
        blocked = call('ai-agent', {'action': 'configure'}, expected=503)
        if blocked.get('code') != 'AI_DISABLED_HOMOLOGACAO':
            raise ValueError('Bloqueio da IA externa não confirmado.')
        login = call('data', {'action': 'auth-login', 'email': access['email'], 'password': access['password']})
        token = login.get('accessToken')
        if not token:
            raise ValueError('Sessão autenticada ausente.')
        session_id = str(uuid.uuid4())
        session = {'accessToken': token, 'sessionId': session_id}
        call('presence', {'action': 'heartbeat', 'tab': 'equipe', 'device': 'ensaio de homologacao', **session})
        presences = call('presence', {'action': 'list', **session})
        report['ownPresenceVisible'] = any(row.get('sessionId') == session_id for row in presences.get('presencas', []))
        if not report['ownPresenceVisible']:
            raise ValueError('Presença gravada não apareceu na leitura.')
        brief = call('ai-agent', {'action': 'daily-brief', **session})
        report['dailyBrief'] = {'ok': brief.get('ok') is True, 'weatherPresent': bool(brief.get('clima')),
                                'newsCount': len(brief.get('noticias', [])), 'cubPresent': bool(brief.get('cub'))}
        if not report['dailyBrief']['ok']:
            raise ValueError('Resumo público indisponível.')
        call('presence', {'action': 'offline', **session})
        report['externalAiDisabled'] = True
        report['passed'] = True
    except (RuntimeError, ValueError, OSError) as error:
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
