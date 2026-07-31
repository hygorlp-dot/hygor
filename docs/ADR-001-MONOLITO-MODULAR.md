# ADR-001 — Monólito modular antes de serviços distribuídos

- Status: aceito
- Data: 23/07/2026

## Contexto

O ARCD possui muitos módulos, mas uma operação empresarial, uma implantação Vercel e mudanças transacionais coordenadas. O maior arquivo de interface e o documento empresarial amplo dificultam manutenção, testes e builds.

## Decisão

Manter uma implantação única e separar internamente o sistema por domínios, comandos, consultas, políticas e repositórios. Extrair dados relacionais começando pelo livro financeiro e Compras. Adiar microserviços até existir evidência operacional.

## Consequências

Positivas:

- migração incremental e reversível;
- menor complexidade operacional;
- transações e auditoria mais simples;
- ganhos imediatos de bundle, teste e ownership.

Negativas:

- exige disciplina contra importações internas entre features;
- snapshot e tabelas coexistirão temporariamente;
- o processo ainda compartilha recursos de implantação.

## Revisão da decisão

Reavaliar quando um domínio precisar de escala independente, equipes forem bloqueadas pelo mesmo deploy, o build continuar excessivo após code splitting, houver necessidade comprovada de fila durável ou for exigido isolamento físico.

