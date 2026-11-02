export const buttonRole=variant=>({default:'primary',primary:'primary',success:'primary',info:'primary',dark:'primary',outline:'secondary',secondary:'secondary',warning:'secondary',ghost:'quiet',quiet:'quiet',link:'quiet',danger:'destructive',destructive:'destructive'}[variant]||'primary');
export const legacyButtonRole=variant=>variant==='ghost'?'secondary':buttonRole(variant);
export const buttonSize=size=>({default:'md',md:'md',sm:'sm',lg:'lg',icon:'icon'}[size]||'md');
