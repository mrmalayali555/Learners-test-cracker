# 🚗 RTO Practice Portal — Learners Test Cracker

A free practice website that helps anyone prepare for and pass the **Kerala learner's licence (LL) test**. Practice the real question bank topic by topic, then prove you're ready with timed mock tests that follow the actual RTO computer-test pattern.

## ✨ Features

- **827 real question-bank questions** across 7 topics:
  - 🚦 Traffic Signs (with actual sign images)
  - 👮 Signals & Police
  - 🛣️ Road Markings
  - 📖 Rules of the Road
  - 🦺 Safe Driving
  - 💰 Fines & Penalties
  - 📄 Licence & Documents
- **117 traffic-sign and road-diagram images** so you learn signs the way they appear in the exam
- **Practice mode** — instant right/wrong feedback with the correct answer shown
- **Mock tests** — 20 questions, 20-minute timer, pass mark 12/20, exactly like the real RTO test
- **Review Mistakes** — every wrong answer is collected automatically so you can re-practice it
- **Saved questions** — bookmark tricky questions for quick revision
- **Progress tracking** — syllabus coverage, accuracy, and mock-test history
- **Fully responsive** — works great on phones, tablets, and desktops

## 🌐 Run it

It's a static site — no build step needed.

```bash
# any static server works, e.g.
python -m http.server 8000
# then open http://localhost:8000
```

Or just deploy the repo directly to **Vercel / Netlify / GitHub Pages** (framework preset: *Other*, no build command, output = repo root).

## 🗂️ Project structure

```
index.html        # the app (single page)
app.js            # quiz engine, mock tests, progress, auth
app.css           # styles
questions.json    # full question bank (827 questions)
assets/signs/     # traffic-sign & diagram images
tools/            # scripts used to build questions.json from the source document
```

## 📝 Question bank

Questions are based on the official Kerala learner's test syllabus, extracted from the driving-school question bank and cleaned/verified by hand. Each question in `questions.json` has:

```json
{ "id": 1, "q": "…", "options": ["…","…","…","…"], "answer": 2, "cat": "signs", "img": "assets/signs/image1.jpeg" }
```

`answer` is the index (0–3) of the correct option; `img` is present only for picture questions.

---

Made to help every learner walk into the RTO test with confidence. Good luck with your exam! 🎉
