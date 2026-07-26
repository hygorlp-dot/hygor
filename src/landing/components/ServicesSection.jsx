import { PencilRuler, Sofa, Building2, Hammer, ClipboardCheck, Users2, Layers } from "lucide-react";

const SERVICOS = [
  { icon: PencilRuler, titulo: "Projeto arquitetônico", descricao: "Concepção e desenvolvimento do projeto, do estudo preliminar ao executivo." },
  { icon: Sofa, titulo: "Interiores", descricao: "Ambientes projetados com identidade, conforto e funcionalidade." },
  { icon: Building2, titulo: "Construção completa", descricao: "Execução integral da obra, do primeiro traço à entrega das chaves." },
  { icon: Hammer, titulo: "Reformas", descricao: "Retrofit e reformas com o mesmo rigor técnico de uma obra nova." },
  { icon: ClipboardCheck, titulo: "Acompanhamento técnico", descricao: "Fiscalização e suporte técnico durante toda a execução." },
  { icon: Users2, titulo: "Gestão de obras", descricao: "Planejamento, cronograma e controle de equipe e fornecedores." },
  { icon: Layers, titulo: "Compatibilização de projetos", descricao: "Integração entre arquitetura, estrutura e instalações antes da obra começar." },
];

export default function ServicesSection() {
  return (
    <section id="servicos" className="border-t border-border bg-card px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Serviços</h2>
          <p className="mt-3 text-muted-foreground">Um único time acompanha o projeto do desenho à execução.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map(({ icon: Icon, titulo, descricao }) => (
            <div key={titulo} className="rounded-lg border border-border bg-background p-6">
              <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} aria-hidden="true"/>
              <h3 className="mt-4 text-base font-semibold text-foreground">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
