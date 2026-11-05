"""Segredo A1: ambiente do worker ou DPAPI CurrentUser no Windows local.
Não há segredo, senha padrão ou chave de assinatura no código.
"""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path


def _dpapi(data, decrypt):
    if os.name != 'nt':raise ValueError('SEGREDO_DPAPI_EXIGE_WINDOWS_DO_TITULAR')
    class Blob(ctypes.Structure):
        _fields_=[('cbData',wintypes.DWORD),('pbData',ctypes.POINTER(ctypes.c_ubyte))]
    def blob(raw):
        buffer=ctypes.create_string_buffer(raw)
        return buffer,Blob(len(raw),ctypes.cast(buffer,ctypes.POINTER(ctypes.c_ubyte)))
    source_buffer,source=blob(data)
    entropy_buffer,entropy=blob(b'MARCELL-ponto-assinatura-A1-v1')
    result=Blob()
    crypto=ctypes.WinDLL('crypt32',use_last_error=True)
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.LocalFree.argtypes=[ctypes.c_void_p];kernel.LocalFree.restype=ctypes.c_void_p
    if decrypt:
        function=crypto.CryptUnprotectData
        function.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
        second=None
    else:
        function=crypto.CryptProtectData
        function.argtypes=[ctypes.POINTER(Blob),ctypes.c_wchar_p,ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
        second='MARCELL certificado A1'
    function.restype=wintypes.BOOL
    try:
        if not function(ctypes.byref(source),second,ctypes.byref(entropy),None,None,1,ctypes.byref(result)):
            raise ValueError('SEGREDO_WINDOWS_NAO_PODE_SER_ABERTO')
        return ctypes.string_at(result.pbData,result.cbData)
    finally:
        ctypes.memset(source_buffer,0,len(source_buffer))
        if result.pbData:
            ctypes.memset(result.pbData,0,result.cbData)
            kernel.LocalFree(ctypes.cast(result.pbData,ctypes.c_void_p))


def proteger_windows(value):
    if not isinstance(value,bytes) or not value:raise ValueError('SEGREDO_VAZIO')
    return _dpapi(value,False)


def senha_do_certificado(config):
    if config.get('senhaDpapi'):
        return _dpapi(Path(config['senhaDpapi']).read_bytes(),True)
    name=config.get('senhaEnv')
    if not isinstance(name,str) or not os.environ.get(name):raise ValueError('SENHA_CERTIFICADO_NAO_CONFIGURADA')
    return os.environ[name].encode()
