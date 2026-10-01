// The service worker runs in the background, separate from the page.
// Its job is to keep a copy of every app file on the phone,
// so the app still works with no internet connection.

const CACHE_NAME = "tourist-vocab";
const WORD_LIST_URL = "data/th.json";
const AUDIO_FOLDER = "audio/th/";

// The files that make up the app itself. Audio files are added from the word list.
const APP_FILES = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  WORD_LIST_URL
];

// Reads the word list and returns the address of every word's audio file.
async function listAudioFiles() {
  const response = await fetch(WORD_LIST_URL);
  const words = await response.json();
  return words.map(function (word) {
    return AUDIO_FOLDER + word.id + ".mp3";
  });
}

// Downloads every app file and audio file into the phone's storage.
async function saveAllFiles() {
  const audioFiles = await listAudioFiles();
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_FILES.concat(audioFiles));
}

// Tries the internet first, so the user gets the newest version when online.
// If there is no connection, falls back to the copy saved on the phone.
async function fetchNewestOrSaved(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      // A response can only be read once, so save a copy and return the original.
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const saved = await cache.match(request);
    if (saved) {
      return saved;
    }
    throw error;
  }
}

// "install" runs once, the first time the app is opened.
self.addEventListener("install", function (event) {
  event.waitUntil(saveAllFiles());
  self.skipWaiting();
});

// Take control of the page straight away, without waiting for a reload.
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

// "fetch" runs every time the page asks for a file.
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(fetchNewestOrSaved(event.request));
});
