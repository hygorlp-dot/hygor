# Ponto de Obra — dados faciais: onde estão, quem acessa, como saem

Levantamento do comportamento **atual** do código (out/2026, rodada de
estabilização). Não define política: onde há decisão a tomar, está marcado
**REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO**. Nenhum prazo de retenção foi
inventado aqui.

Termo exibido ao funcionário no cadastro: `TERMO_TEXTO`, versão
`TERMO_VERSAO = "2026-10"` em `src/telas/TelaEncarregado.js` (não alterado
nesta rodada).

## Os três dados

| | 1. Vetor biométrico (cadastro) | 2. Foto do cadastro facial | 3. Foto da batida (prova) |
|---|---|---|---|
| **O que é** | 192 números (MobileFaceNet) — média de 3 capturas | 1 JPEG do rosto de frente | 1 JPEG tirado no momento da batida (facial ou pelo encarregado) |
| **Gerado onde** | No aparelho, modo Encarregado → Cadastrar rosto | No aparelho, mesma tela | No aparelho, a cada batida |
| **Enviado quando** | Na hora do cadastro (`ponto-cadastrar-biometria`, exige internet) | Junto com o vetor | Depois que a batida é aceita pelo servidor (`ponto-enviar-foto`), na sincronização |
| **Servidor** | Tabela `ponto_biometrias.vetor` (Supabase) | Storage privado `ponto-obra`, `biometria/<funcionário>/<id>-1.jpg`; caminho e SHA-256 em `ponto_biometrias.fotos` | Storage privado `ponto-obra`, `marcacoes/<obra>/<data>/<marcação>.jpg`; SHA-256 dentro da marcação (`ponto_marcacoes.foto_sha256`), que entra no hash encadeado |
| **No aparelho** | Desde 01/10/2026 (funcionário global), copiado para **todos os aparelhos da empresa**, de todas as obras, e guardado no banco local cifrado (SQLCipher, `estado.cadastro`). Só desce quando o conjunto muda (`biometriasAssinatura`) | Arquivo temporário apagado logo após a leitura | Arquivo JPEG na pasta de documentos do app (**fora** do SQLCipher; protegido só pelo sandbox do Android) até o upload; apagado depois do OK do servidor |
| **Quem acessa (ARCD)** | Nenhuma tela mostra o vetor. `ponto-biometria-status` devolve só data/qualidade/quem cadastrou (perfis admin, rh, engenheiro, engenheiro_auditor, financeiro) | Nenhuma ação da API serve essa foto; só acesso direto ao Supabase (service role) | Perfis admin, rh, engenheiro, engenheiro_auditor, financeiro, por link assinado de 5 min (`ponto-foto-url`) |
| **Quem acessa (aparelho)** | **Qualquer aparelho ativo da empresa** recebe os vetores de **todos** os funcionários ativos (o funcionário pode bater em qualquer obra). Aparelho revogado para de sincronizar | — | — |
| **Exclusão hoje** | ARCD → Ponto eletrônico (app) → excluir biometria (`ponto-biometria-excluir`, perfis admin, rh, engenheiro): apaga **todas** as linhas do funcionário em `ponto_biometrias`. Os aparelhos deixam de ter o vetor na próxima sincronização do cadastro (até 5 min com internet; aparelho offline mantém até sincronizar) | **Não é apagada.** A exclusão da biometria remove a linha da tabela, mas **não** remove o arquivo do Storage — o arquivo fica órfão | **Não há exclusão.** Marcação é append-only (Portaria 671/2021) e o hash da foto faz parte da cadeia |
| **Desligamento** | Linha **continua** no banco; o servidor para de mandar o vetor (só vão os de funcionários **ativos**) e ele sai dos aparelhos na sincronização seguinte. **Mudar de obra não muda nada** (a biometria é global) | Continua no Storage | Continua no Storage |

Consentimento: gravado em `ponto_biometrias.consentimento` (versão do termo,
data/hora do aceite, SHA-256 do texto) — e **apagado junto** com a biometria
na exclusão.

Também ficam no aparelho:
- **Bancos arquivados** (`ponto-obra.<motivo>.<data>.db`), criados ao parear
  o aparelho de novo ou ao recuperar um banco ilegível. Eles guardam o
  cadastro com os vetores daquela época. Hoje **não há rotina de limpeza**.
- Capturas cruas da câmera e recortes do rosto: a partir desta rodada são
  apagados logo após o uso. Antes ficavam no cache do app até o Android
  limpar.

## Mudança de 01/10/2026: biometria global da empresa

Os funcionários trocam de obra no mesmo dia, então o vetor biométrico de cada
funcionário ativo agora fica em **todos** os aparelhos da empresa, e não só
nos da obra de lotação. Proteções mantidas:
- banco local cifrado (SQLCipher) com a chave no SecureStore;
- **só o vetor** vai para os aparelhos; as fotos de cadastro ficam no Storage
  privado do servidor;
- nenhum vetor em log (teste trava `console.*` no app) nem no diagnóstico;
- aparelho revogado não sincroniza mais;
- exclusão da biometria (LGPD) e desligamento: o vetor sai de todos os
  aparelhos na sincronização seguinte. Aparelho **offline** mantém a cópia
  cifrada até sincronizar.

Isso amplia o número de aparelhos que guardam o vetor de cada pessoa.
**REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO:** o termo de consentimento deve
mencionar que o código biométrico fica nos aparelhos de **todas** as obras da
empresa?

## Conflitos ou possíveis conflitos com o termo atual

Trechos do termo entre aspas; comportamento atual ao lado.

1. **"O código e as fotos ... serão apagados quando eu deixar a empresa"** —
   nada é apagado automaticamente no desligamento. O vetor e a foto do
   cadastro ficam no servidor; só deixam de ir para os aparelhos.
   **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO:** apagar de forma automática no
   desligamento, por rotina periódica ou de outro jeito; e se o termo muda.
2. **"... ou se eu pedir. Posso pedir a exclusão a qualquer momento"** — a
   exclusão pelo ARCD apaga o vetor, mas **não apaga a foto do cadastro no
   Storage**. Corrigir isso é técnico (apagar os arquivos de
   `ponto_biometrias.fotos` na mesma ação), mas toca em retenção.
   **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO** antes de implementar.
3. **"as fotos ... serão apagados"** × **foto da batida** — a foto
   probatória de cada batida é guardada sem exclusão, porque a marcação é
   imutável e o hash da foto está na cadeia. O termo não distingue foto de
   cadastro de foto de batida. **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO:**
   o termo deve informar a foto da batida e seu prazo de guarda? Qual prazo?
4. **"nesse caso meu ponto passa a ser registrado pelo encarregado"** — o
   registro pelo encarregado **também tira foto** do funcionário (prova de
   quem estava presente). Quem pediu a exclusão continua tendo o rosto
   fotografado a cada batida. **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO.**
5. **Prova do consentimento** — a exclusão apaga também o registro do aceite
   (versão, data, hash do texto). **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO:**
   o registro do consentimento (e da revogação) deve ser mantido depois da
   exclusão do dado biométrico?
6. **"não são compartilhados com terceiros"** — os dados ficam em
   fornecedores de infraestrutura (Supabase para banco e arquivos, Vercel para
   a API) e o vetor é copiado para os aparelhos da obra.
   **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO** sobre como o termo trata
   operadores e aparelhos.
7. **Bancos arquivados no aparelho** mantêm vetores antigos sem prazo.
   **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO** sobre a retenção; a limpeza em
   si é técnica.
8. **Prazo de guarda das marcações e das fotos de batida** — o código guarda
   por tempo indeterminado. **REQUER DECISÃO DO RESPONSÁVEL/JURÍDICO**
   (prazo legal aplicável e o que fazer depois).

Qualquer mudança no texto do termo exige nova `TERMO_VERSAO`. O SHA-256 do
texto vai junto com cada cadastro, então cadastros antigos continuam
apontando para o texto que o funcionário aceitou.
