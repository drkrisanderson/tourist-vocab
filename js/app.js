// Tourist Vocab: pick a lesson of 10 words, then flip through its flash cards.

const WORD_LIST_URL = "data/th.json";

// Lessons are made by position in the word list:
// words 1 to 10 are lesson 1, words 11 to 20 are lesson 2, and so on.
const LESSON_SIZE = 10;

// Sentences and letters sit after the words in the word list, marked by their category.
// Their lessons form named groups on the main page, such as "Sentences 1" and "Alphabet 1",
// instead of carrying on as "Lesson 11", "Lesson 12".
const SENTENCE_CATEGORY = "sentences";
const LETTER_CATEGORY = "letters";
const LESSON_GROUP_NAMES = {
  sentences: "Sentences",
  letters: "Alphabet"
};

// Thai has no spaces between words, so long text cannot wrap onto a new line.
// Text longer than this many characters is shown smaller so it fits on the card.
const LONG_TEXT_LENGTH = 10;

// Each word has one audio file, named by its id: audio/th/th-029.mp3
const AUDIO_FOLDER = "audio/th/";

// Must match the transition time on .card in styles.css
const FLIP_DURATION_MS = 500;

// One player is reused for every word.
const audioPlayer = new Audio();

const lessonListScreenElement = document.getElementById("lesson-list-screen");
const lessonListElement = document.getElementById("lesson-list");
const lessonScreenElement = document.getElementById("lesson-screen");
const lessonTitleElement = document.getElementById("lesson-title");
const backButton = document.getElementById("back-button");
const cardSceneElement = document.getElementById("card-scene");
const cardElement = document.getElementById("card");
const englishElement = document.getElementById("card-english");
const targetElement = document.getElementById("card-target");
const pronunciationElement = document.getElementById("card-pronunciation");
const literalElement = document.getElementById("card-literal");
const answerButtonsElement = document.getElementById("answer-buttons");
const listenButton = document.getElementById("listen-button");
const againButton = document.getElementById("again-button");
const gotItButton = document.getElementById("got-it-button");
const finishedElement = document.getElementById("finished");
const finishedBackButton = document.getElementById("finished-back-button");
const restartButton = document.getElementById("restart-button");
const messageElement = document.getElementById("message");

// Every entry in the word list. Letter cards use it to look up their example word.
let allWords = [];

// Every lesson. Each lesson is an array of up to 10 word objects.
let lessons = [];

// The words of the lesson being studied. Kept so the lesson can be repeated.
let currentLessonWords = [];

// The words still to learn, in order. The card on screen is always queue[0].
let queue = [];

// Fetches the word list and returns it as an array of word objects.
async function loadWords() {
  const response = await fetch(WORD_LIST_URL);
  if (!response.ok) {
    throw new Error("Could not load word list: " + response.status);
  }
  return response.json();
}

// Cuts the word list into lessons of LESSON_SIZE words each.
function buildLessons(words) {
  const result = [];
  for (let start = 0; start < words.length; start += LESSON_SIZE) {
    result.push(words.slice(start, start + LESSON_SIZE));
  }
  return result;
}

function isLetter(word) {
  return word.category === LETTER_CATEGORY;
}

// Returns "Sentences" or "Alphabet" for a lesson in one of those groups,
// and "" for an ordinary word lesson. A lesson never mixes categories,
// so its first entry is enough to tell.
function lessonGroupName(lessonWords) {
  return LESSON_GROUP_NAMES[lessonWords[0].category] || "";
}

function lessonName(lessonIndex) {
  const groupName = lessonGroupName(lessons[lessonIndex]);
  if (!groupName) {
    return "Lesson " + (lessonIndex + 1);
  }
  // Number the lessons of a group from 1 by counting them up to this one.
  const groupLessonsSoFar = lessons.slice(0, lessonIndex + 1).filter(function (lessonWords) {
    return lessonGroupName(lessonWords) === groupName;
  });
  return groupName + " " + groupLessonsSoFar.length;
}

// The short text that describes a lesson on the main page.
function lessonPreview(lessonWords) {
  const category = lessonWords[0].category;
  if (category === LETTER_CATEGORY) {
    // Letters are previewed as the Thai letters themselves.
    return lessonWords.map(function (word) {
      return word.target;
    }).join("   ");
  }
  const englishWords = lessonWords.map(function (word) {
    return word.english;
  });
  // Sentences have their own commas, so they are separated with a dot instead.
  const separator = category === SENTENCE_CATEGORY ? "  ·  " : ", ";
  return englishWords.join(separator);
}

// ---------- Main page: the list of lessons ----------

// Makes the button for one lesson, showing its name and a preview of what is in it.
function createLessonButton(lessonWords, lessonIndex) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lesson-button";

  const name = document.createElement("span");
  name.className = "lesson-button-name";
  name.textContent = lessonName(lessonIndex);

  const wordList = document.createElement("span");
  wordList.className = "lesson-button-words";
  wordList.textContent = lessonPreview(lessonWords);

  button.appendChild(name);
  button.appendChild(wordList);
  button.addEventListener("click", function () {
    startLesson(lessonIndex);
  });
  return button;
}

function createHeading(text) {
  const heading = document.createElement("h2");
  heading.className = "lesson-list-heading";
  heading.textContent = text;
  return heading;
}

function renderLessonList() {
  lessonListElement.textContent = "";
  let previousGroupName = "";
  lessons.forEach(function (lessonWords, lessonIndex) {
    // Put a heading, such as "Sentences", above the first lesson of each group.
    const groupName = lessonGroupName(lessonWords);
    if (groupName && groupName !== previousGroupName) {
      lessonListElement.appendChild(createHeading(groupName));
    }
    previousGroupName = groupName;
    lessonListElement.appendChild(createLessonButton(lessonWords, lessonIndex));
  });
}

function showLessonList() {
  stopAudio();
  // Leave the card on its front so the next lesson starts English side up.
  cardElement.classList.remove("flipped");
  lessonScreenElement.hidden = true;
  lessonListScreenElement.hidden = false;
}

// ---------- Lesson screen: the flash cards ----------

function startLesson(lessonIndex) {
  currentLessonWords = lessons[lessonIndex];
  lessonTitleElement.textContent = lessonName(lessonIndex);
  console.log("Starting " + lessonName(lessonIndex));

  lessonListScreenElement.hidden = true;
  lessonScreenElement.hidden = false;
  // The main page is long, so the user may have scrolled down to tap a lesson.
  window.scrollTo(0, 0);
  restart();
}

function findWord(id) {
  return allWords.find(function (word) {
    return word.id === id;
  });
}

// A letter's example is a word from an earlier lesson, shown as "กิน gin (eat)".
function exampleText(letter) {
  const example = findWord(letter.example);
  return example.target + "  " + example.pronunciation + "  (" + example.english + ")";
}

// Works out what text goes where on a card.
// Word and sentence cards: English on the front, Thai on the back.
// Letter cards run the other way: the Thai letter on the front, its sound on the back.
function cardContent(word) {
  if (isLetter(word)) {
    return {
      front: word.target,
      answer: word.english,
      detail: exampleText(word),
      note: word.note || ""
    };
  }
  return {
    front: word.english,
    answer: word.target,
    detail: word.pronunciation,
    // Only some words have a literal meaning.
    note: word.literal ? "(literally: " + word.literal + ")" : ""
  };
}

function showCardFront(word) {
  englishElement.textContent = cardContent(word).front;
  // A single letter is shown much larger than an English word.
  englishElement.classList.toggle("letter", isLetter(word));
}

function showCardBack(word) {
  const content = cardContent(word);
  targetElement.textContent = content.answer;
  targetElement.classList.toggle("long-text", content.answer.length > LONG_TEXT_LENGTH);
  pronunciationElement.textContent = content.detail;
  literalElement.textContent = content.note;
}

// The back of the card waits until the card has turned to its front,
// so the new answer is never seen while the card is still turning.
function showCardBackAfterFlip() {
  setTimeout(function () {
    // Read queue[0] now, not earlier: the user may have moved on already.
    if (queue.length > 0) {
      showCardBack(queue[0]);
    }
  }, FLIP_DURATION_MS);
}

function isFlipped() {
  return cardElement.classList.contains("flipped");
}

// The answer buttons only show while the back of the card is showing.
function updateAnswerButtons() {
  answerButtonsElement.classList.toggle("visible", isFlipped());
}

// Turns the card over. The CSS class "flipped" does the animation.
function flipCard() {
  cardElement.classList.toggle("flipped");
  updateAnswerButtons();
}

// Plays the audio file for the card on screen.
async function playAudio() {
  if (queue.length === 0) {
    return;
  }
  const word = queue[0];
  // A letter has no audio of its own. It plays the audio of its example word.
  const audioId = word.example || word.id;

  try {
    // The file is fetched whole and then handed to the player. Giving the player
    // the file address directly does not work reliably when the app is offline.
    const response = await fetch(AUDIO_FOLDER + audioId + ".mp3");
    if (!response.ok) {
      throw new Error("Audio file not found: " + response.status);
    }
    const audioData = await response.blob();

    // The user may have moved to another card while the file was loading.
    if (queue[0] !== word) {
      return;
    }
    // Free the memory used by the previous word's audio.
    URL.revokeObjectURL(audioPlayer.src);
    audioPlayer.src = URL.createObjectURL(audioData);
    await audioPlayer.play();
  } catch (error) {
    // The app carries on without sound.
    console.warn("No audio for " + word.id + " (" + word.english + ")", error);
  }
}

function stopAudio() {
  audioPlayer.pause();
}

// Shows the first card in the queue, English side up.
function showNextCard() {
  stopAudio();
  if (queue.length === 0) {
    showFinished();
    return;
  }

  const word = queue[0];
  showCardFront(word);

  if (isFlipped()) {
    cardElement.classList.remove("flipped");
    showCardBackAfterFlip();
  } else {
    showCardBack(word);
  }
  updateAnswerButtons();
}

// "Got it": the card leaves the queue for good.
function markGotIt() {
  queue.shift();
  console.log("Got it. Cards left: " + queue.length);
  showNextCard();
}

// "Again": the card goes to the end of the queue.
function markAgain() {
  const word = queue.shift();
  queue.push(word);
  console.log("Again: " + word.english + ". Cards left: " + queue.length);
  showNextCard();
}

function showFinished() {
  cardElement.classList.remove("flipped");
  updateAnswerButtons();
  cardSceneElement.hidden = true;
  answerButtonsElement.hidden = true;
  finishedElement.hidden = false;
}

// Refills the queue with the lesson's words and starts from the first card.
function restart() {
  queue = currentLessonWords.slice();
  finishedElement.hidden = true;
  cardSceneElement.hidden = false;
  answerButtonsElement.hidden = false;
  showNextCard();
}

function showMessage(text) {
  messageElement.textContent = text;
}

// Starts the service worker, which saves the app's files for offline use.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("service-worker.js").catch(function (error) {
    console.warn("Offline mode is not available", error);
  });
}

async function startApp() {
  registerServiceWorker();
  try {
    allWords = await loadWords();
    lessons = buildLessons(allWords);
    console.log("Loaded " + allWords.length + " words in " + lessons.length + " lessons");

    cardElement.addEventListener("click", flipCard);
    listenButton.addEventListener("click", playAudio);
    gotItButton.addEventListener("click", markGotIt);
    againButton.addEventListener("click", markAgain);
    restartButton.addEventListener("click", restart);
    backButton.addEventListener("click", showLessonList);
    finishedBackButton.addEventListener("click", showLessonList);

    renderLessonList();
  } catch (error) {
    // fetch fails when the page is opened as a file instead of through a server
    console.error(error);
    showMessage("Could not load the words. Open the app with Live Server.");
  }
}

startApp();
