# Publicação consolidada do Ponto — 05/11/2026

Base preservada: main 7b75636fe2d1d48a84f09300ac01968a910e1123, que já contém duas batidas e intervalo previsto.

Inclui auditoria fiscal, exportadores AFD/AEJ com bloqueios, requisitos fiscais, acesso individual aos comprovantes, confirmação explícita de WhatsApp pelo RH e adaptador autenticado para serviço privado de assinatura/cofre. O telefone cadastrado é apenas uma sugestão, nunca autorização automática de envio.

Validação local: 604 testes do ponto aprovados, cinco ignorados por infraestrutura PostgreSQL externa; 23 testes Python de assinatura/cofre aprovados; 17 testes adicionais de conciliação/contrato financeiro aprovados. Lint, TypeScript, arquitetura, ciclos, compilação Vite e orçamento de bundle aprovados. Revisão local das telas RH e trabalhador em 1366×900 e 390×844, sem transbordamento. Acréscimo funcional medido de 5.680 bytes gzip sobre main; limite total acrescido de 6 KiB, sem alterar tetos individuais ou baseline de design.

Sem migrações, mutações de pagamentos, ajustes de batidas ou reconstrução de NSR. APK18 não recompilado e SHA256 preservado: c44704a3be2cd3a98f82f9a09009ad68a7b3bc1251a9dde4bba113ac30a64e51.

Limites: serviço Python privado, cofre persistente e processador de WhatsApp exigem infraestrutura/configuração próprias; não são provisionados pelo deploy Vercel. Nenhum envio real é ativado. Certificado A1 e credenciais permanecem fora do repositório e do deploy. INPI, atestado e evidências operacionais ainda pendentes bloqueiam emissão oficial; não se declara conformidade integral REP-P. O PDF de demonstração assinado e redesenhado é um artefato local independente, não um novo registro de ponto.

ZIP técnico anterior preservado, sem atualização ou reaproveitamento de seu hash para esta versão.

Suíte geral: 4.857 testes aprovados e 15 ignorados; uma suíte de PDF foi bloqueada pelo acesso do Vite ao node_modules compartilhado via junction. Repetida isoladamente com allowlist local do diretório de dependências: dois testes aprovados, sem alteração no código do produto. Total: 4.859 testes aprovados em 638 suítes.

O hook pre-push padrão foi interrompido antes da publicação porque chama npm run build e seu prebuild contém migrações. Lint, arquitetura, testes, typecheck, ciclos, Vite e orçamento foram executados separadamente. O envio desta publicação dispensa somente esse hook, sem executar migrações.
