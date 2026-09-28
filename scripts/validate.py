#!/usr/bin/env python3
"""Valida data/questions.json contro il PDF sorgente e genera data/VALIDATION.md.

Uso:
    python scripts/validate.py [--seed N]

Esce con codice 1 se un controllo bloccante fallisce.
Per il campione casuale salva in data/validation/ il ritaglio della riga del PDF,
così il confronto testo estratto / originale si fa a colpo d'occhio.
"""
from __future__ import annotations

import argparse
import json
import random
import re
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "questions.json"
FIG_ROOT = ROOT / "public"
OUT_MD = ROOT / "data" / "VALIDATION.md"
CROP_DIR = ROOT / "data" / "validation"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20260928)
    args = ap.parse_args()

    data = json.loads(DATA.read_text(encoding="utf-8"))
    meta, argomenti, qs = data["meta"], data["argomenti"], data["domande"]
    pdf = ROOT / "data" / "source" / meta["file"]
    doc = fitz.open(pdf)

    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, ok, detail))

    # --- Controlli incrociati indipendenti sul testo grezzo del PDF ---
    raw = "\n".join(p.get_text() for p in doc)
    raw_vf = len(re.findall(r"\b(?:VERO|FALSO)\b", raw))
    raw_headers = len(re.findall(r"Quesito n° \d+ - ", raw))
    check("Conteggio VERO/FALSO nel testo grezzo del PDF = affermazioni estratte",
          raw_vf == len(qs), f"PDF {raw_vf}, estratte {len(qs)}")
    check("Conteggio intestazioni 'Quesito n°' nel PDF = quesiti estratti",
          raw_headers == len({q["quesito_id"] for q in qs}),
          f"PDF {raw_headers}, estratti {len({q['quesito_id'] for q in qs})}")
    raw_imgs = sum(1 for p in doc for i in p.get_image_info() if i["bbox"][0] >= 430)
    n_with_fig = sum(1 for q in qs if q["figura"])
    check("Immagini nella colonna 'Immagine' del PDF = affermazioni con figura",
          raw_imgs == n_with_fig, f"PDF {raw_imgs}, estratte {n_with_fig}")

    # --- Argomenti ---
    per_arg = Counter(q["argomento_id"] for q in qs)
    check("25 argomenti presenti", len(per_arg) == 25 and None not in per_arg, f"trovati {len(per_arg)}")
    check("Somma quote scheda d'esame = 30", sum(a["quota"] for a in argomenti) == 30,
          f"somma {sum(a['quota'] for a in argomenti)}")

    # --- Risposte ---
    bad_answer = [q["id"] for q in qs if not isinstance(q["risposta"], bool)]
    check("Ogni affermazione ha risposta V/F valida", not bad_answer, f"{len(bad_answer)} non valide")
    check("Nessuna anomalia segnalata dall'estrazione", not meta["anomalie"], f"{len(meta['anomalie'])} anomalie")

    # --- Id ---
    dup_ids = [i for i, c in Counter(q["id"] for q in qs).items() if c > 1]
    check("Nessun id duplicato", not dup_ids, f"duplicati: {dup_ids[:10]}")

    # --- Testi ---
    empty = [q["id"] for q in qs if not q["testo"].strip()]
    check("Nessun testo vuoto", not empty, f"{empty[:10]}")
    leak = [q["id"] for q in qs if re.search(r"\b(VERO|FALSO)$|Testo domanda|Risposta Corretta|Quesito n°", q["testo"])]
    check("Nessun residuo di intestazioni/risposte nel testo", not leak, f"{leak[:10]}")
    short = [q for q in qs if len(q["testo"]) < 20]
    check("Nessun testo sospettosamente corto (< 20 caratteri)", not short,
          "; ".join(f"{q['id']}: {q['testo']!r}" for q in short[:10]))
    odd_end = [q for q in qs if not re.search(r"[\w)\"'.%”]$", q["testo"])]
    check("Nessun testo con finale anomalo (possibile troncamento)", not odd_end,
          "; ".join(f"{q['id']}: …{q['testo'][-30:]!r}" for q in odd_end[:10]))
    weird = [q["id"] for q in qs if re.search(r"[¿�\x00-\x08]", q["testo"])]
    check("Nessun carattere di encoding anomalo nei testi", not weird, f"{weird[:10]}")
    dup_text = [t for t, c in Counter((q["argomento_id"], q["testo"]) for q in qs).items() if c > 1]

    # --- Figure ---
    referenced = {q["figura"] for q in qs if q["figura"]}
    missing = [f for f in referenced if not (FIG_ROOT / f).exists()]
    on_disk = {f"figures/{p.name}" for p in (FIG_ROOT / "figures").iterdir()}
    orphans = sorted(on_disk - referenced)
    check("Ogni figura referenziata esiste", not missing, f"mancanti: {missing[:10]}")
    check("Nessuna immagine orfana", not orphans, f"orfane: {orphans[:10]}")

    # --- Campione casuale con ritaglio dal PDF ---
    rng = random.Random(args.seed)
    sample = rng.sample(qs, 20)
    CROP_DIR.mkdir(parents=True, exist_ok=True)
    for old in CROP_DIR.glob("*.png"):
        old.unlink()
    for q in sample:
        page = doc[q["pagina_sorgente"] - 1]
        hits = [r for r in page.search_for(str(q["id"])) if r.x0 < 60]
        if hits:
            r = hits[0]
            clip = fitz.Rect(15, r.y0 - 3, 580, min(r.y0 + 95, page.rect.y1))
            page.get_pixmap(dpi=110, clip=clip).save(CROP_DIR / f"{q['id']}.png")

    blocking_ok = all(ok for _, ok, _ in checks)

    # --- Report ---
    L: list[str] = []
    L.append("# Validazione `data/questions.json`\n")
    L.append(f"- Sorgente: `{meta['file']}` — listato del **{meta['versione_listato']}**, PDF generato il {meta['data_pdf']}, {meta['pagine']} pagine")
    L.append(f"- SHA-256 PDF: `{meta['sha256_pdf']}`")
    L.append(f"- Affermazioni: **{len(qs)}** · quesiti: {len({q['quesito_id'] for q in qs})} · "
             f"con figura: {n_with_fig} · figure uniche: {meta['figure_uniche']} · "
             f"VERO: {sum(q['risposta'] for q in qs)} · FALSO: {sum(not q['risposta'] for q in qs)}")
    L.append(f"- Esito complessivo: **{'✅ TUTTI I CONTROLLI SUPERATI' if blocking_ok else '❌ CONTROLLI FALLITI'}**\n")

    L.append("## Controlli\n")
    L.append("| | Controllo | Dettaglio |\n|---|---|---|")
    for name, ok, detail in checks:
        L.append(f"| {'✅' if ok else '❌'} | {name} | {detail.replace('|', '/')} |")
    L.append("")

    L.append("## Conteggio per argomento\n")
    L.append("| # | Argomento | Affermazioni | Quesiti | Con figura | Quota scheda |\n|---:|---|---:|---:|---:|---:|")
    for a in argomenti:
        aq = [q for q in qs if q["argomento_id"] == a["id"]]
        L.append(f"| {a['id']} | {a['nome']} | {len(aq)} | {len({q['quesito_id'] for q in aq})} | "
                 f"{sum(1 for q in aq if q['figura'])} | {a['quota']} |")
    L.append(f"| | **Totale** | **{len(qs)}** | **{len({q['quesito_id'] for q in qs})}** | **{n_with_fig}** | "
             f"**{sum(a['quota'] for a in argomenti)}** |\n")

    L.append("## Note (non bloccanti)\n")
    L.append("- I nomi di 6 argomenti sono troncati nel PDF stesso: sono mostrati con `…`, senza inventare il seguito.")
    L.append("- Nell'intestazione dell'argomento \"Limitazione dei consumi…\" il PDF codifica l'apostrofo come `¿`: corretto in `'`.")
    L.append("- La ripartizione per argomento (colonna *Quota scheda*) non è pubblicata ufficialmente: è configurata in `config/argomenti.json`.")
    L.append(f"- Testi identici ripetuti nello stesso argomento (presenti così nel PDF, con numeri diversi): {len(dup_text)}.")
    hyph = [q for q in qs if re.search(r"\w-\w", q["testo"])]
    L.append(f"- Affermazioni con trattino interno (parole composte, a capo unito senza spazio): {len(hyph)}.\n")

    L.append(f"## Campione casuale di 20 affermazioni (seed {args.seed})\n")
    L.append("Verifica ciascuna contro il PDF alla pagina indicata (il ritaglio è preso dal PDF originale).\n")
    for i, q in enumerate(sample, 1):
        L.append(f"### {i}. Domanda {q['id']} — pagina {q['pagina_sorgente']}\n")
        L.append(f"- Argomento: {q['argomento_nome']} (quesito {q['quesito_id']})")
        L.append(f"- Testo estratto: {q['testo']}")
        L.append(f"- Risposta: **{'VERO' if q['risposta'] else 'FALSO'}** · Figura: {('`' + q['figura'] + '`') if q['figura'] else 'nessuna'}\n")
        L.append(f"Ritaglio PDF: ![pdf {q['id']}](validation/{q['id']}.png)")
        if q["figura"]:
            L.append(f" Figura estratta: <img src=\"../public/{q['figura']}\" height=\"90\">")
        L.append("")

    OUT_MD.write_text("\n".join(L), encoding="utf-8")
    write_sample_html(meta, sample, blocking_ok, len(qs))
    print(f"Report scritto in {OUT_MD.relative_to(ROOT)} — {'OK' if blocking_ok else 'FALLITO'}")
    for name, ok, detail in checks:
        if not ok:
            print(f"  ❌ {name}: {detail}")
    return 0 if blocking_ok else 1


def write_sample_html(meta: dict, sample: list[dict], ok: bool, total: int) -> None:
    """Pagina autonoma (immagini incorporate) per verificare il campione anche da telefono."""
    import base64
    from html import escape

    def b64(path: Path, mime: str) -> str:
        return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}" if path.exists() else ""

    cards = []
    for i, q in enumerate(sample, 1):
        crop = b64(CROP_DIR / f"{q['id']}.png", "image/png")
        fig = b64(FIG_ROOT / q["figura"], "image/jpeg") if q["figura"] else ""
        ans = "VERO" if q["risposta"] else "FALSO"
        cards.append(f"""
<section class="card">
  <h2>{i}. Domanda {q['id']} <span>pag. {q['pagina_sorgente']}</span></h2>
  <p class="arg">{escape(q['argomento_nome'])}</p>
  <div class="row">
    {'<img class="fig" src="' + fig + '" alt="figura estratta">' if fig else '<div class="fig nofig">nessuna figura</div>'}
    <div><p class="txt">{escape(q['testo'])}</p><p class="ans {ans.lower()}">{ans}</p></div>
  </div>
  <p class="lbl">Originale nel PDF</p>
  <img class="crop" src="{crop}" alt="ritaglio PDF">
</section>""")
    html = f"""<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifica campione</title>
<style>
:root{{--bg:#f6f7f9;--card:#fff;--ink:#1b1f24;--mute:#5d6875;--line:#dde2e8;--ok:#1a7f37;--ko:#c62828}}
@media (prefers-color-scheme:dark){{:root{{--bg:#111418;--card:#1b2027;--ink:#e8ecf1;--mute:#9aa5b1;--line:#2c333c;--ok:#4cc26b;--ko:#ff6b6b}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,sans-serif}}
main{{max-width:860px;margin:0 auto;padding:16px}}
h1{{font-size:1.3rem;margin:.2em 0}} .meta{{color:var(--mute);font-size:.9rem}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}}
.card h2{{font-size:1rem;margin:0}} .card h2 span{{color:var(--mute);font-weight:400}}
.arg{{color:var(--mute);font-size:.8rem;margin:.2em 0 .8em}}
.row{{display:flex;gap:12px;align-items:flex-start}}
.fig{{width:110px;height:auto;flex:none;border-radius:6px;background:#fff}}
.nofig{{height:60px;display:grid;place-items:center;font-size:.75rem;color:var(--mute);border:1px dashed var(--line);background:none}}
.txt{{margin:0 0 .4em}} .ans{{font-weight:700;margin:0}} .vero{{color:var(--ok)}} .falso{{color:var(--ko)}}
.lbl{{font-size:.75rem;color:var(--mute);margin:.9em 0 .3em;text-transform:uppercase;letter-spacing:.04em}}
.crop{{width:100%;height:auto;border:1px solid var(--line);border-radius:6px;background:#fff}}
</style></head><body><main>
<h1>Verifica campione — 20 affermazioni</h1>
<p class="meta">{escape(meta['file'])} · listato {meta['versione_listato']} · {total} affermazioni · controlli automatici: {'superati ✅' if ok else 'FALLITI ❌'}</p>
<p class="meta">Per ciascuna: in alto testo, risposta e figura estratti; sotto il ritaglio del PDF originale.</p>
{''.join(cards)}
</main></body></html>"""
    (CROP_DIR / "campione.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
