#!/usr/bin/env python3
"""Controllo incrociato: ri-estrae il PDF con un motore diverso (pdfplumber/pdfminer)
e confronta ogni affermazione di data/questions.json (testo, risposta, presenza figura,
quesito, argomento). Serve a escludere errori sistematici del parser principale (pymupdf).

Uso:
    pip install pdfplumber
    python scripts/crosscheck.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
HEADER_RE = re.compile(r"Quesito n° (\d+) - ")


def norm(s: str) -> str:
    s = s.replace("¿", "'")
    s = re.sub(r"(\w-)\s+", r"\1", s)  # a capo dopo trattino di parola composta
    return re.sub(r"\s+", " ", s).strip()


def main() -> int:
    data = json.loads((ROOT / "data" / "questions.json").read_text(encoding="utf-8"))
    ours = {q["id"]: q for q in data["domande"]}
    pdf_path = ROOT / "data" / "source" / data["meta"]["file"]

    theirs: dict[int, dict] = {}
    current_q = None
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            chars = page.chars
            # Righe di testo: raggruppa i caratteri per "top" arrotondato.
            lines: dict[float, list[dict]] = {}
            for c in chars:
                lines.setdefault(round(c["top"]), []).append(c)
            events = []  # (top, kind, payload)
            body = []    # (top, col, text)
            for top, cs in sorted(lines.items()):
                cs.sort(key=lambda c: c["x0"])
                bold = [c for c in cs if "Bold" in c["fontname"]]
                txt_bold = "".join(c["text"] for c in bold)
                m = HEADER_RE.match(txt_bold)
                if m:
                    events.append((top, 0, ("H", int(m.group(1)))))
                if "Numero" in txt_bold:
                    events.append((top, 0, ("T", None)))
                reg = [c for c in cs if "Bold" not in c["fontname"] and "Italic" not in c["fontname"]]
                for col, lo, hi in (("num", 0, 60), ("text", 60, 350), ("ans", 350, 430)):
                    seg = [c for c in reg if lo <= c["x0"] < hi]
                    if seg:
                        # ricostruisci gli spazi dalle distanze tra caratteri
                        out = seg[0]["text"]
                        for a, b in zip(seg, seg[1:]):
                            if b["x0"] - a["x1"] > 0.8 and not out.endswith(" ") and b["text"] != " ":
                                out += " "
                            out += b["text"]
                        body.append((top, col, out.strip()))
            rows = [(t, int(s)) for t, c, s in body if c == "num" and re.fullmatch(r"\d{3,6}", s)]
            for t, n in rows:
                events.append((t, 1, ("R", n)))
            events.sort(key=lambda e: (e[0], e[1]))
            bounds = sorted(e[0] for e in events)
            imgs = [im["top"] for im in page.images if im["x0"] >= 430]
            for t, _, ev in events:
                if ev[0] == "H":
                    current_q = ev[1]
                elif ev[0] == "R":
                    nxt = [b for b in bounds if b > t]
                    end = nxt[0] if nxt else 1e9
                    txt = [s for tt, c, s in body if c == "text" and t - 3 <= tt < end - 3]
                    ans = [s for tt, c, s in body if c == "ans" and t - 3 <= tt < end - 3]
                    theirs[ev[1]] = {
                        "testo": norm(" ".join(txt)),
                        "risposta": ans,
                        "figura": any(t - 3 <= it < end - 3 for it in imgs),
                        "quesito_id": current_q,
                        "pagina": pno,
                    }

    diffs = []
    if set(ours) != set(theirs):
        diffs.append(f"id diversi: solo nostri {sorted(set(ours) - set(theirs))[:10]}, solo pdfplumber {sorted(set(theirs) - set(ours))[:10]}")
    for i, q in ours.items():
        t = theirs.get(i)
        if not t:
            continue
        if norm(q["testo"]) != t["testo"]:
            diffs.append(f"{i} testo:\n   pymupdf   : {q['testo']}\n   pdfplumber: {t['testo']}")
        if t["risposta"] != ["VERO" if q["risposta"] else "FALSO"]:
            diffs.append(f"{i} risposta: pymupdf {q['risposta']} vs pdfplumber {t['risposta']}")
        if bool(q["figura"]) != t["figura"]:
            diffs.append(f"{i} figura: pymupdf {q['figura']} vs pdfplumber {t['figura']}")
        if q["quesito_id"] != t["quesito_id"] or q["pagina_sorgente"] != t["pagina"]:
            diffs.append(f"{i} quesito/pagina: {q['quesito_id']}/{q['pagina_sorgente']} vs {t['quesito_id']}/{t['pagina']}")

    print(f"Confrontate {len(ours)} affermazioni (pymupdf) con {len(theirs)} (pdfplumber): {len(diffs)} differenze")
    for d in diffs[:40]:
        print(" -", d)
    return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
