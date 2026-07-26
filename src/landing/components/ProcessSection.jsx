const ETAPAS = [
  { numero: "01", titulo: "Entendimento", descricao: "Ouvimos as necessidades, o terreno e o orçamento para definir o escopo." },
  { numero: "02", titulo: "Projeto", descricao: "Arquitetura, estrutura e instalações desenvolvidas de forma compatibilizada." },
  { numero: "03", titulo: "Planejamento", descricao: "Cronograma, orçamento e fornecedores definidos antes do início da obra." },
  { numero: "04", titulo: "Execução", descricao: "Obra acompanhada tecnicamente, com controle de qualidade e prazo." },
  { numero: "05", titulo: "Entrega", descricao: "Vistoria final e entrega das chaves com o projeto plenamente executado." },
];

export default function ProcessSection() {
  return (
    <section id="processo" className="border-t border-border bg-background px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Como trabalhamos</h2>
          <p className="mt-3 text-muted-foreground">Um processo único, do primeiro contato à entrega das chaves.</p>
        </div>

        <ol className="mt-12 flex flex-col gap-8 lg:flex-row lg:gap-6">
          {ETAPAS.map((etapa, i) => (
            <li key={etapa.numero} className="relative flex-1 border-l border-border pl-6 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-6">
              <span className="absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary lg:-top-[9px] lg:left-0" aria-hidden="true"/>
              <span className="text-xs font-semibold text-primary">{etapa.numero}</span>
              <h3 className="mt-1 text-base font-semibold text-foreground">{etapa.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{etapa.descricao}</p>
              {i < ETAPAS.length - 1 && <span className="sr-only">Próxima etapa:</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
