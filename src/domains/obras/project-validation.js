const numberOf=value=>Number(value||0);
const integerIn=(value,min,max)=>Number.isInteger(numberOf(value))&&numberOf(value)>=min&&numberOf(value)<=max;

export const validateProjectForm=(project={},options={})=>{
  const errors={};
  const required=options.requireComplete!==false;
  const contractValue=numberOf(project.contractValue);
  const entry=numberOf(project.entrada);
  const installments=numberOf(project.totalParcelas);
  const admin=numberOf(project.adminPercentage);
  if(!String(project.name||"").trim())errors.name="Informe o nome da obra.";
  if(numberOf(project.areaM2)<0)errors.areaM2="A área não pode ser negativa.";
  if(required&&!String(project.contractStart||"").trim())errors.contractStart="Informe o início do contrato.";
  if(project.contractStart&&project.contractEnd&&project.contractEnd<project.contractStart)errors.contractEnd="O fim previsto deve ser posterior ao início do contrato.";
  if(contractValue<0)errors.contractValue="O valor do contrato não pode ser negativo.";
  if(entry<0)errors.entrada="A entrada não pode ser negativa.";
  if(contractValue>0&&entry>contractValue)errors.entrada="A entrada não pode superar o valor do contrato.";
  if(["admin_only","fixed_labor_admin"].includes(project.contractType)){
    if(!(admin>0&&admin<=100))errors.adminPercentage="Informe um percentual entre 0,01% e 100%.";
    const bases=[project.adminBaseMateriais!==false,project.adminBaseMaoDeObra===true||(project.adminBaseMaoDeObra===undefined&&project.contractType==="admin_only"),project.adminBaseTerceirizados!==false];
    if(!bases.some(Boolean))errors.adminBases="Selecione ao menos uma base para a administração.";
  }
  if(required&&!(installments>0&&Number.isInteger(installments)))errors.totalParcelas="Informe uma quantidade inteira de parcelas maior que zero.";
  else if(installments<0||!Number.isInteger(installments))errors.totalParcelas="A quantidade de parcelas deve ser um número inteiro.";
  if((required||project.diaVenc1!==undefined)&&!integerIn(project.diaVenc1,1,31))errors.diaVenc1="Escolha um vencimento entre os dias 1 e 31.";
  if(project.billingFrequency==="quinzenal"){
    if((required||project.diaVenc2!==undefined)&&!integerIn(project.diaVenc2,1,31))errors.diaVenc2="Escolha o segundo vencimento entre os dias 1 e 31.";
    else if(String(project.diaVenc1)===String(project.diaVenc2))errors.diaVenc2="Os dois vencimentos quinzenais devem ser diferentes.";
  }
  if(entry>0&&!project.entradaDate)errors.entradaDate="Informe a data prevista para a entrada.";
  if(project.entradaDate&&entry<=0)errors.entrada="Informe o valor da entrada ou remova a data.";
  return errors;
};

export const projectAlertAction=alert=>{
  const text=String(alert||"").toLocaleLowerCase("pt-BR");
  if(text.includes("engenheiro"))return {label:"Definir engenheiro",field:"engineerId"};
  if(text.includes("cliente"))return {label:"Vincular cliente",field:"clienteId"};
  if(text.includes("endereço"))return {label:"Completar endereço",field:"address"};
  if(text.includes("prazo")||text.includes("vencido"))return {label:"Revisar prazo",field:"contractEnd"};
  if(text.includes("contrato"))return {label:"Revisar contrato",field:"contractValue"};
  return {label:"Revisar cadastro",field:"name"};
};
