# -*- coding: utf-8 -*-
"""AI-assisted generation of quality pillar pages for real keyword clusters.
Uses the NVIDIA Nemotron endpoint to DRAFT accurate, structured content, then
wraps it in the site template with schema + internal links.
Guardrails: the model is told not to fabricate specific fees/fines/dates.
Run:  python tools/gen_pillars.py
"""
import os, json, re, html, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://rto-cracker.vercel.app'
CSSV = '8'
KEY = os.getenv("NVIDIA_API_KEY", "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")

FOOTER = '''<footer class="site-footer"><div style="max-width:820px;margin:0 auto">
<strong>RTO CRACKER</strong> — Free Kerala learners licence test practice.
<div class="foot-note"><a href="/">Home</a> · <a href="/traffic-signs.html">Traffic Signs</a> · <a href="/road-rules.html">Road Rules</a> · <a href="/road-markings.html">Road Markings</a> · <a href="/road-safety.html">Road Safety</a> · <a href="/learners-licence-kerala.html">Get Your LLR</a> · <a href="/about.html">About</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></div>
<div class="foot-note">Educational content based on the official Kerala learners test syllabus. Not affiliated with any government body. Always confirm current rules, fees and procedures with the Kerala Motor Vehicles Department and the Parivahan portal.</div>
</div></footer>'''

# slug -> (title, meta description, related-internal-links, keyword hints for the model)
PILLARS = {
"road-rules": (
  "Road Rules for the Kerala Learners Test",
  "Learn the key road rules for the Kerala learners licence test: overtaking, parking, speed limits, lane discipline, one-way roads and right of way — explained simply.",
  [("/traffic-signs.html","Traffic Signs guide"),("/road-markings.html","Road Markings"),("/road-safety.html","Road Safety"),("/#signs","Practice road-rule questions")],
  "road rules, overtaking rules, parking rules, speed limits, lane discipline, one-way, right of way, keep left"),
"road-markings": (
  "Road Markings Explained — Kerala Learners Test Guide",
  "Understand road markings for the Kerala learners test: yellow and white lines, single and double lines, zebra crossings, stop lines, edge lines and what each means.",
  [("/traffic-signs.html","Traffic Signs guide"),("/road-rules.html","Road Rules"),("/road-safety.html","Road Safety"),("/#markings","Practice road-marking questions")],
  "road markings, yellow line, white line, double line, zebra crossing, stop line, edge line, lane markings"),
"road-safety": (
  "Road Safety & Safe Driving — Kerala Learners Test Guide",
  "Road safety and safe-driving tips for the Kerala learners test: helmets, seat belts, safe following distance, driving in rain and fog, and avoiding common accidents.",
  [("/road-rules.html","Road Rules"),("/traffic-signs.html","Traffic Signs"),("/learners-licence-kerala.html","Get your LLR"),("/#safety","Practice safe-driving questions")],
  "road safety, helmet rules, seat belt rules, safe driving, following distance, driving in rain and fog, defensive driving"),
"learners-licence-kerala": (
  "How to Get Your Kerala Learners Licence (LLR) — Step-by-Step Guide",
  "A simple guide to getting your Kerala learners licence (LLR): who is eligible, documents needed, how to apply on Parivahan, the learners test, and validity.",
  [("/traffic-signs.html","Study Traffic Signs"),("/road-rules.html","Road Rules"),("/","Take a free mock test")],
  "Kerala LLR, learner licence, Parivahan, Kerala MVD, eligibility, documents, application, learners test, validity, fees"),
}

SYS = ("You are an expert Indian driving-education writer creating accurate study content for people in "
       "Kerala, India preparing for their learners licence (LLR) test. Write clear, factual, helpful content. "
       "IMPORTANT ACCURACY RULES: Do NOT invent specific fee amounts, fine amounts, or exact dates. When a "
       "legally-set figure would be relevant, write 'as per the current Motor Vehicles Act / Kerala MVD "
       "schedule (verify on the Parivahan portal)'. Stable facts you may state: a learners licence is valid "
       "for 6 months; the minimum age is 16 for a motorcycle without gear (with guardian consent) and 18 for "
       "other vehicles; applications are made online via the Parivahan Sarathi portal. Keep it India/Kerala-specific.")

def gen_body(title, hints):
    prompt = (f"Write the BODY HTML fragment for a web page titled \"{title}\". "
      f"Cover these related topics naturally (do not keyword-stuff): {hints}. "
      "Structure: start with one <p class=\"lede\">intro</p>, then 4 to 6 sections using <h2> and <p>/<ul><li>. "
      "Use a <table> where it helps (e.g. line colours or speed categories). "
      "End with <h2>Frequently asked questions</h2> then exactly 4 items each formatted as "
      "<details><summary>Question?</summary><p>Answer.</p></details>. "
      "Output ONLY the HTML fragment. Do NOT include <html>, <head>, <title>, <h1>, backticks, or markdown.")
    body = json.dumps({
      "model":"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      "messages":[{"role":"system","content":SYS},{"role":"user","content":prompt}],
      "temperature":0.5,"top_p":0.95,"max_tokens":4000,
      "chat_template_kwargs":{"enable_thinking":False},"stream":False}).encode()
    req=urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions",data=body,
      headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
    r=urllib.request.urlopen(req,timeout=180); d=json.load(r)
    txt=d['choices'][0]['message']['content'].strip()
    txt=re.sub(r'^```html\s*|```$','',txt.strip()).strip()
    txt=re.sub(r'<h1[^>]*>.*?</h1>','',txt,flags=re.S)  # strip any stray h1
    return txt

def faqs_from(body):
    out=[]
    for m in re.finditer(r'<summary>(.*?)</summary>\s*<p>(.*?)</p>', body, re.S):
        q=re.sub(r'<[^>]+>','',m.group(1)).strip()
        a=re.sub(r'<[^>]+>','',m.group(2)).strip()
        if q and a: out.append((q,a))
    return out[:6]

def build(slug, title, desc, links, body):
    url=f"{BASE}/{slug}.html"
    faq=faqs_from(body)
    faq_ld=",".join(json.dumps({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}},ensure_ascii=False) for q,a in faq)
    rel="".join(f'<li><a href="{h}">{html.escape(t)}</a></li>' for h,t in links)
    graph=[f'{{"@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"Home","item":"{BASE}/"}},{{"@type":"ListItem","position":2,"name":{json.dumps(title)},"item":"{url}"}}]}}',
      f'{{"@type":"Article","headline":{json.dumps(title)},"description":{json.dumps(desc)},"image":"{BASE}/og-image.png","inLanguage":"en-IN","author":{{"@type":"Organization","name":"RTO Cracker"}},"publisher":{{"@type":"Organization","name":"RTO Cracker","logo":{{"@type":"ImageObject","url":"{BASE}/icons/icon-512.png"}}}},"mainEntityOfPage":"{url}"}}']
    if faq_ld: graph.append(f'{{"@type":"FAQPage","mainEntity":[{faq_ld}]}}')
    ld='{"@context":"https://schema.org","@graph":['+",".join(graph)+']}'
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{html.escape(title)} | RTO Cracker</title>
<meta name="description" content="{html.escape(desc)}"/>
<meta name="robots" content="index, follow, max-image-preview:large"/>
<meta name="theme-color" content="#245fa6"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="RTO Cracker"/>
<meta property="og:title" content="{html.escape(title)}"/>
<meta property="og:description" content="{html.escape(desc)}"/>
<meta property="og:url" content="{url}"/>
<meta property="og:image" content="{BASE}/og-image.png"/>
<meta property="og:locale" content="en_IN"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{html.escape(title)}"/>
<meta name="twitter:description" content="{html.escape(desc)}"/>
<meta name="twitter:image" content="{BASE}/og-image.png"/>
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
<a href="/" class="btn btn-primary ah-cta">Practice Free →</a>
</div></header>
<main class="article" id="main">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>{html.escape(title)}</span></nav>
<h1>{html.escape(title)}</h1>
{body}
<div class="article-cta"><h2>Practise free with real exam questions</h2><p>Reading is good — testing yourself is better. Try the question bank with instant feedback.</p><a href="/" class="btn btn-primary">Start free practice →</a></div>
<h2>Related guides</h2>
<ul>{rel}</ul>
<p style="margin-top:24px"><a href="/">&larr; Back to RTO Cracker</a></p>
</main>
{FOOTER}
</body>
</html>
'''

def main():
    made=[]
    for slug,(title,desc,links,hints) in PILLARS.items():
        print("generating", slug, "...", flush=True)
        try:
            body=gen_body(title,hints)
        except Exception as e:
            print("  FAILED", slug, type(e).__name__, str(e)[:160]); continue
        open(os.path.join(ROOT, slug+'.html'),'w',encoding='utf-8').write(build(slug,title,desc,links,body))
        made.append(slug); print("  wrote", slug+'.html', "(", len(body), "chars )")
    json.dump(made, open(os.path.join(ROOT,'tools','pillars_made.json'),'w'))
    print("done:", made)

if __name__=='__main__':
    main()
