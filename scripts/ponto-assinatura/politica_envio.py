"""Recorte de entrega autorizado; ausência de configuração nunca libera envios."""
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


def no_recorte(origem, politica, agora):
    try:
        escopo = politica['escopoSolicitado']
        if escopo['fuso'] != 'America/Bahia' or escopo['incluirDiasAnteriores'] is not False:
            return False
        fuso = ZoneInfo(escopo['fuso'])
        instante = datetime.fromisoformat(origem['marcadoEm'].replace('Z', '+00:00'))
        if instante.tzinfo is None or agora.tzinfo is None or instante > agora:
            return False
        dia = instante.astimezone(fuso).date().isoformat()
        # Não recuperar ontem, nem depois de uma indisponibilidade do computador.
        if dia != agora.astimezone(fuso).date().isoformat():
            return False
        if dia == escopo['dataLocal']:
            return origem.get('tipoEvento') == 'saida'
        return dia >= escopo['normalDesde'] and escopo['normalNovasBatidas'] is True
    except (KeyError, TypeError, ValueError):
        return False


def permitido(manifesto, origem, politica, agora):
    try:
        return (politica.get('envioHabilitado') is True and not politica.get('bloqueios')
                and politica.get('modo') == 'somente_pdf_oficial'
                and manifesto['companyId'] == politica['companyId']
                and manifesto['status'] == 'assinado_validado' and manifesto.get('padrao') == 'PAdES'
                and origem is not None
                and all(manifesto.get(k) == origem.get(k) and manifesto.get(k) is not None
                        for k in ('eventId', 'employeeId', 'marcadoEm', 'nsr'))
                and no_recorte(origem, politica, agora))
    except (KeyError, TypeError, ValueError):
        return False


def ler_politica(arquivo):
    try:
        return json.loads(Path(arquivo).read_text(encoding='utf-8-sig'))
    except (OSError, TypeError, ValueError):
        return {}


def agora_utc():
    return datetime.now(timezone.utc)
