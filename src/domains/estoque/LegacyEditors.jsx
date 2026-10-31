// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { Modal, Inp, Sel, Btn, Ic } from "../../legacy/ui.jsx";
import { CATS_MATERIAL } from "../compras/LegacySupport.jsx";
import { C } from "../../legacy/palette.js";
import { useBreakpoint } from "../../hooks/useBreakpoint";


export function ModalMaterial({ form, setForm, onSave, unidades = [] }) {
  const { formGrid } = useBreakpoint();
  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={form.id ? "Editar insumo" : "Novo insumo"} onClose={()=>setForm(null)} wide>
      <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
        <Inp label="Código automático" value={form.codigo} onChange={()=>{}} disabled/>
        <Inp label="Descrição *" value={form.descricao} onChange={F("descricao")}
             placeholder="Cimento CP-II 50kg"/>
        <Sel label="Unidade *" value={form.unidade} onChange={F("unidade")}
             options={unidades.map(u => ({ v:u.sigla, l:`${u.sigla} - ${u.nome}` }))}/>
        <Sel label="Categoria" value={form.categoria} onChange={F("categoria")}
             options={CATS_MATERIAL.map(c=>({v:c.v,l:c.l}))}/>
        <Inp label="Estoque mínimo" type="number" value={form.estoqueMin} onChange={F("estoqueMin")}
             placeholder="0"/>
        <Inp label="Preço médio (R$)" type="number" value={form.precoMedio} onChange={F("precoMedio")}
             placeholder="0,00"/>
        <div style={{gridColumn:"1/-1",display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setForm(null)} full>Cancelar</Btn>
          <Btn onClick={()=>onSave(form)} full><Ic n="check"/> Salvar</Btn>
        </div>
      </div>
    </Modal>
  );
}


export function ModalComposicao({ form, setForm, onSave, materiais, unidades = [] }) {
  const { formGrid } = useBreakpoint();
  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, campo, v) =>
    setForm(f => ({ ...f, itens: f.itens.map((x,k) => k===i ? {...x,[campo]:v} : x) }));
  const addItem = () => setForm(f => ({ ...f, itens:[...f.itens, {materialId:"",coef:""}] }));
  const delItem = (i) => setForm(f => ({ ...f, itens: f.itens.filter((_,k)=>k!==i) }));

  return (
    <Modal title={form.id ? "Editar composição" : "Nova composição"} onClose={()=>setForm(null)} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
          <Inp label="Código automático" value={form.codigo||""} onChange={()=>{}} disabled/>
          <Inp label="Serviço *" value={form.nome} onChange={F("nome")}
               placeholder="Alvenaria de vedação"/>
          <Sel label="Unidade *" value={form.unidade} onChange={F("unidade")}
               options={unidades.map(u => ({ v:u.sigla, l:`${u.sigla} - ${u.nome}` }))}/>
        </div>

        <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,lineHeight:1.5}}>
          Quanto cada insumo é consumido para executar <strong style={{color:C.text}}>
          1 {form.unidade || "unidade"}</strong> deste serviço.
        </p>

        {form.itens.map((it, i) => (
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,
                               borderRadius:6,padding:"9px 11px"}}>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
              <Sel label="Insumo" value={it.materialId} onChange={v=>setItem(i,"materialId",v)}
                   options={[{v:"",l:"Selecione..."}, ...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/>
              <Inp label={`Consumo por 1 ${form.unidade||"un"}`} type="number" value={it.coef}
                   onChange={v=>setItem(i,"coef",v)} placeholder="0,00"/>
            </div>
            {form.itens.length > 1 && (
              <button onClick={()=>delItem(i)} style={{background:"transparent",border:0,color:C.muted,
                fontSize:"var(--arcd-type-control)",cursor:"pointer",marginTop:6,textDecoration:"underline"}}>remover insumo</button>
            )}
          </div>
        ))}

        <Btn v="ghost" onClick={addItem} full><Ic n="plus"/> Adicionar insumo</Btn>

        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setForm(null)} full>Cancelar</Btn>
          <Btn onClick={()=>onSave(form)} full><Ic n="check"/> Salvar</Btn>
        </div>
      </div>
    </Modal>
  );
}
