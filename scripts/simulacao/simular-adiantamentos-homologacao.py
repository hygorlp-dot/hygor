"""Ensaio pequeno de adiantamentos em homologação, sem transferência real.

Sem --execute, mostra somente o plano local: não lê credenciais nem faz rede.
A execução depende da infraestrutura e do seed de cadastros já conferidos.
Reutiliza comandos oficiais; não altera ponto, relógio, cadastro ou folha mensal.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / 'scripts/simulacao/adiantamentos-homologacao.mjs'


def local_helper(mode, data=None):
    result = subprocess.run(['node', str(HELPER), mode], cwd=ROOT, text=True,
                            input=json.dumps(data) if data is not None else None,
                            capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip()[:400] or 'Conferência local recusou o estado.')
    return json.loads(result.stdout)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('A API tentou redirecionar o pedido. Nenhuma credencial será reenviada.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Executa os comandos no destino isolado já preparado.')
    parser.add_argument('--access', help='Arquivo privado, fora do repositório; lido somente com --execute.')
    parser.add_argument('--report', default='.tools/homologacao-adiantamentos-report.json')
    args = parser.parse_args()
    plan = local_helper('plan')
    if not args.execute:
        print(json.dumps({'mode': 'plan_only', 'executed': False, 'plan': plan}, ensure_ascii=False, indent=2))
        return
    if not args.access:
        raise ValueError('Informe --access para a execução autorizada.')
    access_file = Path(args.access).resolve()
    if access_file.is_relative_to(ROOT) or access_file.stat().st_mode & 0o077:
        raise ValueError('Use um arquivo privado, sem acesso de grupo/outros e fora do repositório.')
    access = json.loads(access_file.read_text())
    if access.get('endpoint') != plan['endpoint'] or access.get('projectId') != plan['projectId']:
        raise ValueError('Endpoint ou projeto não corresponde à homologação autorizada.')
    if not access.get('email') or not access.get('password'):
        raise ValueError('Arquivo privado sem e-mail/senha para o login corporativo.')

    opener = urllib.request.build_opener(NoRedirect())
    secrets = [str(access[key]) for key in ('email', 'password', 'pin', 'accessToken', 'refreshToken') if access.get(key)]
    token = None
    allowed_commands = [person['create'] for person in plan['people']] + [plan['import']]
    allowed_commands += [payment for person in plan['people'] for payment in person['payments']]
    allowed_json = {json.dumps(body, sort_keys=True) for body in allowed_commands}

    def safe_message(value):
        text = str(value)
        for secret in secrets:
            text = text.replace(secret, '[credencial omitida]')
        return re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[token omitido]', text)[:400]

    def request(body, authenticated=True):
        action = body.get('action')
        if action in ('operational-command', 'reconciliation-command'):
            if json.dumps(body, sort_keys=True) not in allowed_json:
                raise ValueError('Comando fora do plano fixo dos dois funcionários de teste.')
        elif action not in ('ponto-ambiente', 'auth-login', 'load'):
            raise ValueError('Ação fora do ensaio permitido.')
        payload = {'ambienteApp': 'homologacao', **body}
        if authenticated:
            if not token:
                raise ValueError('Sessão autenticada ausente.')
            payload['accessToken'] = token
        req = urllib.request.Request(plan['endpoint'], data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with opener.open(req, timeout=60) as response:
                if response.geturl() != plan['endpoint']:
                    raise RuntimeError('Resposta recebida de outro endereço.')
                result = json.load(response)
        except urllib.error.HTTPError as error:
            try:
                problem = json.load(error)
                message = problem.get('error') or problem.get('reason') or 'Pedido recusado'
            except (ValueError, OSError):
                message = 'Resposta sem JSON'
            raise RuntimeError(f'{action}: HTTP {error.code}: {safe_message(message)}') from None
        if not isinstance(result, dict) or result.get('ok') is False:
            raise RuntimeError(safe_message(result.get('error') or result.get('reason') or 'Resposta inválida')
                               if isinstance(result, dict) else 'Resposta inválida da API.')
        return result

    def marker():
        if request({'action': 'ponto-ambiente'}, authenticated=False).get('ambiente') != 'homologacao':
            raise ValueError('Marcador do banco não confirmou homologação.')

    marker()
    login = request({'action': 'auth-login', 'email': access['email'], 'password': access['password']}, authenticated=False)
    if login.get('usuario', {}).get('role') != 'admin':
        raise ValueError('Este ensaio combinado de RH/Financeiro exige o administrador de homologação.')
    if access.get('userId') and str(login['usuario'].get('id')) != str(access['userId']):
        raise ValueError('O operador autenticado difere do arquivo de acesso autorizado.')
    token = login.get('accessToken')
    if not token:
        raise ValueError('Login não retornou sessão válida.')
    secrets.append(token)
    if login.get('refreshToken'):
        secrets.append(login['refreshToken'])
    report = {'scenario': plan['scenario'], 'environment': 'homologacao', 'endpoint': plan['endpoint'],
              'projectId': plan['projectId'], 'status': 'running', 'startedAt': datetime.now(timezone.utc).isoformat(),
              'businessDate': plan['businessDate'], 'deductionDate': plan['deductionDate'],
              'realTransfer': False, 'monthlyPayrollClosed': False, 'clockChanged': False, 'steps': []}
    target = (ROOT / args.report).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)

    def save_report():
        temporary = target.with_suffix(target.suffix + '.tmp')
        temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(target)

    baseline = None

    def snapshot():
        data = request({'action': 'load'})['data']
        checked = local_helper('inspect', data)
        if baseline is not None:
            for key in ('protectedHash', 'outsideFinancialHash', 'costs'):
                if checked[key] != baseline[key]:
                    raise ValueError(f'A conferência detectou alteração fora do ensaio: {key}.')
        return checked

    def record(label, state, **extra):
        report['steps'].append({'step': label, 'at': datetime.now(timezone.utc).isoformat(),
                               'advances': state['advances'], 'transactionCount': state['transactionCount'],
                               'cashOutCents': state['cashOutCents'], 'payableCents': state['payableCents'], **extra})
        save_report()

    def send_and_repeat(body, label):
        marker()
        snapshot()  # Confere destino lógico, pessoas e competência antes de gravar.
        first = request(body)
        after = snapshot()
        marker()
        repeated = request(body)
        repeated_state = snapshot()
        if repeated.get('idempotent') is not True or after['scopedHash'] != repeated_state['scopedHash']:
            raise ValueError('O reenvio não confirmou idempotência ou alterou os registros já gravados.')
        record(label, repeated_state, firstWasIdempotent=first.get('idempotent', False), retryVerified=True)
        return repeated_state

    try:
        baseline = snapshot()
        report['baseline'] = {'protectedHash': baseline['protectedHash'], 'outsideFinancialHash': baseline['outsideFinancialHash'], 'costs': baseline['costs']}
        record('preflight', baseline)
        state = baseline
        for person in plan['people']:
            current = next(row for row in state['advances'] if row['id'] == person['id'])
            if current['exists']:
                record(f"preservar_{person['label'].lower()}", state, preserved=True)
            else:
                state = send_and_repeat(person['create'], f"criar_{person['label'].lower()}")
                current = next(row for row in state['advances'] if row['id'] == person['id'])
                if current['paidCents'] != 0 or current['eligibleDeductionCents'] != 0:
                    raise ValueError('Criar a obrigação não pode registrar pagamento ou desconto elegível.')
        if not state['statementExists']:
            state = send_and_repeat(plan['import'], 'importar_extrato_ficticio')
        else:
            record('preservar_extrato_ficticio', state, preserved=True)
        for person in plan['people']:
            for payment in person['payments']:
                transaction_id = payment['command']['payload']['transactionId']
                current = next(row for row in state['advances'] if row['id'] == person['id'])
                if transaction_id in current['paidTransactionIds']:
                    record(f'preservar_{transaction_id}', state, preserved=True)
                    continue
                state = send_and_repeat(payment, f'baixar_{transaction_id}')
                current = next(row for row in state['advances'] if row['id'] == person['id'])
                expected_status = 'partial' if current['liquidationCount'] == 1 else 'paid'
                if current['status'] != expected_status:
                    raise ValueError('A baixa não produziu o estado parcial/pago esperado.')
        state = snapshot()
        if state['transactionCount'] != 4 or state['cashOutCents'] != 192000 or state['payableCents'] != 0:
            raise ValueError('O fechamento do ensaio diverge dos quatro movimentos e R$ 1.920,00 previstos.')
        if any(row['liquidationCount'] != 2 or row['status'] != 'paid' for row in state['advances']):
            raise ValueError('Faltam as duas liquidações de cada adiantamento.')
        report.update({'status': 'completed', 'completedAt': datetime.now(timezone.utc).isoformat(),
                       'final': state, 'dreUnchanged': True, 'employeesAndAttendanceUnchanged': True})
        save_report()
        print(json.dumps({'status': report['status'], 'environment': 'homologacao', 'advances': 2,
                          'syntheticTransactions': 4, 'cashOutCents': 192000, 'payableCents': 0,
                          'monthlyPayrollClosed': False, 'report': str(target)}, ensure_ascii=False))
    except Exception as error:
        report.update({'status': 'failed', 'error': safe_message(error)})
        save_report()
        raise RuntimeError(safe_message(error)) from None


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # O cliente já remove os valores privados das falhas de HTTP.
        raise SystemExit(str(error)) from None
