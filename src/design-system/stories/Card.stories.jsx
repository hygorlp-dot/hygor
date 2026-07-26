import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.jsx";

function ProjectCard() { return <Card className="max-w-md"><CardHeader><CardTitle>Obra B2-04</CardTitle><CardDescription>Atualização semanal disponível.</CardDescription></CardHeader><CardContent>Prazo, custo e decisões em um único lugar.</CardContent></Card>; }
export default { title: "Padrões/Card", component: ProjectCard, tags: ["autodocs"] };
export const Default = {};
