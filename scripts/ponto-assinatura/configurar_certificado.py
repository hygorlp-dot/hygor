"""Executar pelo titular em terminal local. Não envia certificado ou senha."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from assinador import conferir_titular
from asn1crypto import x509


def main():
    parser=argparse.ArgumentParser(description="Preparar configuração privada do certificado A1")
    parser.add_argument('--cadastro-desenvolvedor',required=True)
    parser.add_argument('--saida',required=True)
    args=parser.parse_args()
    # Não há argumentos de senha nem modo inseguro por linha de comando.
    output=Path(args.saida).resolve()
    if output.exists():raise ValueError('CONFIGURACAO_JA_EXISTE')
    developer=json.loads(Path(args.cadastro_desenvolvedor).read_text(encoding='utf-8-sig'))['rep']['desenvolvedor']
    pfx=Path(input('Caminho local do certificado A1 (.pfx/.p12): ').strip().strip('"')).resolve()
    if pfx.suffix.lower() not in ('.pfx','.p12') or pfx.stat().st_size>2_000_000:raise ValueError('ARQUIVO_CERTIFICADO_INVALIDO')
    password=getpass.getpass('Senha do certificado (não será salva): ')
    loaded=pkcs12.load_pkcs12(pfx.read_bytes(),password.encode())
    del password
    if loaded.cert is None:raise ValueError('CERTIFICADO_AUSENTE')
    certificate=loaded.cert.certificate
    der=certificate.public_bytes(serialization.Encoding.DER)
    config={'modo':'producao','pkcs12':str(pfx),'senhaEnv':'MARCELL_CERTIFICADO_SENHA','certificadoSha256':hashlib.sha256(der).hexdigest(),'raizesPem':[],'raizesSha256':[],'desenvolvedor':{'tipo':developer['tipo'],'numero':developer['numero']}}
    conferir_titular(x509.Certificate.load(der),config,False)
    output.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as target:json.dump(config,target,indent=2)
    print('Certificado confere com o desenvolvedor. Configuração privada criada sem senha.')
    print('Emissão ainda bloqueada: conferir raízes ICP-Brasil, configurar segredo no worker e concluir INPI/atestado.')


if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('Configuração interrompida: confira arquivo, senha, validade e CNPJ. Nenhuma senha foi gravada ou transmitida.')
