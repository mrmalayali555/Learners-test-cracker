# -*- coding: utf-8 -*-
"""Generate trust/authority pages (About, Contact, Privacy, Terms)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://rto-cracker.vercel.app'
CSSV = '8'

FOOTER = '''<footer class="site-footer"><div style="max-width:820px;margin:0 auto">
<strong>RTO CRACKER</strong> — Free Kerala learners licence test practice.
<div class="foot-note"><a href="/">Home</a> · <a href="/traffic-signs.html">Traffic Signs</a> · <a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></div>
<div class="foot-note">Educational content based on the official Kerala learners test syllabus. Not affiliated with any government body.</div>
</div></footer>'''

def shell(slug, title, desc, body):
    url = f"{BASE}/{slug}.html"
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{title} | RTO Cracker</title>
<meta name="description" content="{desc}"/>
<meta name="robots" content="index, follow"/>
<meta name="theme-color" content="#245fa6"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="RTO Cracker"/>
<meta property="og:title" content="{title} | RTO Cracker"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:url" content="{url}"/>
<meta property="og:image" content="{BASE}/og-image.png"/>
<link rel="icon" type="image/png" href="/logo.png"/>
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<script>try{{if(JSON.parse(localStorage.getItem('rto_theme'))==='dark')document.documentElement.classList.add('dark');}}catch(e){{}}</script>
<link rel="stylesheet" href="/app.css?v={CSSV}"/>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<header class="article-header"><div class="article-header-inner">
<a href="/" class="brand-link"><img src="/logo.png" alt="RTO Cracker logo" width="30" height="30" style="border-radius:6px"/> RTO CRACKER</a>
<a href="/" class="btn btn-primary ah-cta">Practice Free →</a>
</div></header>
<main class="article" id="main">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>{title}</span></nav>
{body}
<p style="margin-top:24px"><a href="/">&larr; Back to RTO Cracker</a></p>
</main>
{FOOTER}
</body>
</html>
'''

PAGES = {
"about": ("About RTO Cracker",
 "About RTO Cracker — a free practice platform for the Kerala learners licence (LLR) test with real question-bank questions, traffic sign images and timed mock tests.",
 '''<h1>About RTO Cracker</h1>
<p class="lede">RTO Cracker is a free, independent study tool that helps learners in Kerala prepare for and pass the learners licence (LLR) driving test.</p>
<h2>What we do</h2>
<p>We turn the official Kerala learners test syllabus into an interactive practice experience: 827 real question-bank questions, traffic-sign images, topic-by-topic practice, and timed mock tests that mirror the real RTO computer test (30 questions, 30 seconds each, 18 to pass).</p>
<h2>Our mission</h2>
<p>Passing the learners test should not depend on expensive coaching or memorising a printed booklet. RTO Cracker makes quality practice free and accessible on any phone or computer, so anyone can walk into the RTO test with confidence.</p>
<h2>How we source and check content</h2>
<p>Our question bank is based on the official Kerala learners test syllabus and standard Indian road-sign definitions. Explanatory guides are written in plain language and reviewed for accuracy. Traffic rules, fines and procedures can change, so we encourage every learner to confirm current details with the official <strong>Kerala Motor Vehicles Department</strong> and the <strong>Parivahan</strong> portal before their test or application.</p>
<h2>Independence</h2>
<p>RTO Cracker is an educational project and is <strong>not affiliated with, endorsed by, or an official service of</strong> any government body or the Motor Vehicles Department. It does not issue licences or accept applications.</p>
<h2>Contact</h2>
<p>Questions or corrections? See our <a href="/contact.html">contact page</a>. We welcome feedback that helps us keep the content accurate and helpful.</p>'''),

"contact": ("Contact",
 "Contact RTO Cracker with feedback, questions or content corrections about the Kerala learners licence test practice platform.",
 '''<h1>Contact RTO Cracker</h1>
<p class="lede">We'd love your feedback — especially corrections that keep our content accurate.</p>
<h2>Get in touch</h2>
<ul>
<li><strong>Instagram:</strong> <a href="https://www.instagram.com/justinkjames.xyz/" rel="nofollow" target="_blank">@justinkjames.xyz</a></li>
</ul>
<h2>Reporting a content error</h2>
<p>If you spot a question, answer or explanation that looks wrong, please tell us which topic and question it relates to so we can review and fix it quickly. Accuracy matters to us.</p>
<h2>A note on official queries</h2>
<p>RTO Cracker is a study tool, not a government service. For licence applications, test bookings, fees or legal questions, please contact the official <strong>Kerala Motor Vehicles Department</strong> or use the <strong>Parivahan</strong> portal.</p>'''),

"privacy": ("Privacy Policy",
 "How RTO Cracker handles your data: local progress storage, optional Firebase sign-in, and privacy-respecting analytics.",
 '''<h1>Privacy Policy</h1>
<p class="lede">Last updated: 15 July 2026. This policy explains what data RTO Cracker collects and why.</p>
<h2>Progress stored on your device</h2>
<p>When you practise, your answers, saved questions and mock-test results are stored in your browser's local storage on your own device. If you never sign in, this data stays on your device and is not uploaded.</p>
<h2>Optional account (Firebase)</h2>
<p>If you choose to sign in with email or Google, we use Google Firebase to create your account and to save your progress in the cloud so it syncs across your devices. In that case we store your name, email address, a unique account ID, and your quiz progress. We never see or store your Google password.</p>
<h2>What we do not do</h2>
<p>We do not sell your personal data, and we do not use it for advertising profiles. Your quiz data is used only to run the app and sync your progress.</p>
<h2>Analytics</h2>
<p>We use Google Analytics 4, Google Tag Manager and Microsoft Clarity to understand how the site is used (for example which topics are popular) and to improve it. These tools may collect anonymised usage data such as pages viewed, device type and interaction events. Clarity may record anonymised interaction heatmaps. You can block these with browser privacy settings or extensions.</p>
<h2>Cookies and local storage</h2>
<p>We use local storage for your progress and theme preference, and the analytics tools above may set cookies. No advertising cookies are used.</p>
<h2>Your choices and rights</h2>
<p>You can practise entirely as a guest without an account. If you have an account, you can delete it at any time from the Profile screen, which removes your stored progress. You can also clear your browser data to remove locally stored progress.</p>
<h2>Children</h2>
<p>The service is intended for people preparing for a driving licence and is not directed at young children.</p>
<h2>Changes</h2>
<p>We may update this policy; the "last updated" date above will change accordingly.</p>'''),

"terms": ("Terms of Use",
 "Terms of use for RTO Cracker, a free educational practice platform for the Kerala learners licence test.",
 '''<h1>Terms of Use</h1>
<p class="lede">Last updated: 15 July 2026. By using RTO Cracker you agree to these terms.</p>
<h2>Educational use only</h2>
<p>RTO Cracker is a free study tool to help you prepare for the Kerala learners licence test. It is provided for educational and practice purposes only.</p>
<h2>No guarantee</h2>
<p>We work hard to keep our content accurate and aligned with the official syllabus, but we cannot guarantee that every question, answer or explanation is complete, current or error-free. Using RTO Cracker does not guarantee that you will pass the official test. Always verify current rules, signs, fees and procedures with the official Kerala Motor Vehicles Department.</p>
<h2>Not an official or government service</h2>
<p>RTO Cracker is independent and is not affiliated with, endorsed by, or operated on behalf of any government body. It does not issue licences, accept applications, or take fees for any official process.</p>
<h2>Acceptable use</h2>
<p>Please use the site fairly. Do not attempt to disrupt the service, misuse accounts, or scrape or republish the content in bulk without permission.</p>
<h2>Liability</h2>
<p>The service is provided "as is" without warranties of any kind. To the extent permitted by law, we are not liable for any loss arising from use of, or reliance on, the content.</p>
<h2>Changes</h2>
<p>We may update these terms; continued use after changes means you accept the updated terms.</p>'''),
}

def main():
    for slug,(title,desc,body) in PAGES.items():
        with open(os.path.join(ROOT, slug + '.html'),'w',encoding='utf-8') as f:
            f.write(shell(slug, title, desc, body))
        print("wrote", slug + '.html')

if __name__ == '__main__':
    main()
