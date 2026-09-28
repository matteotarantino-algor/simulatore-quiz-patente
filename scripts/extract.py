#!/usr/bin/env python3
"""Estrae le affermazioni del listato ministeriale "Patente AB" (conseguimento) dal PDF ufficiale MIT.

Uso:
    python scripts/extract.py [percorso/del/listato.pdf]

Senza argomenti usa l'unico PDF presente in data/source/.

Output:
    data/questions.json   un record per affermazione + metadati della versione
    public/figures/*.jpg  figure deduplicate per hash (byte JPEG originali, nessuna ricompressione)

Il layout del PDF è una sequenza di tabelle "Quesito n° N - <argomento>" con colonne
Numero domanda | Testo domanda | Risposta Corretta | Immagine. Il parsing è a livello di
singolo carattere e per posizione orizzontale, perché in alcune righe il PDF fonde il
testo della domanda e la risposta (VERO/FALSO) in un unico span.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "source"
OUT_JSON = ROOT / "data" / "questions.json"
FIG_DIR = ROOT / "public" / "figures"
CONFIG = ROOT / "config" / "argomenti.json"

# Confini delle colonne (x in punti PDF, pagina A4 larga 595).
X_TEXT = 60     # prima: numero domanda
X_ANSWER = 350  # da qui: risposta corretta
X_IMAGE = 430   # da qui: immagine
Y_TOL = 3       # tolleranza verticale per assegnare testo/immagini alla riga

HEADER_RE = re.compile(r"^Quesito n° (\d+) - (.+)$")
NUM_RE = re.compile(r"^\d{3,6}$")
BODY_FONT = "Times-Roman"


@dataclass
class Segment:
    col: str  # "num" | "text" | "answer"
    y: float
    x: float
    text: str


@dataclass
class Row:
    numero: int
    pagina: int
    y: float
    y_end: float = 1e9
    quesito_id: int | None = None
    argomento_pdf: str | None = None
    lines: list[str] = field(default_factory=list)
    answers: list[str] = field(default_factory=list)
    images: list[int] = field(default_factory=list)  # xref


def col_of(x: float) -> str:
    if x < X_TEXT:
        return "num"
    if x < X_ANSWER:
        return "text"
    if x < X_IMAGE:
        return "answer"
    return "image"


def page_segments(page: fitz.Page) -> tuple[list[Segment], list[tuple[float, int, str]], list[float]]:
    """Restituisce (segmenti di corpo, intestazioni quesito, y delle intestazioni di tabella)."""
    segs: list[Segment] = []
    headers: list[tuple[float, int, str]] = []
    table_heads: list[float] = []
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                text = "".join(ch["c"] for ch in span["chars"])
                y = span["bbox"][1]
                if span["font"] != BODY_FONT:
                    m = HEADER_RE.match(text.strip())
                    if m:
                        headers.append((y, int(m.group(1)), m.group(2)))
                    elif text.strip() == "Numero":
                        table_heads.append(y)
                    continue
                # Spezza lo span per colonna, carattere per carattere.
                cur_col, buf, x0 = None, [], 0.0
                for ch in span["chars"]:
                    c = col_of(ch["bbox"][0])
                    if c != cur_col:
                        if buf and "".join(buf).strip():
                            segs.append(Segment(cur_col, y, x0, "".join(buf).strip()))
                        cur_col, buf, x0 = c, [], ch["bbox"][0]
                    buf.append(ch["c"])
                if buf and "".join(buf).strip():
                    segs.append(Segment(cur_col, y, x0, "".join(buf).strip()))
    return segs, headers, table_heads


def join_lines(lines: list[str]) -> str:
    """Unisce le righe di testo: a capo -> spazio; trattino finale di parola composta -> nessuno spazio."""
    out = ""
    for ln in lines:
        ln = ln.strip()
        if not out:
            out = ln
        elif re.search(r"\w-$", out):
            out += ln
        else:
            out += " " + ln
    return re.sub(r"[ \t]+", " ", out).strip()


def main() -> int:
    if len(sys.argv) > 1:
        pdf_path = Path(sys.argv[1])
    else:
        pdfs = sorted(SOURCE_DIR.glob("*.pdf"))
        if len(pdfs) != 1:
            print(f"Attesi esattamente 1 PDF in {SOURCE_DIR}, trovati {len(pdfs)}", file=sys.stderr)
            return 1
        pdf_path = pdfs[0]

    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    arg_by_pdf = {a["nome_pdf"]: a for a in config["argomenti"]}
    troncati = set(config.get("troncati", []))

    doc = fitz.open(pdf_path)
    rows: list[Row] = []
    anomalies: list[str] = []
    current: tuple[int, str] | None = None  # (quesito_id, argomento_pdf)

    for pno, page in enumerate(doc, start=1):
        segs, headers, table_heads = page_segments(page)
        num_segs = sorted((s for s in segs if s.col == "num" and NUM_RE.match(s.text)), key=lambda s: s.y)
        page_rows = [Row(numero=int(s.text), pagina=pno, y=s.y) for s in num_segs]

        # Eventi in ordine verticale: intestazioni di quesito e inizio righe.
        events = [(y, 0, ("H", qid, name)) for y, qid, name in headers]
        events += [(r.y, 1, ("R", r)) for r in page_rows]
        events.sort(key=lambda e: (e[0], e[1]))
        for _, _, ev in events:
            if ev[0] == "H":
                current = (ev[1], ev[2])
            else:
                row = ev[1]
                if current is None:
                    anomalies.append(f"p.{pno} domanda {row.numero}: nessuna intestazione di quesito precedente")
                else:
                    row.quesito_id, row.argomento_pdf = current

        # Fine di ogni riga: prossima riga, intestazione di quesito o di tabella.
        boundaries = sorted([r.y for r in page_rows] + [h[0] for h in headers] + table_heads)
        for r in page_rows:
            nxt = [b for b in boundaries if b > r.y + 0.5]
            r.y_end = nxt[0] if nxt else 1e9

        def row_at(y: float) -> Row | None:
            for r in page_rows:
                if r.y - Y_TOL <= y < r.y_end - Y_TOL:
                    return r
            return None

        for s in segs:
            if s.col == "num":
                if not NUM_RE.match(s.text):
                    anomalies.append(f"p.{pno}: testo inatteso in colonna numero: {s.text!r}")
                continue
            r = row_at(s.y)
            if r is None:
                anomalies.append(f"p.{pno}: testo fuori da ogni riga ({s.col}) y={s.y:.0f}: {s.text!r}")
                continue
            if s.col == "text":
                r.lines.append(s.text)
            elif s.col == "answer":
                r.answers.append(s.text)
            else:
                anomalies.append(f"p.{pno} domanda {r.numero}: testo in colonna immagine: {s.text!r}")

        for info in page.get_image_info(xrefs=True):
            x0, y0 = info["bbox"][0], info["bbox"][1]
            if x0 < X_IMAGE:
                continue  # logo del Ministero in testata
            r = row_at(y0)
            if r is None:
                anomalies.append(f"p.{pno}: immagine xref {info['xref']} fuori da ogni riga")
            else:
                r.images.append(info["xref"])

        rows.extend(page_rows)

    # Figure: dedup per hash dei byte originali.
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    for old in FIG_DIR.glob("*"):
        old.unlink()
    xref_to_fig: dict[int, str] = {}
    fig_sizes: dict[str, tuple[int, int]] = {}
    for r in rows:
        for x in r.images:
            if x in xref_to_fig:
                continue
            img = doc.extract_image(x)
            h = hashlib.sha1(img["image"]).hexdigest()[:16]
            name = f"{h}.{'jpg' if img['ext'] == 'jpeg' else img['ext']}"
            path = FIG_DIR / name
            if not path.exists():
                path.write_bytes(img["image"])
            xref_to_fig[x] = f"figures/{name}"
            fig_sizes[f"figures/{name}"] = (img["width"], img["height"])

    records = []
    for r in rows:
        arg = arg_by_pdf.get(r.argomento_pdf or "")
        if arg is None:
            anomalies.append(f"domanda {r.numero}: argomento non in config: {r.argomento_pdf!r}")
        answer = r.answers[0] if len(r.answers) == 1 else None
        if len(r.answers) != 1 or answer not in ("VERO", "FALSO"):
            anomalies.append(f"p.{r.pagina} domanda {r.numero}: risposta non valida {r.answers!r}")
        if len(r.images) > 1:
            anomalies.append(f"p.{r.pagina} domanda {r.numero}: {len(r.images)} immagini")
        figura = xref_to_fig[r.images[0]] if r.images else None
        nome = (r.argomento_pdf or "").replace("¿", "'")
        nome = re.sub(r"\s+", " ", nome).strip()
        if r.argomento_pdf in troncati:
            nome = nome.rstrip(" -;") + "…"
        records.append({
            "id": r.numero,
            "quesito_id": r.quesito_id,
            "argomento_id": arg["id"] if arg else None,
            "argomento_nome": nome,
            "testo": join_lines(r.lines),
            "risposta": answer == "VERO",
            "figura": figura,
            "pagina_sorgente": r.pagina,
        })

    meta = {
        "fonte": "Ministero delle Infrastrutture e dei Trasporti — Portale dell'Automobilista, listato \"Patente AB\" (conseguimento)",
        "url": "https://www.ilportaledellautomobilista.it/web/portale-automobilista/-/quiz-per-le-patenti-am-b-superiori-e-cqc",
        "file": pdf_path.name,
        "versione_listato": version_from_filename(pdf_path.name),
        "data_pdf": pdf_date(doc.metadata.get("creationDate", "")),
        "pagine": doc.page_count,
        "sha256_pdf": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
        "totale": len(records),
        "figure_uniche": len(set(xref_to_fig.values())),
        "anomalie": anomalies,
    }
    argomenti = [
        {"id": a["id"], "nome": next((q["argomento_nome"] for q in records if q["argomento_id"] == a["id"]), a["nome_pdf"]),
         "breve": a["breve"], "quota": a["quota"]}
        for a in config["argomenti"]
    ]
    OUT_JSON.write_text(
        json.dumps({"meta": meta, "argomenti": argomenti, "domande": records}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"{len(records)} affermazioni, {meta['figure_uniche']} figure uniche, {len(anomalies)} anomalie")
    for a in anomalies[:50]:
        print("  !", a)
    return 0 if not anomalies else 2


def version_from_filename(name: str) -> str | None:
    m = re.match(r"^(\d{2})(\d{2})(\d{2})_", name)
    return f"{m.group(3)}/{m.group(2)}/20{m.group(1)}" if m else None


def pdf_date(raw: str) -> str | None:
    m = re.match(r"D:(\d{4})(\d{2})(\d{2})", raw)
    return f"{m.group(3)}/{m.group(2)}/{m.group(1)}" if m else None


if __name__ == "__main__":
    sys.exit(main())
