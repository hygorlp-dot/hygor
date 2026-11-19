"""Credenciais locais do financeiro. Entrada/saída por pipe; nunca por argv/log."""
import sys,os,ctypes,json,urllib.request,urllib.parse
from pathlib import Path
from ctypes import wintypes

def dpapi(raw,decrypt=False):
 if os.name!='nt':raise ValueError('WINDOWS_REQUIRED')
 class Blob(ctypes.Structure):_fields_=[('cbData',wintypes.DWORD),('pbData',ctypes.POINTER(ctypes.c_ubyte))]
 def make(value):
  buf=ctypes.create_string_buffer(value);return buf,Blob(len(value),ctypes.cast(buf,ctypes.POINTER(ctypes.c_ubyte)))
 srcbuf,src=make(raw);entbuf,entropy=make(b'MARCELL-client-billing-local-v1');out=Blob()
 lib=ctypes.WinDLL('crypt32',use_last_error=True);kernel=ctypes.WinDLL('kernel32');kernel.LocalFree.argtypes=[ctypes.c_void_p]
 fn=lib.CryptUnprotectData if decrypt else lib.CryptProtectData
 fn.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p if decrypt else ctypes.c_wchar_p,ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)];fn.restype=wintypes.BOOL
 try:
  if not fn(ctypes.byref(src),None if decrypt else 'MARCELL financeiro local',ctypes.byref(entropy),None,None,1,ctypes.byref(out)):raise ValueError('DPAPI_FAILED')
  return ctypes.string_at(out.pbData,out.cbData)
 finally:
  ctypes.memset(srcbuf,0,len(srcbuf))
  if out.pbData:ctypes.memset(out.pbData,0,out.cbData);kernel.LocalFree(ctypes.cast(out.pbData,ctypes.c_void_p))

def waha_status():
 root=Path.home()/'.codex/private-config/ponto-whatsapp';sys.path.insert(0,str(root/'runtime'))
 from segredo import _dpapi
 cfg=json.loads((root/'automacao-runtime.json').read_text(encoding='utf-8-sig'))['automacao']
 base=cfg['wahaUrl'].rstrip('/');assert base=='http://127.0.0.1:3075'
 key=_dpapi((root/'waha-key.dpapi').read_bytes(),True).decode()
 req=urllib.request.Request(base+'/api/sessions/'+urllib.parse.quote(cfg['wahaSessao'],safe=''),headers={'X-Api-Key':key})
 with urllib.request.urlopen(req,timeout=8) as response:session=json.load(response)
 sender=str((session.get('me') or {}).get('id','')).split('@')[0].split(':')[0]
 def identity(value):return value[:4]+value[5:] if len(value)==13 and value.startswith('55') and value[4]=='9' else value
 return {'connected':session.get('status')=='WORKING' and identity(sender)==identity('5581989751300'),'sender':'5581989751300','session':cfg['wahaSessao'],'messagesSent':0}

if __name__=='__main__':
 try:
  operation=sys.argv[1]
  if operation in ['protect','unprotect']:sys.stdout.buffer.write(dpapi(sys.stdin.buffer.read(),operation=='unprotect'))
  elif operation=='waha-status':print(json.dumps(waha_status()))
  else:raise ValueError('INVALID_OPERATION')
 except Exception:print('LOCAL_CONNECTION_UNAVAILABLE',file=sys.stderr);sys.exit(1)
