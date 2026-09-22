# Memorial item a item

O formulário acompanha o ID do item do orçamento, inclusive após reordenação.
O modelo é escolhido por serviço principal, unidade e contexto da etapa.
Uma descrição que apenas menciona um material ou processo não deve definir
o cálculo: portas para pintura continuam sendo contadas; porcelanato em etapa
de piso continua sendo medido em área mesmo se excluir emboço na descrição.

## Modelos e critérios

| Serviço | Medição oferecida |
|---|---|
| Alvenaria e tapumes | Comprimento × altura; linhas separadas para vãos |
| Revestimentos e pintura de parede | Comprimento × altura × faces; descontos separados |
| Pisos, tetos, forros, grama, limpeza | Comprimento × largura por ambiente |
| Sancas em m² | Comprimento × largura desenvolvida |
| Lastros em m³ | Comprimento × largura × espessura em cm ÷ 100 |
| Escavação e volumes | Comprimento × largura × profundidade |
| Rodapés, gabaritos, trechos | Comprimento por trecho, com descontos |
| Vergas e contravergas | Largura do vão + apoios definidos pelo projeto |
| Contramarcos fechados | 2 × (largura + altura); outros contornos usam trechos |
| Portas, equipamentos, unidades | Contagem por local |
| Levantamento externo / unidade especial | Quantidade diretamente medida com origem obrigatória |

São modelos geométricos, não substitutos dos critérios específicos da composição
ou do projeto. A CAIXA mantém a documentação técnica para o uso adequado das
referências [SINAPI](https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx).
O sistema não presume apoios, perdas, empolamento ou conversões entre unidades.
Demãos mencionadas na descrição não multiplicam automaticamente a superfície.

## Persistência e compatibilidade

- `item.memorialMedicao`: modelo, unidade, assinatura da composição, locais,
  valores, origem e observações; `active` indica cálculo aplicado.
- Valor vazio é ausente; zero informado é válido. Valores negativos, descontos
  excessivos, frações de peças e unidades incompatíveis impedem aplicação.
- Rascunhos preservam a quantidade anterior. Salvar cálculo válido substitui
  a quantidade e passa pelo salvamento normal, totais e desfazer do orçamento.
- Alterar composição suspende reaplicação até revalidar o memorial.
- Vínculos estruturais e disciplinas existentes são preservados.
- Modelos reutilizáveis ficam em `budget.modelosMemorial`, disponíveis entre
  os orçamentos acessíveis. Correspondência exige composição e unidade iguais.
  Não armazenam dimensões, locais ou dados privados do levantamento.
- Cópias com quantitativos zerados preservam apenas o modelo, sem medições.

## Cobertura duplicada por cópia

Uma recuperação explícita aparece quando há um pavimento padrão com medidas
e uma única cópia homônima, sem medidas nem origem importada, com vínculos
herdados e sem conflitos. A ação unifica os cadastros, conserva etapa e nível,
remapeia vínculos válidos e aplica as medidas existentes. Não unifica pavimentos
com levantamentos independentes. O salvamento pode ser desfeito.

## Validação

Testes de geometria, unidades, rascunhos, vínculo estável, proteção de disciplinas,
composição alterada, cópia zerada, modelos reutilizáveis, salvamento e falha de rede.
Inspeção visual em 1440 px e 390 px, sem transbordamento horizontal.
