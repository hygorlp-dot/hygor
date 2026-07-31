# Uppy

## Problema

Uploads móveis precisam retomar, mostrar miniaturas e tratar falhas.

## Alternativas

Controle de upload existente, mantendo o contrato atual até haver backend de
uploads assinados.

## Versão analisada, licença e compatibilidade

`@uppy/react` 5.2.0, MIT, é compatível com React 18 e oferece componentes
headless e hooks. O upload retomável do ecossistema usa `@uppy/tus`, que exige
integração Tus no cliente e no servidor.

## Bundle e segurança

O runtime adicional e plugins opcionais não resolveriam o gargalo atual: o
servidor OneDrive recebe um único `dataUrl` comprimido, limita o corpo a 8 MB e o
arquivo a 6 MB. URLs assinadas, upload multipart/resumível e política de EXIF não
existem ainda.

## POC e testes

Foram auditados os controles atuais de câmera/galeria das conferências. Eles já
limitam tipo, tamanho, orientação e compressão, mas não repetiam falhas de rede.
Foi implementado `uploadWithRetry`, com três tentativas idempotentes para 408,
429 e erros 5xx/rede, reaproveitando o mesmo nome de arquivo no OneDrive. Falhas
de autorização e tamanho não são repetidas. Três testes cobrem sucesso após
indisponibilidade, bloqueio de erro definitivo e classificação de rede.

## Riscos, decisão e rollback

**Substituir por solução interna nesta etapa.** Uppy não foi instalado. A próxima
etapa, se necessária, é criar endpoint de upload resumível/URLs assinadas no
servidor; só então uma POC de `@uppy/tus` poderá ser segura. Rollback remove o
adaptador local de retry, sem contrato externo nem dados pendentes.
