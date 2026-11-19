# Portal — tema MARCELL Vidro

Revisão: 14/11/2026. Implementação e validação locais.

O tema solicitado usa vidro fosco claro sobre uma residência contemporânea ao entardecer. A transparência do painel principal foi ampliada a pedido do usuário: opacidade de 68%, contra os 84% da primeira composição. Cartões e campos passaram de 84% para 76% para apoiar a leitura dos valores. O efeito pertence à base compartilhada, com cores e material em `src/design-system/themes/themeRegistry.js`, receita em `material.css`, escala e controles MARCELL preservados.

O portal aplica o tema na entrada, no carregamento e na área autenticada, sem substituir a preferência de tema do ERP. A imagem é apenas ambientação: não representa a obra do cliente e não altera ou substitui fotos dos diários. A ajuda explica essa distinção. Não há alteração de valores, cálculos, permissões ou gravações financeiras; impacto adicional no DRE: nenhum.

O painel usa desfoque de 18 px. Navegadores sem suporte a desfoque e a preferência de reduzir transparência recebem superfície sólida. Impressão remove a fotografia e a transparência. Texto primário, secundário e auxiliar do painel são conferidos também contra fundos preto e branco, com contraste mínimo de 4,5:1. A fotografia não é reduzida pela opacidade dos controles nem dos textos.

## Imagem de ambientação

Arquivo utilizado: `public/brand/marcell/portal-residencia.webp`, 246.688 bytes. Imagem fictícia criada com a ferramenta integrada image_gen; original preservado na pasta de imagens geradas do Codex. O WebP é uma cópia otimizada para o projeto. Nenhuma imagem do anúncio de referência foi copiada.

Prompt final usado:

> Create a photorealistic architectural photograph intended as the full-screen background of a high-end Brazilian construction client portal. A luxurious contemporary two-story residence in Brazil, broad horizontal cantilevered volumes, warm limestone and natural timber louvers, floor-to-ceiling glass with subtle warm interior light, understated pool and elegant tropical landscaping. Early blue hour, soft natural cinematic light, refined neutral stone palette, muted navy sky and warm amber interior accents. Wide architectural editorial photography, realistic materials and restrained sophistication, no people, no vehicles, no text, no logos, no watermarks, no UI. Landscape 16:9 composition. House facade remains recognizable across the central and right parts; clean calm areas and restrained contrast to work behind translucent frosted glass interface panels. This is a decorative fictional architecture image, not documentation of an actual client project.

## Conferência

Capturas de login, início, diário e compras ficam em `artifacts/client-portal-*.png`. A suíte do navegador inclui computador, celular, orientação vertical/horizontal das fotos e preservação da preferência de tema do ERP. Os testes do tema verificam contratos semânticos, contraste de superfícies translúcidas e a aplicação do tema do portal sem gravar outra preferência do ERP.


Resultado local: seis cenários Playwright aprovados, 31 testes do portal/temas aprovados, TypeScript, manual e build aprovados. Detector Impeccable sem ocorrências no portal e material compartilhado. O lint global interrompeu em três ocorrências de plural entre parênteses no arquivo local src/features/conciliacao/BankImportReversal.jsx, fora do escopo do tema; a baseline não foi alterada e o arquivo de Conciliação foi preservado. O build mantém os avisos de ExcelJS/fs e chunk grande existentes.
