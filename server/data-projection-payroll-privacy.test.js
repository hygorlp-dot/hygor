import {describe,expect,it} from 'vitest';
import {projectDataForUser} from './data-projection.js';

const employee={id:'e',obra:'w',name:'Equipe local',role:'Pedreiro',
  monthlySalary:3000,meiMonthlyValue:4500,meiCnpj:'12345678000195',
  cltPayroll:{profile:{salary:3000,cpf:'52998224725'},drafts:{'2026-10':{net:2900}}},
  remunerationHistory:[{date:'2026-01-01',mode:'clt',monthlySalary:3000}],
  payModeDecisions:[{period:'2026-10',salary:3000}],
  paymentInstructions:'Banco privado, agência e conta',
};
const data={obras:[{id:'w',name:'Obra'}],usuarios:[],employees:[employee],titulosFolha:[{id:'title',obraId:'w',amount:2900}]};
describe('campos atuais de remuneração respeitam a fronteira de RH',()=>{
  it.each(['engenheiro','engenheiro_auditor','financeiro'])('não entrega salário, contrato MEI ou holerites ao perfil %s',role=>{
    const result=projectDataForUser(data,{id:'u',role,obraId:'w'});
    expect(result.employees[0]).toMatchObject({id:'e',name:'Equipe local'});
    for(const field of ['monthlySalary','meiMonthlyValue','meiCnpj','cltPayroll','remunerationHistory','payModeDecisions','paymentInstructions'])expect(result.employees[0]).not.toHaveProperty(field);
    expect(employee.monthlySalary).toBe(3000);
    if(role==='financeiro')expect(result.titulosFolha).toEqual(data.titulosFolha);
  });
  it.each(['rh','admin'])('preserva o cadastro completo para %s',role=>{
    expect(projectDataForUser(data,{id:'u',role,obraId:'w'}).employees[0]).toEqual(employee);
  });
});
