import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.jsx";

function TabRow({ disabled = false }) {
  return <Tabs defaultValue="visao"><TabsList><TabsTrigger value="visao">Visão geral</TabsTrigger><TabsTrigger value="custos" disabled={disabled}>Custos</TabsTrigger><TabsTrigger value="documentos">Documentos</TabsTrigger></TabsList><TabsContent value="visao">Resumo da obra.</TabsContent><TabsContent value="custos">Custos da obra.</TabsContent><TabsContent value="documentos">Documentos da obra.</TabsContent></Tabs>;
}
export default { title: "Navegação/TabRow", component: TabRow, tags: ["autodocs"] };
export const Default = {};
export const WithDisabledItem = { args: { disabled: true } };
