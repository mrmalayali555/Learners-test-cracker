# -*- coding: utf-8 -*-
import json, re, os

SP = r"C:\Users\jaisi\AppData\Local\Temp\claude\C--Users-jaisi-Downloads-last\9a4a9024-e46a-4b60-b01d-c3bfeac7f2ac\scratchpad"
qs = json.load(open(SP + r"\questions_v4.json", encoding="utf-8"))

fixes = {}
for i in (1, 2, 3, 4, 5):
    fixes.update(json.load(open(SP + rf"\fixes_{i}.json", encoding="utf-8")))

final = []
unresolved = []
for q in qs:
    z = str(q['zone'])
    imgs = q.get('images', [])
    if z in fixes:
        fx = fixes[z]
        if fx.get('drop'):
            continue
        if 'multi' in fx:
            for j, sub in enumerate(fx['multi']):
                e = {'q': sub['q'], 'options': sub['options'], 'answer': sub['answer'],
                     'images': imgs if (j == 0 and re.search(r'picture|figure|shown|below', sub['q'], re.I)) else
                               (imgs if re.search(r'picture|figure|shown|below', sub['q'], re.I) else [])}
                final.append(e)
        else:
            final.append({'q': fx.get('q', q['q']), 'options': fx['options'], 'answer': fx['answer'], 'images': imgs})
    elif q.get('bad'):
        unresolved.append(q)
    else:
        final.append({'q': q['q'], 'options': q['options'], 'answer': q['answer'], 'images': imgs})

print("final (pre-clean):", len(final), "| unresolved bad:", len(unresolved))
for u in unresolved[:10]:
    print("  UNRESOLVED zone", u['zone'], repr(u['q'][:60]), len(u['options']))

# ---- cleanup ----
def tidy(t):
    t = re.sub(r'\bPrevious Next\b', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'^[\\\.\d]+\s*', '', t) if re.match(r'^[\\\.]|^\d+\.\s', t) else t
    return t.strip()

IMG_HINT = re.compile(r'picture|figure|image|shown|below|this sign', re.I)
cleaned = []
for q in final:
    q['q'] = tidy(q['q'])
    q['options'] = [tidy(o) for o in q['options']]
    if not q['q'] or len(q['options']) != 4 or q['answer'] is None or not (0 <= q['answer'] < 4):
        unresolved.append(q); continue
    # images: keep only for questions that reference an image; keep unique order
    if IMG_HINT.search(q['q']):
        seen = set(); im = []
        for i in q['images']:
            if i not in seen:
                seen.add(i); im.append(i)
        q['images'] = im
    else:
        q['images'] = []
    cleaned.append(q)

# shift second image of a 2-image question to the next picture-question lacking one
for i in range(len(cleaned) - 1):
    a, b = cleaned[i], cleaned[i + 1]
    if len(a['images']) == 2 and not b['images'] and IMG_HINT.search(b['q']):
        b['images'] = [a['images'].pop()]

# dedupe on normalized question+answer text
seen = {}
deduped = []
for q in cleaned:
    key = (q['q'].lower()[:80], q['options'][q['answer']].lower()[:40])
    if key in seen:
        # prefer the one with images
        if q['images'] and not seen[key]['images']:
            seen[key]['images'] = q['images']
        continue
    seen[key] = q
    deduped.append(q)

# ---- categorize ----
def cat(q):
    t = q['q'].lower()
    o = ' '.join(q['options']).lower()
    if q['images'] and ('traffic sign' in t or 'sign in this picture' in t):
        return 'signs'
    if 'hand signal' in t:
        return 'signals'
    if re.search(r'signal|traffic light|police officer.*signal|flashing (red|amber)', t):
        return 'signals'
    if re.search(r'line|marking|zebra|hatch|median|carriageway|lane|kerb|curb|junction|roundabout|box junction', t) and 'sign' not in t:
        return 'markings'
    if re.search(r'fine|penalty|punish|rs\.?\s?\d|rupees|offence|arrest|seize|section \d+|imprison', t + ' ' + o):
        return 'fines'
    if re.search(r'licen[cs]e|registration|insurance|permit|certificate|puc|documents|rto|form \d+|act,? \d{4}|section', t):
        return 'law'
    if re.search(r'should you do|safe|safety|avoid|precaution|accident|first aid|overtak|park|distance|speed|brake|skid|fog|rain|night|fatigue|alcohol|drunk|helmet|seat belt', t):
        return 'safety'
    return 'rules'

for i, q in enumerate(deduped):
    q['id'] = i + 1
    q['cat'] = cat(q)

from collections import Counter
print("total final:", len(deduped))
print(Counter(q['cat'] for q in deduped))
print("with images:", sum(1 for q in deduped if q['images']))
multi = [(q['id'], len(q['images'])) for q in deduped if len(q['images']) > 1]
print("multi-image:", len(multi), multi[:20])
noimg_but_pic = [q['id'] for q in deduped if not q['images'] and IMG_HINT.search(q['q'])]
print("mentions picture but no image:", len(noimg_but_pic), noimg_but_pic[:20])
json.dump(deduped, open(SP + r"\questions_final.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print("unresolved total:", len(unresolved))
