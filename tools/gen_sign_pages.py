# -*- coding: utf-8 -*-
"""Programmatic SEO generator for individual traffic-sign pages.
Reads the SIGNS list below (authored, unique content) and emits:
  /traffic-signs/<slug>.html   one quality page per sign
Run:  python tools/gen_sign_pages.py
"""
import os, json, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'traffic-signs')
BASE = 'https://rto-cracker.vercel.app'
CSSV = '8'

CAT_LABEL = {
    'mandatory': 'Mandatory (regulatory) sign',
    'cautionary': 'Cautionary (warning) sign',
    'informatory': 'Informatory sign',
}

# --- authored, genuinely-differentiated content per sign ---
SIGNS = [
  {"slug":"stop","name":"Stop","cat":"mandatory","img":"image1.jpeg","shape":"Red octagon with the word STOP in white",
   "meaning":"The Stop sign requires you to bring your vehicle to a complete halt at the stop line. You may proceed only after stopping fully and making sure the way is clear and it is safe to continue.",
   "where":"At junctions, level crossings and places where cross-traffic has priority or visibility is poor.",
   "action":"Stop completely at the stop line, look in all directions, give way to traffic on the main road, then move off when safe.",
   "mistake":"Slowing down without fully stopping — the test (and the law) treat a rolling stop as not stopping at all.",
   "related":["give-way","no-entry","pedestrian-crossing"]},
  {"slug":"give-way","name":"Give Way","cat":"mandatory","img":"image3.jpeg","shape":"Downward-pointing triangle with a red border on white",
   "meaning":"The Give Way sign tells you to slow down, be ready to stop, and give priority to traffic on the road you are joining or crossing. You do not always have to stop, but you must yield.",
   "where":"Where a minor road meets a major road, and at roundabouts and some junctions.",
   "action":"Slow down, watch traffic on the priority road, and proceed only when there is a safe gap.",
   "mistake":"Confusing Give Way with Stop — Give Way lets you keep moving if the way is clear; Stop always needs a full halt.",
   "related":["stop","pedestrian-crossing","school-ahead"]},
  {"slug":"no-entry","name":"No Entry","cat":"mandatory","img":"image4.jpeg","shape":"Red circle with a horizontal white bar",
   "meaning":"The No Entry sign means vehicles are prohibited from entering that road or lane in the direction you are facing. It is commonly used at the exit end of one-way streets.",
   "where":"At the wrong-way end of one-way roads and at restricted entrances.",
   "action":"Do not enter. Find an alternative route.",
   "mistake":"Assuming it only applies to cars — No Entry applies to all vehicles unless a plate says otherwise.",
   "related":["one-way-traffic","no-parking","horn-prohibited"]},
  {"slug":"horn-prohibited","name":"Horn Prohibited","cat":"mandatory","img":"image6.jpeg","shape":"Red circle with a horn symbol crossed out",
   "meaning":"The Horn Prohibited sign means you must not sound your horn in that zone. It protects silence zones near hospitals, schools and courts.",
   "where":"Near hospitals, schools, courts and other designated silence zones.",
   "action":"Do not use the horn. Drive slowly and rely on care and observation instead.",
   "mistake":"Thinking a quick honk is allowed — any horn use in the zone is an offence.",
   "related":["no-entry","no-parking","school-ahead"]},
  {"slug":"pedestrians-prohibited","name":"Pedestrians Prohibited","cat":"mandatory","img":"image8.jpeg","shape":"Red circle with a walking pedestrian crossed out",
   "meaning":"This sign means pedestrians are not allowed on that stretch of road, such as certain highways and expressways where walking is unsafe.",
   "where":"On expressways and high-speed roads where foot traffic is banned.",
   "action":"As a driver, expect no pedestrians; as a pedestrian, use an alternative path.",
   "mistake":"Reading it as 'pedestrian crossing' — the red circle means prohibited, not a crossing.",
   "related":["pedestrian-crossing","no-entry","give-way"]},
  {"slug":"compulsory-keep-left","name":"Compulsory Keep Left","cat":"mandatory","img":"image21.jpeg","shape":"Blue circle with a white arrow pointing left/down",
   "meaning":"A blue circular sign giving a positive command: you must keep to the left. Blue mandatory signs tell you what you must do, unlike red signs that prohibit.",
   "where":"At traffic islands and medians where traffic must pass on the left.",
   "action":"Keep to the left of the island or divider as directed.",
   "mistake":"Ignoring it because it is not red — blue command signs are equally compulsory.",
   "related":["compulsory-left-turn","one-way-traffic","give-way"]},
  {"slug":"compulsory-left-turn","name":"Compulsory Left Turn","cat":"mandatory","img":"image17.jpeg","shape":"Blue circle with a white arrow curving left",
   "meaning":"This blue command sign means you are required to turn left ahead; other directions are not permitted.",
   "where":"At junctions where only a left turn is allowed.",
   "action":"Signal and turn left; do not go straight or turn right.",
   "mistake":"Treating it as optional guidance — it is a mandatory instruction.",
   "related":["compulsory-keep-left","u-turn-prohibited","one-way-traffic"]},
  {"slug":"u-turn-prohibited","name":"U-Turn Prohibited","cat":"mandatory","img":"image11.jpeg","shape":"Red circle with a U-turn arrow crossed out",
   "meaning":"The U-Turn Prohibited sign means you must not make a U-turn at that location.",
   "where":"At busy junctions, medians and stretches where turning back would be dangerous.",
   "action":"Continue and take the next permitted turning point instead.",
   "mistake":"Confusing it with 'right turn prohibited' — check whether the crossed-out arrow is a U-shape.",
   "related":["compulsory-left-turn","no-entry","one-way-traffic"]},
  {"slug":"one-way-traffic","name":"One-Way Traffic","cat":"mandatory","img":"image5.jpeg","shape":"Blue rectangle with a white arrow",
   "meaning":"The One-Way sign shows that traffic on that road flows in a single direction, indicated by the arrow.",
   "where":"At the entry of one-way roads and lanes.",
   "action":"Drive only in the arrow's direction; never against it.",
   "mistake":"Mixing it up with No Entry, which marks the forbidden end of a one-way road.",
   "related":["no-entry","compulsory-keep-left","u-turn-prohibited"]},
  {"slug":"school-ahead","name":"School Ahead","cat":"cautionary","img":"image43.jpeg","shape":"Red-bordered triangle with two children",
   "meaning":"A warning sign alerting you that a school is ahead and children may be crossing. Extra caution is essential.",
   "where":"Before schools and areas with heavy child pedestrian activity.",
   "action":"Slow right down, watch for children, and be ready to stop.",
   "mistake":"Speeding up to pass quickly — school zones need the slowest, most careful driving.",
   "related":["pedestrian-crossing","give-way","cattle"]},
  {"slug":"pedestrian-crossing","name":"Pedestrian Crossing","cat":"cautionary","img":"image41.jpeg","shape":"Red-bordered triangle with a pedestrian on a crossing",
   "meaning":"This warning sign indicates a pedestrian crossing ahead where people may be crossing the road.",
   "where":"Before zebra crossings in towns and near markets and schools.",
   "action":"Slow down and give way to anyone on or stepping onto the crossing.",
   "mistake":"Confusing the warning triangle with the blue 'pedestrian crossing' information square.",
   "related":["school-ahead","pedestrians-prohibited","give-way"]},
  {"slug":"narrow-bridge-ahead","name":"Narrow Bridge Ahead","cat":"cautionary","img":"image37.jpeg","shape":"Red-bordered triangle showing a narrowing bridge",
   "meaning":"Warns that a narrow bridge is ahead where the road width reduces and only limited vehicles can pass at a time.",
   "where":"Before bridges narrower than the approaching road.",
   "action":"Slow down, judge oncoming traffic, and give way if the other vehicle is closer.",
   "mistake":"Assuming you have priority — whoever is nearer the bridge usually goes first.",
   "related":["slippery-road","right-hairpin-bend","give-way"]},
  {"slug":"right-hairpin-bend","name":"Right Hairpin Bend","cat":"cautionary","img":"image29.jpeg","shape":"Red-bordered triangle showing a sharp right hairpin",
   "meaning":"Warns of a very sharp right-hand bend ahead, common on ghat and hill roads.",
   "where":"On winding hill and ghat roads in Kerala's high ranges.",
   "action":"Reduce speed well before the bend, stay in your lane, and use a low gear on descents.",
   "mistake":"Braking hard inside the bend instead of slowing before it.",
   "related":["left-hairpin-bend","steep-descent","slippery-road"]},
  {"slug":"left-hairpin-bend","name":"Left Hairpin Bend","cat":"cautionary","img":"image30.jpeg","shape":"Red-bordered triangle showing a sharp left hairpin",
   "meaning":"Warns of a very sharp left-hand bend ahead.",
   "where":"On hill and ghat roads with tight turns.",
   "action":"Slow down before the bend, keep left, and watch for oncoming vehicles cutting the corner.",
   "mistake":"Overtaking near the bend where visibility is blocked.",
   "related":["right-hairpin-bend","steep-descent","narrow-bridge-ahead"]},
  {"slug":"slippery-road","name":"Slippery Road","cat":"cautionary","img":"image38.jpeg","shape":"Red-bordered triangle with a skidding car",
   "meaning":"Warns that the road ahead may be slippery, especially in rain, and vehicles can skid.",
   "where":"On stretches prone to water, oil or loose surface — frequent in the monsoon.",
   "action":"Reduce speed, avoid sudden braking or steering, and increase your following distance.",
   "mistake":"Braking sharply on the slippery stretch, which triggers a skid.",
   "related":["falling-rocks","right-hairpin-bend","steep-descent"]},
  {"slug":"falling-rocks","name":"Falling Rocks","cat":"cautionary","img":"image45.jpeg","shape":"Red-bordered triangle showing rocks falling down a slope",
   "meaning":"Warns that rocks or debris may fall onto the road from the hillside ahead.",
   "where":"On cut-hill roads and ghat sections, especially after rain.",
   "action":"Stay alert, avoid stopping under the slope, and watch for debris on the carriageway.",
   "mistake":"Parking or halting directly beneath the rock-fall zone.",
   "related":["slippery-road","steep-descent","right-hairpin-bend"]},
  {"slug":"steep-descent","name":"Steep Descent","cat":"cautionary","img":"image34.jpeg","shape":"Red-bordered triangle showing a downward gradient",
   "meaning":"Warns of a steep downhill gradient ahead where vehicles can gather speed quickly.",
   "where":"On ghat roads and hilly descents.",
   "action":"Engage a low gear before the descent and use engine braking; avoid riding the brakes.",
   "mistake":"Coasting in neutral or on the clutch, which removes engine braking and overheats the brakes.",
   "related":["right-hairpin-bend","slippery-road","falling-rocks"]},
  {"slug":"cattle","name":"Cattle on Road","cat":"cautionary","img":"image42.jpeg","shape":"Red-bordered triangle with a cow",
   "meaning":"Warns that cattle or animals may be on the road ahead.",
   "where":"On rural roads and near grazing areas and villages.",
   "action":"Slow down, be ready to stop, and pass only when the animals are clear.",
   "mistake":"Honking aggressively, which can startle animals into the road.",
   "related":["school-ahead","give-way","pedestrian-crossing"]},
  {"slug":"hospital","name":"Hospital","cat":"informatory","img":"image62.jpeg","shape":"Blue rectangle with an 'H' symbol",
   "meaning":"An informatory sign showing that a hospital is nearby. It guides you and reminds you to keep noise low.",
   "where":"On approaches to hospitals.",
   "action":"Drive quietly and carefully; avoid unnecessary horn use.",
   "mistake":"Ignoring the linked silence zone and honking near the hospital.",
   "related":["horn-prohibited","bus-stop","cycle-track"]},
  {"slug":"bus-stop","name":"Bus Stop","cat":"informatory","img":"image16.jpeg","shape":"Blue rectangle with a bus symbol",
   "meaning":"An informatory sign marking a bus stop ahead where buses halt and passengers board or alight.",
   "where":"At designated bus stops along the road.",
   "action":"Expect buses to slow and stop; watch for pedestrians around the stop.",
   "mistake":"Overtaking a stopped bus without checking for people crossing in front of it.",
   "related":["pedestrian-crossing","hospital","cycle-track"]},
  {"slug":"cycle-track","name":"Cycle Track","cat":"informatory","img":"image40.jpeg","shape":"Blue rectangle with a bicycle symbol",
   "meaning":"An informatory sign indicating a dedicated track for cyclists ahead.",
   "where":"Where a separate cycle path runs alongside the road.",
   "action":"Do not drive or park on the cycle track; watch for cyclists joining the road.",
   "mistake":"Using the cycle track as an extra lane or parking space.",
   "related":["bus-stop","hospital","pedestrian-crossing"]},
]

BY_SLUG = {s['slug']: s for s in SIGNS}

FOOTER = '''<footer class="site-footer"><div style="max-width:820px;margin:0 auto">
<strong>RTO CRACKER</strong> — Free Kerala learners licence test practice.
<div class="foot-note"><a href="/">Home</a> · <a href="/traffic-signs.html">Traffic Signs Guide</a> · <a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></div>
<div class="foot-note">Educational content based on the official Kerala learners test syllabus. Not affiliated with any government body. Always confirm current rules with the Kerala Motor Vehicles Department.</div>
</div></footer>'''

def esc(t): return html.escape(t, quote=True)

def page(s):
    title = f"{s['name']} Sign — Meaning for the Kerala Learners Test | RTO Cracker"
    desc = f"{s['name']} traffic sign meaning for the Kerala learners licence (LLR) test: {s['meaning'][:110]}"
    url = f"{BASE}/traffic-signs/{s['slug']}.html"
    related = [BY_SLUG[r] for r in s['related'] if r in BY_SLUG]
    rel_html = ''.join(
        f'<li><a href="/traffic-signs/{r["slug"]}.html">{esc(r["name"])} sign</a> — {esc(CAT_LABEL[r["cat"]].split(" (")[0].lower())}</li>'
        for r in related)
    faq = [
        (f"What does the {s['name']} sign mean?", s['meaning']),
        (f"What shape is the {s['name']} sign?", s['shape'] + "."),
        (f"What should a driver do at a {s['name']} sign?", s['action']),
    ]
    faq_ld = ",".join(
        json.dumps({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}}, ensure_ascii=False)
        for q,a in faq)
    faq_html = ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q,a in faq)
    ld = f'''{{
  "@context":"https://schema.org","@graph":[
    {{"@type":"BreadcrumbList","itemListElement":[
      {{"@type":"ListItem","position":1,"name":"Home","item":"{BASE}/"}},
      {{"@type":"ListItem","position":2,"name":"Traffic Signs","item":"{BASE}/traffic-signs.html"}},
      {{"@type":"ListItem","position":3,"name":"{esc(s['name'])} sign","item":"{url}"}}
    ]}},
    {{"@type":"ImageObject","contentUrl":"{BASE}/assets/signs/{s['img']}","name":"{esc(s['name'])} traffic sign","caption":"{esc(s['meaning'])}"}},
    {{"@type":"FAQPage","mainEntity":[{faq_ld}]}}
  ]}}'''
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}"/>
<meta name="robots" content="index, follow, max-image-preview:large"/>
<meta name="theme-color" content="#245fa6"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="RTO Cracker"/>
<meta property="og:title" content="{esc(s['name'])} Sign — Meaning for the Kerala Learners Test"/>
<meta property="og:description" content="{esc(s['meaning'])}"/>
<meta property="og:url" content="{url}"/>
<meta property="og:image" content="{BASE}/assets/signs/{s['img']}"/>
<meta property="og:locale" content="en_IN"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{esc(s['name'])} Sign — Kerala Learners Test"/>
<meta name="twitter:description" content="{esc(s['meaning'])}"/>
<meta name="twitter:image" content="{BASE}/assets/signs/{s['img']}"/>
<link rel="icon" type="image/png" href="/logo.png"/>
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<script>try{{if(JSON.parse(localStorage.getItem('rto_theme'))==='dark')document.documentElement.classList.add('dark');}}catch(e){{}}</script>
<link rel="stylesheet" href="/app.css?v={CSSV}"/>
<script type="application/ld+json">
{ld}
</script>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<header class="article-header"><div class="article-header-inner">
<a href="/" class="brand-link"><img src="/logo.png" alt="RTO Cracker logo" width="30" height="30" style="border-radius:6px"/> RTO CRACKER</a>
<a href="/#signs" class="btn btn-primary ah-cta">Practice Signs →</a>
</div></header>
<main class="article" id="main">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/traffic-signs.html">Traffic Signs</a> &rsaquo; <span>{esc(s['name'])}</span></nav>
<h1>{esc(s['name'])} Sign</h1>
<p class="lede">{esc(CAT_LABEL[s['cat']])} · Kerala learners licence test</p>
<figure class="sign-example" style="max-width:200px;margin:16px 0"><img src="/assets/signs/{s['img']}" alt="{esc(s['name'])} traffic sign" width="120" height="120" style="height:120px"/><figcaption>{esc(s['name'])}</figcaption></figure>
<h2>Meaning</h2><p>{esc(s['meaning'])}</p>
<h2>Shape &amp; colour</h2><p>{esc(s['shape'])}. {esc(CAT_LABEL[s['cat']])}.</p>
<h2>Where you'll see it</h2><p>{esc(s['where'])}</p>
<h2>What to do</h2><p>{esc(s['action'])}</p>
<h2>Common test mistake</h2><p>{esc(s['mistake'])}</p>
<div class="article-cta"><h2>Practise this sign free</h2><p>See it in real exam questions with instant feedback.</p><a href="/#signs" class="btn btn-primary">Start Traffic Signs practice →</a></div>
<h2>Related signs</h2><ul>{rel_html}</ul>
<h2>FAQ</h2><div class="faq-block">{faq_html}</div>
<p style="margin-top:24px"><a href="/traffic-signs.html">&larr; Back to the full Traffic Signs guide</a></p>
</main>
{FOOTER}
</body>
</html>
'''

def main():
    os.makedirs(OUT, exist_ok=True)
    for s in SIGNS:
        with open(os.path.join(OUT, s['slug'] + '.html'), 'w', encoding='utf-8') as f:
            f.write(page(s))
    # emit the list of URLs for the sitemap + hub
    urls = [f"/traffic-signs/{s['slug']}.html" for s in SIGNS]
    json.dump({"signs": [{"slug":s['slug'],"name":s['name'],"cat":s['cat'],"img":s['img']} for s in SIGNS]},
              open(os.path.join(ROOT,'tools','signs_index.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"generated {len(SIGNS)} sign pages")
    for u in urls: print("  ", u)

if __name__ == '__main__':
    main()
