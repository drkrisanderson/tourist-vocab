// One-off tool: makes an MP3 file for every word in the word list,
// using Google Cloud Text-to-Speech. This is NOT part of the app.
//
// How to run (from the project folder):
//   1. Put your Google API key in tools/api-key.txt (just the key, nothing else).
//   2. node tools/generate-audio.js
//
// Words that already have a file are skipped.
// To remake chosen words, add their ids:
//   node tools/generate-audio.js th-023 th-031
// To remake chosen words with a different kind of voice (Chirp3-HD, Neural2 or Standard):
//   node tools/generate-audio.js th-032 --voice=Neural2
// To remake every file:
//   node tools/generate-audio.js --force

const fs = require("fs");
const path = require("path");

const LANGUAGE_CODE = "th-TH";
const WORD_LIST_FILE = path.join(__dirname, "..", "data", "th.json");
const AUDIO_FOLDER = path.join(__dirname, "..", "audio", "th");
const API_KEY_FILE = path.join(__dirname, "api-key.txt");
const API_URL = "https://texttospeech.googleapis.com/v1";

// These words are only said by men, so they get the male voice.
// Every other word gets the female voice.
const MALE_VOICE_WORD_IDS = ["th-003", "th-009"];

// Google has several kinds of voice. The kind to use comes first.
// Chirp3-HD sounds the most natural, but it clips or garbles very short words,
// so Neural2 is preferred. (Thai has no male Neural2 voice, so the male words use Chirp3-HD.)
const VOICE_KINDS_BEST_FIRST = ["Neural2", "Chirp3-HD", "Wavenet", "Standard"];

// A real word is at least a few thousand bytes. A smaller file is broken audio.
const MIN_AUDIO_BYTES = 1500;

function readApiKey() {
  if (!fs.existsSync(API_KEY_FILE)) {
    throw new Error("No API key found. Save your Google API key in tools/api-key.txt");
  }
  return fs.readFileSync(API_KEY_FILE, "utf8").trim();
}

// Sends one request to Google and returns the reply as an object.
async function callGoogle(apiKey, urlPath, body) {
  const options = { headers: { "X-Goog-Api-Key": apiKey } };
  if (body) {
    options.method = "POST";
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(API_URL + urlPath, options);
  const reply = await response.json();
  if (!response.ok) {
    throw new Error("Google replied " + response.status + ": " + reply.error.message);
  }
  return reply;
}

// Picks Thai voices of the given gender ("MALE" or "FEMALE"):
// one voice of each kind, best kind first. The first is the main voice,
// and the rest are backups for words the main voice gets wrong.
function pickVoices(voices, gender) {
  const picked = [];
  for (const kind of VOICE_KINDS_BEST_FIRST) {
    const voice = voices.find(function (candidate) {
      return candidate.ssmlGender === gender && candidate.name.includes(kind);
    });
    if (voice) {
      picked.push(voice);
    }
  }
  return picked;
}

function voiceNames(voices) {
  return voices.map(function (voice) {
    return voice.name;
  }).join(", ");
}

// Asks Google which Thai voices exist and chooses the female and male voices.
async function chooseVoices(apiKey) {
  const reply = await callGoogle(apiKey, "/voices?languageCode=" + LANGUAGE_CODE);
  const voices = reply.voices || [];
  const female = pickVoices(voices, "FEMALE");
  let male = pickVoices(voices, "MALE");

  if (female.length === 0) {
    throw new Error("Google has no female voice for " + LANGUAGE_CODE);
  }
  if (male.length === 0) {
    console.warn("No male voice found. Using the female voice for every word.");
    male = female;
  }
  console.log("Female voices: " + voiceNames(female));
  console.log("Male voices:   " + voiceNames(male));
  return { female: female, male: male };
}

// Asks Google to speak the text and returns the MP3 data.
async function synthesize(apiKey, text, voice) {
  const reply = await callGoogle(apiKey, "/text:synthesize", {
    input: { text: text },
    voice: { languageCode: LANGUAGE_CODE, name: voice.name },
    audioConfig: { audioEncoding: "MP3" }
  });
  // Google sends the audio as base64 text, so turn it back into bytes.
  return Buffer.from(reply.audioContent, "base64");
}

// Keeps only the voices of one kind, such as "Neural2".
// If there are none of that kind, the full list is used.
function onlyKind(voiceList, kind) {
  const matching = voiceList.filter(function (voice) {
    return voice.name.includes(kind);
  });
  if (matching.length === 0) {
    console.warn("No " + kind + " voice here. Using the usual voices.");
    return voiceList;
  }
  return matching;
}

// Makes the audio for one word. The best voice sometimes turns a very short
// word into a blip of noise, which shows up as a tiny file. When that happens,
// the next voice in the list is tried.
async function makeWordAudio(apiKey, word, voiceList) {
  for (const voice of voiceList) {
    const audio = await synthesize(apiKey, word.target, voice);
    if (audio.length >= MIN_AUDIO_BYTES) {
      return { audio: audio, voice: voice };
    }
    console.warn(word.id + "  " + voice.name + " made a broken file (" + audio.length + " bytes). Trying the next voice.");
  }
  throw new Error("No voice could make good audio for " + word.id + " (" + word.english + ")");
}

async function main() {
  // Anything typed after the script name that is not "--force" is a word id to remake.
  const args = process.argv.slice(2);
  const remakeAll = args.includes("--force");
  const idsToRemake = args.filter(function (arg) {
    return !arg.startsWith("--");
  });
  const voiceArg = args.find(function (arg) {
    return arg.startsWith("--voice=");
  });
  const wantedKind = voiceArg ? voiceArg.replace("--voice=", "") : "";

  const apiKey = readApiKey();
  const words = JSON.parse(fs.readFileSync(WORD_LIST_FILE, "utf8"));
  const voices = await chooseVoices(apiKey);

  fs.mkdirSync(AUDIO_FOLDER, { recursive: true });

  let madeCount = 0;
  for (const word of words) {
    const audioFile = path.join(AUDIO_FOLDER, word.id + ".mp3");
    const remakeThis = remakeAll || idsToRemake.includes(word.id);
    if (fs.existsSync(audioFile) && !remakeThis) {
      continue;
    }

    let voiceList = MALE_VOICE_WORD_IDS.includes(word.id) ? voices.male : voices.female;
    if (wantedKind) {
      voiceList = onlyKind(voiceList, wantedKind);
    }
    const result = await makeWordAudio(apiKey, word, voiceList);
    fs.writeFileSync(audioFile, result.audio);
    madeCount += 1;
    console.log(word.id + "  " + word.english + "  (" + result.voice.name + ")");
  }

  console.log("Done. Made " + madeCount + " files, skipped " + (words.length - madeCount) + ".");
}

main().catch(function (error) {
  console.error(error.message);
  // Set the exit code and let Node finish by itself. Calling process.exit()
  // straight after a network request crashes Node on Windows.
  process.exitCode = 1;
});
