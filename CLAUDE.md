# Tourist Vocab: Project Context

## Purpose
This is an experiment to test the workflow of building software with Claude Code. Keep the app small and simple.

## Product
A flash-card app that helps tourists quickly learn the most commonly used words in a language, so they can express themselves without needing grammar.

- Vocabulary only. No grammar, no teaching, no sentence building.
- Words are ordered by usefulness to a tourist (most common and most practical first).
- The 100 words are split into lessons of 10 words. A "lesson" is only a batch of words, not a taught lesson.
- There is no forced learning path. Every lesson is open from the start and the user picks any lesson in any order, so they can skip what they know and redo what they have forgotten.

## Core features (v1)
- The user picks a language.
- The main page lists every lesson. The user selects the lesson they want.
  - Lessons are grouped by frequency, not by theme: lesson 1 is words 1 to 10, lesson 2 is words 11 to 20, and so on. This may change to themes later by reordering the word list.
  - Each lesson on the main page shows its 10 English words (no translations).
- The top of the main page has a short guide that explains literal meanings and accents, and advises the user to copy the accent of local speakers and not to use the accent of their own language.
- Each flash card shows an English word on the front.
- The user taps to flip the card. The back shows the translation and a simple pronunciation guide (romanised for non-Latin scripts).
  - Some words also show a literal meaning, such as toilet "(literally: room water)", so the user can reuse the parts in other contexts.
- The user marks each card "Got it" or "Again".
  - "Got it" removes the card from the list.
  - "Again" moves the card to the end of the list.

## Out of scope for v1
Grammar, taught lessons, locked or ordered learning paths, saved progress, quizzes, user accounts, streaks, points and other gamification.

## Tech stack
- Plain HTML, CSS and vanilla JavaScript.
  - No frameworks, no TypeScript and no build step.
- Word lists are static JSON files, one per language, in `/data`.
- Nothing is saved between visits. A page refresh returns to the lesson list.
- There is no backend in v1.
- The app installs on a phone as a web app ("Add to Home Screen") and works offline.
  - `manifest.json` holds the app name, icons and colours. The icons in `/icons` are placeholders.
  - `service-worker.js` saves every app file and audio file on the phone. It tries the internet first and uses the saved copy when offline. A new file that the app needs must be added to its `APP_FILES` list.
- The app is hosted on GitHub Pages from the `main` branch of the public repository `drkrisanderson/tourist-vocab`. Pushing to `main` publishes the change.
- The layout is designed for mobile first.

## Word data format
Each entry in a word list looks like this:

```json
{ "id": "es-001", "english": "thank you", "target": "gracias", "pronunciation": "GRAH-see-ahs", "category": "basics" }
```

- `literal` is an optional extra field, used only when a word has a literal meaning: `"literal": "room water"`.
- Pronunciation is kept simple, because this is an introductory app:
  - Lower case, with hyphens between syllables.
  - Use plain `p` and `t`, never `bp` or `dt`.
  - Tones are not shown, except where two words would otherwise look the same. There, use an accent from European languages (near is `glâi`, far is `glai`).

## Coding rules
- The user knows JavaScript only. Keep code readable: small functions, clear names, and comments on any non-obvious logic.
- Add no external libraries unless the user agrees first.
- After each change, explain in plain terms what changed and why.

## Workflow
- Before writing code for each feature, propose a short plan and wait for approval.
- Build one feature at a time. Run and test it before moving on.
- When debugging, add console logs. If a fix fails twice, stop and propose a different approach.
- Update this file whenever a decision changes.

## Open decisions
- Start with the Thai language.
- Use the top 100 most commonly used words in the language.
- Audio pronunciation uses pre-made MP3 files, one per word, in `/audio/th`, named by word id (such as `th-029.mp3`). A "Listen" button under the card plays the file.
  - The files are generated once with Google Cloud Text-to-Speech by `tools/generate-audio.js`. This script is a tool, not part of the app.
  - Words said only by men (`th-003` and `th-009`) use a male voice. Every other word uses a female voice.
  - The Google API key lives in `tools/api-key.txt`. It must never be published with the app.
  - Recordings by a Thai speaker could replace the generated files later, with no code change.
- The Thai word list in `data/th.json` was drafted by Claude and accepted by the user "for now". The ranking is Claude's judgment of usefulness to a tourist, not a measured frequency list, and no Thai speaker has checked it yet.
