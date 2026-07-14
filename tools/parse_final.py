# -*- coding: utf-8 -*-
import zipfile, re, json, html, sys

DOCX = r"C:\Users\jaisi\OneDrive\Desktop\web2.o\justin-sports\learner's\S.S.UNIQUE_MOTOR_DRIVING_SCHOOL___english.docx"
SP = r"C:\Users\jaisi\AppData\Local\Temp\claude\C--Users-jaisi-Downloads-last\9a4a9024-e46a-4b60-b01d-c3bfeac7f2ac\scratchpad"
GREEN = {'0F7C0F', '1DB100', '017100'}
LOGO = 'media/image2.jpeg'
WM = re.compile(r'S\.S\.UNIQUE MOTOR DRIVING SCHOOL|KOODAL \| 9744628988')

z = zipfile.ZipFile(DOCX)
xml = z.read('word/document.xml').decode('utf-8')
rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))

def clean(t):
    t = html.unescape(t)
    t = WM.sub('', t)
    t = re.sub(r'�+', '…', t)
    t = re.sub(r'\s+', ' ', t).strip(' |').strip()
    return t

# ---- pass 1: paragraph stream with run segments ----
stream = []  # (lvl, segments[(text,green)], imgs)
for pa in xml.split('</w:p>'):
    m = re.search(r'<w:numPr>.*?<w:ilvl w:val="(\d+)"/>.*?<w:numId w:val="(\d+)"/>', pa, re.S)
    lvl = m.group(1) if m else None
    imgs = [relmap.get(r, '') for r in re.findall(r'r:embed="([^"]+)"', pa)]
    imgs = [i for i in imgs if i and i != LOGO]
    # run segments
    segs = []
    for r in re.findall(r'<w:r>.*?</w:r>', pa, re.S):
        txt = ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', r))
        if not txt:
            continue
        g = bool(set(re.findall(r'<w:color w:val="([^"]+)"', r)) & GREEN)
        if segs and segs[-1][1] == g:
            segs[-1][0] += txt
        else:
            segs.append([txt, g])
    segs = [[clean(t), g] for t, g in segs]
    segs = [[t, g] for t, g in segs if t]
    stream.append((lvl, segs, imgs))

# ---- pass 2: zones ----
def para_text(segs):
    return clean(' '.join(t for t, g in segs))

zones = []  # {'q': str, 'units': [(text,green)], 'imgs': []}
cur = None
for lvl, segs, imgs in stream:
    t = para_text(segs)
    if lvl == '0' and t:
        # continuation of previous question? starts lowercase and prev question lacks terminal punctuation
        if (cur and not cur['units'] and cur['q'] and
                (t[0].islower() or cur['q'].endswith((' a', ' the', ' of', ' or', ' and', ' to', ' in', ' is')))
                and not cur['q'].rstrip().endswith(('?', '.', ':', '…', '….'))):
            cur['q'] += ' ' + t
            cur['imgs'] += imgs
            continue
        cur = {'q': re.sub(r'^\d+\.\s*', '', t), 'units': [], 'imgs': imgs[:]}
        zones.append(cur)
    elif t and cur is not None:
        # unit(s) from this paragraph: keep green/plain segments separate
        for st, g in segs:
            cur['units'].append((st, g))
        cur['imgs'] += imgs
    elif imgs and cur is not None:
        cur['imgs'] += imgs

# ---- pass 2b: zone-level cleanups ----
def fix_zone(zn):
    units = [[t, g] for t, g in zn['units']]
    # a) first unit is a question-wrap fragment: starts lowercase, ends with '?'
    while units and units[0][0] and units[0][0][0].islower() and units[0][0].rstrip().endswith('?') and not units[0][1]:
        zn['q'] = zn['q'].rstrip('?. ') + ' ' + units.pop(0)[0]
    # b) merge mid-word / continuation fragments (even across green boundary)
    merged = []
    for t, g in units:
        if merged:
            pt, pg = merged[-1]
            frag = (t[0].islower() or len(pt) <= 2 or len(t) <= 2 or pt.endswith('-'))
            # don't merge two full sentences
            if frag and not (pt.rstrip().endswith(('?', '.', '…')) and len(t) > 2 and t[0].isupper()):
                merged[-1][0] = (pt + ('' if (pt.endswith('-') or len(pt) <= 2 or len(t) <= 2) and not (pt.endswith(' ') or t.startswith(' ')) and (len(pt) <= 2 or len(t) <= 2) else ' ') + t).replace('  ', ' ')
                # keep whichever flag is green
                merged[-1][1] = pg or g
                continue
        merged.append([t, g])
    zn['units'] = [(t, g) for t, g in merged]
    return zn

def split_double_zone(zn):
    """zone holding two questions: 4 opts (1 green), question-ish unit, 4 opts (1 green)"""
    units = zn['units']
    greens = [i for i, (t, g) in enumerate(units) if g]
    if len(greens) != 2 or len(units) < 8:
        return None
    # find question candidate between the greens
    for qi in range(greens[0] + 1, greens[1]):
        t, g = units[qi]
        before = units[:qi]
        after = units[qi + 1:]
        if len(before) == 4 and len(after) == 4 and t.rstrip().endswith('?'):
            gb = [i for i, (tt, gg) in enumerate(before) if gg]
            ga = [i for i, (tt, gg) in enumerate(after) if gg]
            if len(gb) == 1 and len(ga) == 1:
                z1 = {'q': zn['q'], 'units': before, 'imgs': zn['imgs']}
                z2 = {'q': re.sub(r'^\d+\.\s*', '', t), 'units': after, 'imgs': []}
                return [z1, z2]
    return None

zones = [fix_zone(z) for z in zones]
expanded = []
for zn in zones:
    d = split_double_zone(zn)
    if d:
        expanded += d
    else:
        expanded.append(zn)
zones = expanded

# ---- pass 3: normalize units into exactly 4 options ----
AMT = r'(?:Rs\.?\s?[\d,]+(?:\s*(?:fine|penalty))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Fifteen|Twenty|Twenty[- ]five|Fifty|Hundred)(?:\s+(?:hundred|thousand|lakh))?(?:\s+and\s+(?:fifteen|fifty)\s+(?:hundred|thousand))?\s+rupees\s+fine|Fine of (?:Rs\.?\s?[\d,]+|[a-z ]+rupees)|Penalty of [a-z ]+rupees|Imprisonment[^|]*?(?:years|months)(?:\s+and a fine of Rs\.?\s?[\d,]+\.?)?)'

def split_plain(text, want):
    """split a plain segment into up to `want` options using patterns"""
    text = text.strip()
    if want <= 1 or not text:
        return [text] if text else []
    # 0) amounts-only unit: capitals mark option starts
    NUMW = r'(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Fifteen|Twenty|Twenty-five|Fifty|Hundred|Rs\.?|Fine|Penalty|Imprisonment)'
    if re.fullmatch(r"[A-Za-z0-9 ,.‐-―%/()\-]+", text) and re.match(NUMW, text):
        pieces = re.split(r'\s+(?=' + NUMW + r'\b)', text)
        low_ok = all(re.fullmatch(r"[a-z0-9 ,.%/()\-]*", p.split(' ', 1)[1]) if ' ' in p else True for p in pieces)
        if 2 <= len(pieces) <= want and low_ok:
            return [p.strip(' .') for p in pieces]
    # 1) amount/fine patterns
    parts = re.findall(AMT, text)
    if len(parts) >= 2:
        # check the parts cover the text approximately
        rebuilt = ' '.join(parts)
        if len(rebuilt) >= 0.8 * len(text):
            return [p.strip(' .') for p in parts][:want] if len(parts) <= want else None
    # 2) repeated leading capital word (e.g. Driving..., Using...)
    first = text.split()[0]
    if len(first) > 3 and text.count(first) >= 2:
        idxs = [m.start() for m in re.finditer(r'(?<= )' + re.escape(first) + r'(?= )', text)]
        pieces = []
        starts = [0] + idxs
        for a, b in zip(starts, starts[1:] + [len(text)]):
            pieces.append(text[a:b].strip())
        if 2 <= len(pieces) <= want:
            return pieces
    # 3) split after 'fine'/'penalty' followed by capital
    pieces = re.split(r'(?<=fine)\s+(?=[A-Z“"(])|(?<=penalty)\s+(?=[A-Z“"(])', text)
    if 2 <= len(pieces) <= want:
        return [p.strip() for p in pieces]
    return None

questions = []
failures = []
for zi, zn in enumerate(zones):
    units = zn['units']
    if not units:
        questions.append({'q': zn['q'], 'options': [], 'answer': None, 'images': zn['imgs'], 'zone': zi})
        continue
    greens = [i for i, (t, g) in enumerate(units) if g]
    n = len(units)
    opts = None
    ans = None
    if n == 4 and len(greens) == 1:
        opts = [t for t, g in units]; ans = greens[0]
    else:
        # try merging lowercase continuations into previous unit
        merged = []
        for t, g in units:
            if merged and t and t[0].islower() and not merged[-1][1] == g is None:
                pass
            if merged and t and (t[0].islower() or merged[-1][0].endswith((' and', ' of', ' the', ' a', ' to', ' or', ','))) and merged[-1][1] == g:
                merged[-1][0] += ' ' + t
            else:
                merged.append([t, g])
        units2 = [(t, g) for t, g in merged]
        greens2 = [i for i, (t, g) in enumerate(units2) if g]
        if len(units2) == 4 and len(greens2) == 1:
            opts = [t for t, g in units2]; ans = greens2[0]
        elif len(units2) < 4 and len(greens2) == 1:
            # need splitting of multi-option units
            need = 4 - len(units2)
            newu = []
            ok = True
            for t, g in units2:
                if need > 0 and not g:
                    sp = split_plain(t, need + 1)
                    if sp and len(sp) > 1:
                        newu += [[p, False] for p in sp]
                        need -= (len(sp) - 1)
                        continue
                newu.append([t, g])
            # also try splitting the green unit if still short (green covering 4 options)
            if need > 0:
                for i, (t, g) in enumerate(newu):
                    if g:
                        sp = split_plain(t, need + 1)
                        if sp and len(sp) > 1:
                            # first piece is the true green (answer is first in green run order? ambiguous) -> mark failure
                            ok = False
                        break
            g3 = [i for i, (t, g) in enumerate(newu) if g]
            if ok and len(newu) == 4 and len(g3) == 1:
                opts = [t for t, g in newu]; ans = g3[0]
    if opts:
        questions.append({'q': zn['q'], 'options': opts, 'answer': ans, 'images': zn['imgs'], 'zone': zi})
    else:
        failures.append({'zone': zi, 'q': zn['q'], 'units': [[t, g] for t, g in units], 'images': zn['imgs']})
        questions.append({'q': zn['q'], 'options': [t for t, g in units], 'answer': (greens[0] if len(greens) == 1 else None), 'images': zn['imgs'], 'zone': zi, 'bad': True})

good = [q for q in questions if not q.get('bad')]
print("zones:", len(zones), "good:", len(good), "failures:", len(failures))
json.dump(questions, open(SP + r"\questions_v4.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(failures, open(SP + r"\failures_v4.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
