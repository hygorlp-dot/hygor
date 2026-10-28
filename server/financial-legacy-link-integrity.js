export const findStaleFinancialLegacyLinks=async({
  sql,
  companyId,
  facts=[],
}={})=>{
  if(typeof sql!=="function")throw new TypeError("Conexão PostgreSQL obrigatória para validar hashes legados.");
  const rows=await sql`
    with incoming as (
      select value as fact
        from jsonb_array_elements(${sql.json(Array.isArray(facts)?facts:[])}::jsonb)
    )
    select
      link.legacy_type,
      link.legacy_id,
      link.record_hash as stored_hash,
      md5(incoming.fact::text) as current_hash
    from incoming
    join legacy_record_links link
      on link.company_id=${String(companyId||"")}
     and link.legacy_type=incoming.fact->>'legacyType'
     and link.legacy_id=incoming.fact->>'legacyId'
    where link.record_hash is distinct from md5(incoming.fact::text)
    order by link.legacy_type,link.legacy_id
  `;
  return rows.map(row=>({
    legacyType:String(row.legacy_type||""),
    legacyId:String(row.legacy_id||""),
    storedHash:String(row.stored_hash||""),
    currentHash:String(row.current_hash||""),
  }));
};
