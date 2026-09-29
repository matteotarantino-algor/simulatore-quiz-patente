# Simulatore quiz patente B — listato ufficiale MIT

Sito statico per esercitarsi all'esame di teoria della patente B usando **esclusivamente** le affermazioni del
listato ufficiale **«Patente AB» (conseguimento)** pubblicato dal Ministero delle Infrastrutture e dei Trasporti sul
[Portale dell'Automobilista](https://www.ilportaledellautomobilista.it/web/portale-automobilista/-/quiz-per-le-patenti-am-b-superiori-e-cqc).

Strumento personale, non affiliato al MIT. Nessun backend, nessun login, nessun tracciamento: i progressi restano nel
browser (localStorage) e si spostano tra dispositivi con export/import di un file JSON.

Versione dati attuale: file `210926_Conseguimento A-B italiano.pdf` (listato del 26/09/2021, PDF generato il
17/09/2026), 586 pagine, **7.020 affermazioni**, 715 quesiti, 25 argomenti, 3.919 affermazioni con figura
(407 immagini uniche).

## Funzionalità

- **Simulazione d'esame**: 30 affermazioni V/F, 20 minuti con consegna automatica allo scadere, promosso con al
  massimo 3 errori (senza risposta = errore), navigazione libera e risposte modificabili fino alla consegna,
  consegna anticipata con conferma. Esito con elenco degli errori (risposta data, corretta, figura).
- **Esame realistico**: stessa scheda ma estrazione puramente casuale, senza priorità sugli errori.
- **Per argomento**: uno o più dei 25 argomenti, sessioni da 10/20/30, correzione immediata.
- **Ripasso errori**: le domande sbagliate tornano finché non vengono indovinate 3 volte di fila.
- **Cosa dice il listato (ⓘ)**: accanto a ogni errore (fine quiz e correzione immediata) un pop-up mostra le altre
  affermazioni ufficiali sullo stesso segnale/tema: le VERE sempre visibili, le FALSE in una sezione richiudibile.
  Nessun testo aggiunto: sono affermazioni del PDF, parola per parola. Copertura: 6.864 affermazioni con affermazioni
  vere dello stesso quesito sulla stessa figura, 42 con la stessa figura in altri quesiti (98,4% in totale), 94 solo con
  affermazioni dello stesso quesito ma su altre figure (segnalato nel pop-up), 20 senza altre affermazioni vere
  collegate (vale la sola risposta ufficiale). Logica in `src/lib/spiegazione.ts`.
- **Consultazione del listato**: ricerca testuale (anche per numero domanda/quesito), filtro per argomento e figura.
- **Preparazione**: copertura, padronanza, probabilità stimata di superamento (Monte Carlo), andamento, esami
  realistici, argomenti deboli con allenamento mirato, verdetto sintetico.
- Mobile-first, figure ingrandibili al tocco, tema chiaro/scuro/automatico, PWA installabile e utilizzabile offline.

## Avvio in locale

Richiede Node.js ≥ 20.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # test unitari (Vitest)
npm run build      # sito statico in dist/
npm run preview    # anteprima della build
```

## Rigenerare i dati da un nuovo PDF

Quando il Ministero pubblica un listato aggiornato:

1. Scarica il PDF **«Patente AB»** (conseguimento, *non* «Revisione AB») dalla pagina del Portale dell'Automobilista
   e mettilo in `data/source/` (rimuovi il PDF precedente: lo script vuole esattamente un PDF).
2. Crea l'ambiente Python ed esegui estrazione, validazione e controllo incrociato:

   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r scripts/requirements.txt pdfplumber
   .venv/bin/python scripts/extract.py     # -> data/questions.json + public/figures/*.jpg
   .venv/bin/python scripts/validate.py    # -> data/VALIDATION.md + data/validation/campione.html
   .venv/bin/python scripts/crosscheck.py  # ri-estrazione indipendente con pdfplumber, deve dare 0 differenze
   ```

3. Se un argomento ha cambiato nome, `extract.py` lo segnala: aggiorna `config/argomenti.json` (`nome_pdf` deve
   coincidere col testo dell'intestazione nel PDF).
4. Controlla `data/VALIDATION.md` e il campione in `data/validation/campione.html`, poi `npm test` e fai il push.

Come funziona l'estrazione: il PDF è una sequenza di tabelle «Quesito n° N – argomento» con colonne *Numero domanda |
Testo | Risposta Corretta | Immagine*. `extract.py` (pymupdf) legge carattere per carattere e assegna ogni carattere
alla colonna in base alla posizione orizzontale (in 68 righe il PDF fonde testo e VERO/FALSO nello stesso blocco),
assegna le figure alla riga in cui compaiono e le deduplica per hash salvando i byte JPEG originali. Il testo delle
domande non viene modificato: sono uniti solo gli a capo (e i 3 a capo dopo un trattino di parola composta).
`validate.py` confronta i conteggi con il testo grezzo del PDF (VERO/FALSO, intestazioni, immagini) e cerca testi
vuoti, troncati o con residui; `crosscheck.py` ri-estrae tutto con un motore diverso e confronta ogni affermazione.

Note sui dati: 6 nomi di argomento sono troncati nel PDF stesso e sono mostrati con «…»; l'apostrofo codificato come
`¿` in un'intestazione è corretto in `'`. Le figure nel PDF sono di circa 200×200 pixel.

## Configurazione

### Ripartizione per argomento — `config/argomenti.json`

Il DM 27/10/2021 e la circolare del 14/12/2021 stabiliscono 30 affermazioni, 20 minuti, massimo 3 errori ed
estrazione casuale, ma **non pubblicano la ripartizione per argomento**. Si usa quindi, dichiaratamente, questa regola
(campo `quota`): 1 affermazione per ciascuno dei 25 argomenti + 1 in più ai 5 argomenti con più affermazioni nel
listato (Definizioni e doveri, Segnali di pericolo, di divieto, di obbligo, di indicazione). Somma = 30; `validate.py`
e i test lo verificano. Le schede sono ordinate per argomento.

### Parametri — `config/impostazioni.json`

**Selezione intelligente (`selezione`)** — vale per simulazione d'esame e per argomento:

1. Prima le domande **mai viste** (estratte a caso). Nell'esame la ripartizione resta quella ufficiale: si pesca tra
   le non viste *dentro ciascun argomento*.
2. Esaurite le non viste, estrazione **pesata** senza ripetizioni (Efraimidis–Spirakis). Peso di una domanda vista:

| Caso | Peso |
|---|---|
| ultima risposta sbagliata | `peso_errata` (10) + `peso_per_errore` (2) × errori totali (max `errori_max_conteggiati` = 5) + `bonus_errore_recente` (6) se sbagliata negli ultimi `giorni_errore_recente` (7) giorni |
| consolidata: ≥ `serie_consolidata` (3) risposte giuste di fila | `peso_consolidata` (0,4) |
| vista una sola volta e indovinata | `peso_indovinata_una_volta` (4) |
| vista l'ultima volta ≥ `giorni_vista_tempo_fa` (14) giorni fa | `peso_vista_tempo_fa` (4) |
| sbagliata in passato, ora in via di consolidamento | `peso_in_consolidamento` (3) |
| altrimenti | `peso_normale` (2) |

`componente_casuale` (0,15) mescola ogni peso con la media dei pesi (0 = solo priorità, 1 = tutto casuale), per non
riproporre sempre le stesse schede. Mai la stessa domanda due volte nella stessa scheda.

**Ripasso (`ripasso`)**: una domanda sbagliata resta nel ripasso finché non ha `serie_richiesta` (3) risposte giuste
consecutive; sessioni da `domande_per_sessione` (20).

**Stima della preparazione (`preparazione`)**:

- Per ogni domanda vista: p = (successi pesati + f·m) / (tentativi pesati + f), con peso `decadimento_storia`^k
  (0,7) alla k-esima risposta più vecchia (ultime `storia_max` = 10), f = `forza_prior_domanda` (2) e m = accuratezza
  pesata di tutte le risposte date nell'argomento, (S + 1)/(T + 2). Con m = 0,5 la formula è (corrette + 1)/(viste + 2);
  usare la media dell'argomento evita che chi risponde sempre giusto resti fermo a ~80% per domanda (e quindi a una
  probabilità di superamento irrealisticamente bassa).
- Per le mai viste: m «tirata» verso un valore prudente `prior_non_viste` (0,6) con forza `forza_prior` (10): con
  poche domande viste in un argomento prevale il valore prudente.
- **Monte Carlo**: `simulazioni` (5.000) schede generate con la ripartizione per argomento, stima di P(errori ≤ 3).
  I test verificano che coincida con il calcolo binomiale esatto e che sia calibrata su studenti simulati.
- Copertura = domande viste almeno una volta; padronanza = ultime `serie_padronanza` (2) risposte corrette.

**Verdetto (`verdetto`)**: *Pronto* se probabilità ≥ 90%, copertura ≥ 90% e gli ultimi 5 esami realistici con al
massimo 1 errore; *Quasi pronto* se probabilità ≥ 70%; altrimenti *Non ancora*. Le simulazioni «intelligenti»
propongono soprattutto domande sbagliate e sottostimano la preparazione: per questo il verdetto si basa sulla stima
per domanda e sugli esami realistici, non sui voti delle simulazioni.

## Pubblicazione

Il sito è pubblicato con **GitHub Pages**. Il workflow `.github/workflows/deploy.yml` a ogni push su `main` esegue
test e build e pubblica `dist/`. Il sito non è indicizzato (`<meta name="robots" content="noindex">` e `robots.txt`).

Aggiornare il sito: modifica, `git commit`, `git push` → dopo 1–2 minuti la nuova versione è online (tab *Actions*
del repository per lo stato). Con la PWA il telefono scarica l'aggiornamento alla visita successiva.

## Struttura

```
config/            argomenti (nomi, quote) e parametri
data/questions.json  dati estratti (una voce per affermazione) + metadati versione
data/VALIDATION.md   report di validazione
data/source/       PDF sorgente (non versionato)
public/figures/    figure deduplicate
scripts/           extract.py, validate.py, crosscheck.py
src/lib/           logica pura: selezione, esame, preparazione, progressi (+ test)
src/components/    interfaccia Svelte
```
