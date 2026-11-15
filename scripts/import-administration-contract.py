"""Importação local auditável da minuta. Nunca consulta IA nem publica arquivos.
Uso: python scripts/import-administration-contract.py caminho/Minuta.pdf
"""
import hashlib
import json
import re
import sys
from pathlib import Path
import pymupdf

pdf = Path(sys.argv[1])
doc = pymupdf.open(pdf)
nodes = []
for page_index, page in enumerate(doc):
    table = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            x0, y0, x1, y1 = line['bbox']
            if y0 < 100 or y1 > 770:
                continue
            text = ''.join(s['text'] for s in line['spans']).strip()
            text = re.sub(r'\s+', ' ', text)
            if not text:
                continue
            if page_index == 1 and y0 < 560:
                table.append((y0, x0, text))
                continue
            is_heading = text.startswith('C L Á U S U L A') or text in ['PA R T E S', 'C O N S I D E R A N D O S', 'A S S I N AT U R A S']
            is_start = bool(re.match(r'^(\d+\.\d+\.|\([iv]+\)|CONTRATANTE:|CONTRATADA:|CONTRATANTE e CONTRATADA|resolvem celebrar|E, por estarem|Caruaru/PE, ____|CONTRATADA$|CONTRATANTE$|Testemunhas$|Nome:)', text))
            kind = 'heading' if is_heading else 'paragraph'
            if page_index == 15:
                kind = 'signature' if not is_heading else kind
            if not nodes or is_heading or is_start or nodes[-1]['kind'] == 'heading' or (page_index == 15 and text.startswith(('MARCELL ', 'p. ', 'ASTROGILDO '))):
                nodes.append({'kind': kind, 'text': text, 'sourcePage': page_index + 1})
            else:
                nodes[-1]['text'] += ' ' + text
    if table:
        # A tabela original tem colunas e linhas sem bordas detectáveis.
        starts = sorted(set(round(y, 0) for y, x, t in table if x < 100))
        rows = []
        for start in starts:
            # Duas linhas de um mesmo termo pertencem à mesma célula.
            if rows and start - rows[-1][0] < 16:
                continue
            rows.append((start, []))
        for y, x, text in table:
            row = max((r for r in rows if r[0] <= round(y, 0)), key=lambda r: r[0])
            row[1].append((x, y, text))
        cells = []
        for _, row in rows:
            left = ' '.join(t for x, y, t in sorted(row, key=lambda z: z[1]) if x < 160)
            right = ' '.join(t for x, y, t in sorted(row, key=lambda z: z[1]) if x >= 160)
            cells.append([left, right])
        # Insere antes de 1.2, na mesma posição do original.
        idx = next(i for i, n in enumerate(nodes) if n['text'].startswith('1.2.'))
        nodes.insert(idx, {'kind': 'table', 'rows': cells, 'sourcePage': 2})

# A tabela dos anexos é transformada em células, sem mudar seu conteúdo.
for node in nodes:
    if node['text'].startswith('3.1.') if 'text' in node else False:
        text = node['text']
        idx = text.find(' ANEXO DOCUMENTO ')
        if idx >= 0:
            tail = text[idx + len(' ANEXO DOCUMENTO '):]
            node['text'] = text[:idx]
            annexes = re.findall(r'(I{1,3}|IV|V) (.*?)(?= (?:I{1,3}|IV|V) |$)', tail)
            nodes.insert(nodes.index(node) + 1, {'kind': 'table', 'rows': [['ANEXO', 'DOCUMENTO']] + [list(r) for r in annexes], 'sourcePage': 3})
            break

replacements = {}
def bind(old, key):
    if not old:
        raise ValueError('Origem vazia: ' + key)
    replacements[old] = '{{' + key + '}}'

body = '\n'.join(n.get('text', '') for n in nodes)
buyer = re.search(r'CONTRATANTE: (.*?)(?=\nCONTRATADA:)', body, re.S).group(1)
company = re.search(r'CONTRATADA: (.*?)(?=\nCONTRATANTE e CONTRATADA)', body, re.S).group(1)
bind(buyer, 'contratante.qualificacao')
bind(company, 'contratada.qualificacao')
name = buyer.split(',')[0]
document = re.search(r'CPF sob o nº ([\d.-]+)', buyer).group(1)
bind(name, 'contratante.nome')
bind(document, 'contratante.documento')
bind('MARCELL ENGENHARIA LTDA', 'contratada.razao_social')
bind('69.946.654/0001-09', 'contratada.cnpj')
bind('Hygor Marcell Freitas Lima', 'obra.responsavel_tecnico')
bind('46195-D', 'obra.crea')
bind('CREA-PE', 'obra.conselho')

consideration = re.search(r'\(i\) (.*?)(?=\n\(ii\))', body, re.S).group(1)
bind(consideration, 'obra.considerando')
obj = re.search(r'2\.1\. Objeto\. (.*?)(?=\n2\.2\.)', body, re.S).group(1)
bind(obj, 'obra.objeto')
bind(re.search(r'ART nº ([A-Z\d]+)', body).group(1), 'obra.art')
bind('Loteamento Terras Alpha Caruaru', 'obra.loteamento')
bind('Prefeitura de Caruaru', 'obra.prefeitura')
bind('Caruaru/PE', 'obra.cidade_uf')
bind('Caruaru', 'obra.cidade')
bind('Caruaru/PE, ____ de ______________ de 2026.', 'assinatura.local_data')
bind('Nome: ____________________ CPF: ______________ Nome: ____________________ CPF: ______________', 'assinatura.testemunhas')

commercial = {
 '12% (doze por cento)': ('comercial.taxa_administracao', 12),
 '5 (cinco) dias do recebimento': ('comercial.pagamento_dias', 5),
 'R$ 1.302.960,00 (um milhão, trezentos e dois mil, novecentos e sessenta reais)': ('comercial.cgr', 1302960),
 '325,74': ('obra.area_construida', None),
 'R$ 4.000,00/m²': ('comercial.valor_m2', 4000),
 'CUB/PE, projeto-padrão R-1, acrescido de fundações e de acabamento de primeira linha': ('comercial.referencia_cgr', 'CUB/PE, projeto-padrão R-1, acrescido de fundações e de acabamento de primeira linha'),
 'reajustado mensalmente pela variação do INCC-DI/FGV': ('comercial.atualizacao_cgr', 'reajustado mensalmente pela variação do INCC-DI/FGV'),
 'R$ 144.000,00 (cento e quarenta e quatro mil reais)': ('comercial.teto', 144000),
 'fixo e irreajustável, que não sofrerá correção monetária nem acompanhará o reajuste do CGR': ('comercial.atualizacao_teto', 'fixo e irreajustável, que não sofrerá correção monetária nem acompanhará o reajuste do CGR'),
 '75%': ('comercial.alerta_cgr', 75),
 '5% (cinco por cento)': ('comercial.retencao', 5),
 '10 (dez) dias da assinatura do Termo': ('comercial.liberacao_retencao_dias', 10),
 'dia 5 (cinco) de cada mês': ('comercial.pesquisa_dia', 5),
 '3 (três) empresas': ('comercial.cotacoes_equipamentos', 3),
 '2 (dois) meses consecutivos': ('comercial.pesquisa_validade_meses', 2),
 'dia 10 (dez) de cada mês': ('comercial.substituicao_dia', 10),
 'substituição em até 10 (dez) dias': ('comercial.substituicao_dias', 10),
 'mais de 7 (sete) dias': ('comercial.inatividade_dias', 7),
 '48 (quarenta e oito) horas': ('prazos.horas_comunicacao', 48),
 'dia 25 de cada mês': ('comercial.antecipacao_dia', 25),
 '1 (um) mês de Mão de Obra Própria': ('comercial.reserva_meses', 1),
 'mais de 20%': ('comercial.recomposicao_percentual', 20),
 '10 (dez) dias da prestação': ('comercial.devolucao_reserva_dias', 10),
 'dias 10 e 25 de cada mês': ('comercial.dias_prestacao', '10 e 25'),
 'cada 15 (quinze) dias': ('comercial.esclarecimentos_dias', 15),
 '15 (quinze) dias úteis do relatório': ('comercial.impugnacao_dias_uteis', 15),
 'R$ 5.000,00': ('comercial.limite_cotacoes', 5000),
 '3 (três) cotações': ('comercial.cotacoes_compras', 3),
 '5 (cinco) dias úteis para indicar': ('comercial.alternativa_dias_uteis', 5),
 '14 (quatorze) meses': ('prazos.meses_execucao', 14),
 '2 (dois) meses sem penalidade': ('prazos.meses_tolerancia', 2),
 '16º (décimo sexto) mês': ('prazos.mes_multa', None),
 '0,4% (quatro décimos por cento)': ('prazos.multa_atraso', 0.4),
 '10% (dez por cento) do CGR': ('prazos.limite_multa', 10),
 '24º (vigésimo quarto) mês': ('prazos.mes_resolucao', 24),
 '4 (quatro) marcos': ('prazos.quantidade_marcos', 4),
 'recuperação em até 10 (dez) dias': ('prazos.recuperacao_dias', 10),
 '30 (trinta) dias de antecedência': ('prazos.sucessao_dias', 30),
 '5 (cinco) dias úteis da solicitação': ('prazos.aprovacao_dias_uteis', 5),
 '15 (quinze) dias da assinatura': ('prazos.contador_dias', 15),
 '30 (trinta) dias úteis': ('prazos.recebimento_dias_uteis', 30),
 '15 (quinze) dias da solicitação': ('prazos.seguro_dias', 15),
 '1% (um por cento)': ('prazos.juros_mora', 1),
 '2% (dois por cento)': ('prazos.multa_mora', 2),
 'superior a 7 (sete) dias': ('prazos.suspensao_dias', 7),
 'mais de 15 (quinze) dias': ('prazos.desmobilizacao_dias', 15),
 '15 (quinze) dias de antecedência': ('prazos.resilicao_dias', 15),
 '10% (dez por cento) sobre o saldo': ('prazos.multa_resilicao', 10),
 'mais de 30 (trinta) dias': ('prazos.abandono_dias', 30),
 '15 (quinze) dias úteis da notificação': ('prazos.saneamento_dias_uteis', 15),
 '5 (cinco) anos': ('prazos.sigilo_anos', 5),
 '90 (noventa) dias': ('prazos.acesso_erp_dias', 90),
 'frustrada esta em 30 (trinta) dias': ('prazos.negociacao_dias', 30),
}
defaults = {}
formats = {}
for old, (key, default) in commercial.items():
    bind(old, key)
    if default is not None:
        defaults[key] = default
    # O formato contém os complementos originais, não apenas o número.
    formats[key] = old

# Canais corporativos também pertencem ao cadastro central, não ao texto protegido.
bind('(81) 98975-1300', 'contratada.telefone_financeiro')
bind('(81) 99525-4340', 'contratada.telefone_engenharia')
bind('(81) 99572-5927', 'contratada.telefone_compras')
original = json.dumps(nodes, ensure_ascii=False, sort_keys=True)
def transform(value):
    if isinstance(value, str):
        # Uma única passagem evita substituir partes de variáveis já inseridas.
        pattern = '|'.join(re.escape(k) for k in sorted(replacements, key=len, reverse=True))
        return re.sub(pattern, lambda m: replacements[m.group()], value)
    if isinstance(value, list): return [transform(v) for v in value]
    if isinstance(value, dict): return {k: transform(v) for k,v in value.items()}
    return value
result = transform(nodes)
inverse = {v:k for k,v in replacements.items()}
restored = json.dumps(result, ensure_ascii=False, sort_keys=True)
restored = re.sub(r'\{\{[^}]+\}\}', lambda m: inverse[m.group()], restored)
assert restored == original, 'A parametrização alterou o texto protegido'
assert name not in json.dumps(result, ensure_ascii=False)
assert document not in json.dumps(result, ensure_ascii=False)
# Duas testemunhas independentes: a conversão foi conferida antes de introduzir
# os campos, e o texto original de cada linha é verificado explicitamente.
witnesses = [n for n in result if n.get('text') == 'Nome: ____________________ CPF: ______________']
assert len(witnesses) == 2, 'Confira os campos de testemunhas do original'
for index, node in enumerate(witnesses):
    node['text'] = '{{assinatura.testemunha_' + str(index) + '}}'
# Coincidência de nome ou valor no original não torna os conceitos iguais.
for node in result:
    if node.get('sourcePage') == 16 and node.get('text', '').startswith('p. '):
        assert node['text'] == 'p. {{obra.responsavel_tecnico}}'
        node['text'] = 'p. {{contratada.representante_nome}}'
    if node.get('text', '').startswith('8.6.'):
        assert '{{prazos.horas_comunicacao}}' in node['text']
        node['text'] = node['text'].replace('{{prazos.horas_comunicacao}}','{{comercial.manutencao_horas}}')
defaults['comercial.manutencao_horas'] = 48
formats['comercial.manutencao_horas'] = '48 (quarenta e oito) horas'
target = Path('src/domains/comercial/contracts/administration-template.json')
target.parent.mkdir(parents=True, exist_ok=True)
payload = {'id':'administracao-custo-v1','name':'Contrato de Administração de Obra por Preço de Custo','version':1,'status':'em_revisao','sourceSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'sourcePages':len(doc),'nodes':result,'suggestions':defaults,'formats':formats,'importVerification':{'roundTripExact':True,'witnessFieldsChecked':2,'normalizedSourceSha256':hashlib.sha256(original.encode()).hexdigest(),'nodes':len(nodes)},'variables':sorted(set(re.findall(r'\{\{([^}]+)\}\}',json.dumps(result))))}
target.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n',encoding='utf8')
metadata = {key:payload[key] for key in ['id','name','version','sourceSha256','suggestions']}
target.with_name('administration-record-meta.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'target':str(target),'variables':len(payload['variables']),'nodes':len(nodes),'roundTripExact':True}))
