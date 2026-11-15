// Apenas as operações usadas pelos três repositórios locais do ERP.
// Nomes, keyPaths e versões físicas permanecem compatíveis com os bancos
// criados anteriormente pelo Dexie (versão declarada multiplicada por dez).
export const idbResult=request=>new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});

export function createLocalDatabase(name,version,upgrade){
  let connection=null,opening=null,generation=0;
  const open=()=>{
    if(connection)return Promise.resolve(connection);
    if(opening)return opening;
    const attempt=generation;
    opening=new Promise((resolve,reject)=>{
      let request,upgradeError,blocked=false;
      try{
        if(!globalThis.indexedDB)throw Error('O armazenamento local está indisponível neste navegador.');
        request=globalThis.indexedDB.open(name,version);
      }catch(error){reject(error);return;}
      const abort=error=>{upgradeError=error;request.transaction?.abort();};
      request.onupgradeneeded=event=>{try{upgrade(request.result,request.transaction,event.oldVersion,abort);}catch(error){abort(error);}};
      request.onblocked=()=>{blocked=true;reject(Error('Outra aba impede a atualização do armazenamento local. Feche a aba antiga e tente novamente.'));};
      request.onerror=()=>reject(upgradeError||request.error);
      request.onsuccess=()=>{
        const db=request.result;
        if(blocked||attempt!==generation){db.close();reject(Error('A abertura do armazenamento local foi interrompida. Tente novamente.'));return;}
        connection=db;
        db.onversionchange=()=>{db.close();if(connection===db){connection=null;opening=null;generation++;}};
        resolve(db);
      };
    }).catch(error=>{if(attempt===generation)opening=null;throw error;});
    return opening;
  };
  const close=()=>{generation++;connection?.close();connection=null;opening=null;};
  return {name,open,close,
    async delete(){close();await idbResult(globalThis.indexedDB.deleteDatabase(name));},
    async run(stores,mode,callback){
      const db=await open();
      return new Promise((resolve,reject)=>{
        let result,failure,transaction;
        try{transaction=db.transaction(stores,mode);}catch(error){reject(error);return;}
        transaction.oncomplete=()=>resolve(result);
        transaction.onabort=()=>reject(failure||transaction.error||Error('A operação de armazenamento local foi cancelada.'));
        // Callbacks só aguardam requisições IndexedDB desta transação. Não
        // aguardar rede/timers: o navegador encerraria a transação entre tarefas.
        try{
          Promise.resolve(callback(transaction)).then(value=>{result=value;},error=>{
            failure=error;try{transaction.abort();}catch{reject(error);}
          });
        }catch(error){failure=error;try{transaction.abort();}catch{reject(error);}}
      });
    },
  };
}

export function createStore(db,name,keyPath,indexes=[]){
  const store=db.createObjectStore(name,{keyPath});
  for(const key of indexes)store.createIndex(key,key,{unique:false});
  return store;
}
