"""Gera arquivos sintéticos do prontuário a partir da fixture JavaScript.

Uso: node --input-type=module -e 'import {simulationEmployees} from
"./scripts/simulacao/fulano-siclano.mjs"; console.log(JSON.stringify(simulationEmployees()))'
| python scripts/simulacao/gerar-documentos.py --output scripts/simulacao/documentos

Nenhum documento contém assinatura, laudo ou certificação real.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from uuid import NAMESPACE_URL, uuid5
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def pages_for(person):
    contract = 'CLT mensal - R$ 3.300,00' if person['remunerationMode'] == 'clt' else 'CLT por diária - R$ 120,00'
    addr = person['address']
    return [
        ('identity', 'Identificação de teste', [
            ('Nome', person['name']), ('Identificador interno', person['id']),
            ('CPF sintético', person['cpf']), ('Nascimento fictício', person['birthDate']),
            ('Contato de teste', person['email']), ('Telefone não operacional', person['phone']),
            ('Documento interno', person['simulation']['identification']),
        ], 'Dados inventados exclusivamente para testar cadastro e validações. A validade matemática do CPF não comprova identidade nem indica faixa oficial reservada.'),
        ('address', 'Endereço de teste', [
            ('Logradouro', f"{addr['street']}, {addr['number']}"), ('Bairro', addr['district']),
            ('Município / UF', f"{addr['city']} / {addr['state']}"), ('CEP fictício', addr['postalCode']),
        ], 'Ficha de endereço sintético. Não é conta de consumo nem comprovante de residência emitido por terceiro.'),
        ('contract', 'Premissas contratuais da simulação', [
            ('Função', person['role']), ('Vínculo e remuneração', contract),
            ('Admissão simulada', person['startDate']), ('Lotação inicial', person['obra']),
            ('Jornada do cenário', 'Segunda a sexta, 08h-12h e 13h-17h; 40 horas semanais.'),
            ('Cortes mantidos', '06 a 20 e 21 a 05; competência CLT mensal.'),
            ('Pagamentos', 'Adiantamento identificado antes do fechamento; saldo após apuração e conferência.'),
        ], 'Premissas para ensaio de software. Não é contrato trabalhista nem enquadramento de trabalhador real. Nenhuma assinatura foi coletada.'),
        ('registration', 'Registro funcional de teste', [
            ('Matrícula interna', person['cltPayroll']['profile']['registration']),
            ('CBO no cenário', person['cltPayroll']['profile']['cbo']), ('Admissão', person['startDate']),
            ('Categoria no cenário', person['cltPayroll']['profile']['category']),
            ('Envio externo', 'Não enviado à CTPS Digital, eSocial ou outro órgão.'),
        ], 'Ficha sintética de registro. Não substitui CTPS, recibo de evento ou registro oficial.'),
        ('dependents', 'Dependentes e benefícios de teste', [
            ('Dependentes', 'Zero dependentes neste cenário.'),
            ('Transporte', person['simulation']['benefits']['transport']),
            ('Alimentação', person['simulation']['benefits']['meals']),
            ('Cesta', person['simulation']['benefits']['basket']),
            ('Instruções de pagamento', person['paymentInstructions']),
        ], 'Declarações apenas da massa de teste. Não foram obtidas declarações de pessoas reais.'),
        ('aso', 'Controle de validade de ASO - teste', [
            ('Data de emissão simulada', person['simulation']['asoIssuedAt']),
            ('Validade simulada', person['examExpiresAt']),
            ('Finalidade', 'Testar upload, lembrete de vencimento e restrição de acesso ao prontuário.'),
            ('Exame e conclusão clínica', 'Não realizados. Não existe conclusão de aptidão.'),
        ], 'Este arquivo NÃO é um ASO. Não contém médico, CRM, assinatura, exame ou avaliação clínica. Proibido usá-lo para liberar trabalhador real.'),
        ('training', 'Controle de treinamentos - teste', [
            ('Itens do cenário', 'NR-18 e NR-06, registros sintéticos para testar a rotina.'),
            ('Validade cadastrada', person['examExpiresAt']),
            ('Atividades do cenário', person['simulation']['activities']),
            ('Instrutor / capacitação', 'Não houve curso nem emissão de certificado real.'),
        ], 'Ficha de teste, sem valor de certificado. Não demonstra capacitação nem autoriza atividade.'),
        ('ppe', 'Registro de EPI - teste', [
            ('Data simulada', person['startDate']),
            ('Kit do cenário', 'Capacete, calçado de segurança, luvas, óculos e proteção auditiva.'),
            ('CA / quantidade', 'A conferência de CA e especificação real não faz parte desta massa.'),
            ('Recebimento', 'Não houve entrega física nem assinatura de recebimento.'),
        ], 'Use apenas para validar o prontuário. Não é comprovante de entrega ou adequação de EPI.'),
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    people = json.load(sys.stdin)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='DossierTitle', fontName='Helvetica-Bold', fontSize=20, leading=25,
                              textColor=colors.HexColor('#15354a'), spaceAfter=11 * mm))
    styles.add(ParagraphStyle(name='DossierBody', fontName='Helvetica', fontSize=10, leading=15,
                              textColor=colors.HexColor('#263a47'), alignment=TA_LEFT))
    styles.add(ParagraphStyle(name='DossierLabel', parent=styles['DossierBody'], fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='DossierNotice', parent=styles['DossierBody'], fontName='Helvetica-Bold',
                              textColor=colors.HexColor('#9c341f'), spaceBefore=6 * mm))
    p = lambda text, style='DossierBody': Paragraph(escape(str(text)), styles[style])
    manifest = []
    for person in people:
        if person.get('testData') is not True or not person['id'].startswith('piloto-k110-'):
            raise ValueError('Somente as pessoas de teste autorizadas.')
        for category, title, fields, notice in pages_for(person):
            name = f"{person['simulation']['firstName'].lower()}-{category}-simulacao.pdf"
            target = output / name
            doc = SimpleDocTemplate(str(target), pagesize=(210 * mm, 297 * mm),
                                    leftMargin=22 * mm, rightMargin=22 * mm,
                                    topMargin=23 * mm, bottomMargin=25 * mm,
                                    title=title + ' - SIMULAÇÃO', author='Massa de teste do app Hygor')
            rows = [[p(label, 'DossierLabel'), p(value)] for label, value in fields]
            table = Table(rows, colWidths=[51 * mm, 115 * mm], hAlign='LEFT')
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#edf3f5'), colors.white]),
                ('LINEBELOW', (0, 0), (-1, -1), .4, colors.HexColor('#d2dce2')),
            ]))
            story = [p('MARCELL | PRONTUÁRIO DE HOMOLOGAÇÃO', 'DossierLabel'), Spacer(1, 8 * mm),
                     p(title, 'DossierTitle'), p(person['name'], 'DossierLabel'), Spacer(1, 6 * mm),
                     table, Spacer(1, 7 * mm), p('SIMULAÇÃO - SEM VALIDADE', 'DossierNotice'),
                     p(notice), Spacer(1, 5 * mm), p('Arquivo vinculado somente ao ambiente isolado de testes. Nenhum envio a órgãos, bancos ou terceiros.')]
            def footer(canvas, document):
                canvas.saveState()
                canvas.setFillColor(colors.HexColor('#9c341f'))
                canvas.setFont('Helvetica-Bold', 9)
                canvas.drawString(22 * mm, 15 * mm, 'SIMULAÇÃO - SEM VALIDADE')
                canvas.setFillColor(colors.HexColor('#52646e'))
                canvas.setFont('Helvetica', 8)
                canvas.drawRightString(188 * mm, 15 * mm, f'{document.page} | QA - dados fictícios')
                canvas.restoreState()
            doc.build(story, onFirstPage=footer, onLaterPages=footer)
            sha = hashlib.sha256(target.read_bytes()).hexdigest()
            manifest.append({'employeeId': person['id'], 'category': category, 'fileName': name,
                             'documentId': str(uuid5(NAMESPACE_URL, f'hygor-simulation-v1/{person["id"]}/{category}')),
                             'sha256': sha, 'size': target.stat().st_size,
                             'issuedAt': person['simulation']['asoIssuedAt'] if category == 'aso' else person['startDate'],
                             'expiresAt': person['examExpiresAt'] if category in ('aso', 'training') else '',
                             'notes': 'SIMULAÇÃO - SEM VALIDADE. Dados e registros fictícios; nenhum documento oficial ou assinatura.'})
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'documents': len(manifest), 'bytes': sum(row['size'] for row in manifest)}))


if __name__ == '__main__':
    main()
