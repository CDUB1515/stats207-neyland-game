// Stats 207 Exam 1 Study Game (UT vs Alabama theme)
// Rules:
// - Every 5 correct => score (TD+XP = 7) until UT hits 49
// - After UT reaches 49, the next scoring event is a Field Goal (3) to end at 52
// - Each scoring event triggers celebration + "INTO THE CHECKERBOARD!"
// - End game: 52-49, fans storm, goalposts down

const UT_TARGET = 52;
const BAMA_SCORE = 49;
const CORRECTS_PER_SCORE = 5;

const state = {
  utScore: 0,
  bamaScore: BAMA_SCORE,
  correctTowardScore: 0,
  totalCorrect: 0,
  questionIndex: 0,
  usedIds: new Set(),
  locked: false,
  gameOver: false
};

const el = {
  utScore: document.getElementById("utScore"),
  bamaScore: document.getElementById("bamaScore"),
  meterbar: document.getElementById("meterbar"),
  streakText: document.getElementById("streakText"),
  driveText: document.getElementById("driveText"),
  progressText: document.getElementById("progressText"),
  qTopic: document.getElementById("qTopic"),
  qNumber: document.getElementById("qNumber"),
  questionText: document.getElementById("questionText"),
  answers: document.getElementById("answers"),
  log: document.getElementById("log"),
  skipBtn: document.getElementById("skipBtn"),
  resetBtn: document.getElementById("resetBtn"),
  sprites: document.getElementById("sprites"),
  sceneTitle: document.getElementById("sceneTitle"),
  sceneCaption: document.getElementById("sceneCaption"),
  goalposts: document.getElementById("goalposts"),
  storm: document.getElementById("storm")
};

// A modest Exam 1-style question bank: descriptive stats, probability basics, z-scores, normal, sampling, CI intuition.
const QUESTIONS = [
  {
    id: "mean1",
    topic: "Descriptive Stats",
    q: "Which measure is MOST sensitive to extreme outliers?",
    choices: ["Median", "Mode", "Mean", "IQR"],
    answer: 2,
    explain: "The mean uses all values directly, so outliers pull it the most."
  },
  {
    id: "median1",
    topic: "Descriptive Stats",
    q: "A dataset is strongly right-skewed. Which is usually larger?",
    choices: ["Mean > Median", "Median > Mean", "Mean = Median", "Can’t tell from skew"],
    answer: 0,
    explain: "Right-skew pulls the mean upward above the median."
  },
  {
    id: "sd1",
    topic: "Descriptive Stats",
    q: "Standard deviation measures the typical distance of values from the…",
    choices: ["Mode", "Median", "Mean", "Maximum"],
    answer: 2,
    explain: "SD is based on deviations from the mean."
  },
  {
    id: "var1",
    topic: "Descriptive Stats",
    q: "Variance is the (approximately) ______ of standard deviation.",
    choices: ["square", "cube", "inverse", "log"],
    answer: 0,
    explain: "Variance = (standard deviation)²."
  },
  {
    id: "iqr1",
    topic: "Descriptive Stats",
    q: "IQR is defined as…",
    choices: ["Q1 − Q3", "Q3 − Q1", "Mean − Median", "Max − Min"],
    answer: 1,
    explain: "IQR = Q3 − Q1."
  },
  {
    id: "range1",
    topic: "Descriptive Stats",
    q: "Range is…",
    choices: ["Q3 − Q1", "Max − Min", "Mean − Min", "Median − Mode"],
    answer: 1,
    explain: "Range is max minus min."
  },
  {
    id: "prob1",
    topic: "Probability",
    q: "If events A and B are mutually exclusive, then P(A ∩ B) equals…",
    choices: ["P(A) + P(B)", "0", "1", "P(A)P(B)"],
    answer: 1,
    explain: "Mutually exclusive means they cannot happen together."
  },
  {
    id: "prob2",
    topic: "Probability",
    q: "If events A and B are independent, then P(A ∩ B) equals…",
    choices: ["P(A) + P(B)", "P(A) − P(B)", "P(A)P(B)", "0"],
    answer: 2,
    explain: "Independence implies multiplication for intersection."
  },
  {
    id: "cond1",
    topic: "Probability",
    q: "Conditional probability P(A|B) is defined as…",
    choices: ["P(A∩B) / P(B)", "P(A) / P(B)", "P(B) / P(A∩B)", "P(A) + P(B)"],
    answer: 0,
    explain: "Definition: P(A|B)=P(A∩B)/P(B), assuming P(B)>0."
  },
  {
    id: "compl1",
    topic: "Probability",
    q: "The complement rule states P(Aᶜ) = …",
    choices: ["1 + P(A)", "1 − P(A)", "P(A) − 1", "P(A)²"],
    answer: 1,
    explain: "Complement: everything not in A."
  },
  {
    id: "z1",
    topic: "Z-Scores",
    q: "A z-score is computed as…",
    choices: ["(x − μ) / σ", "(x − σ) / μ", "(μ − x) / σ", "x / (μσ)"],
    answer: 0,
    explain: "Standardize: subtract mean, divide by standard deviation."
  },
  {
    id: "z2",
    topic: "Z-Scores",
    q: "If z = -2, the observation is…",
    choices: ["2 SD above the mean", "2 SD below the mean", "At the mean", "2 units below zero"],
    answer: 1,
    explain: "Negative z means below the mean; magnitude is SD count."
  },
  {
    id: "norm1",
    topic: "Normal Distribution",
    q: "In a normal distribution, about 68% of observations fall within…",
    choices: ["±1 SD of the mean", "±2 SD of the mean", "±3 SD of the mean", "±0.5 SD of the mean"],
    answer: 0,
    explain: "Empirical rule: 68–95–99.7."
  },
  {
    id: "norm2",
    topic: "Normal Distribution",
    q: "In a normal distribution, the mean and median are…",
    choices: ["mean > median", "median > mean", "equal", "unrelated"],
    answer: 2,
    explain: "Normal is symmetric; mean=median=mode."
  },
  {
    id: "clt1",
    topic: "Sampling / CLT",
    q: "As sample size n increases, the sampling distribution of x̄ tends to become…",
    choices: ["more skewed", "more variable", "more normal", "uniform"],
    answer: 2,
    explain: "CLT: x̄ approaches normal for large n (under broad conditions)."
  },
  {
    id: "se1",
    topic: "Sampling / SE",
    q: "Standard error of the mean (SEM) is approximately…",
    choices: ["σ / √n", "σn", "σ² / n", "√n / σ"],
    answer: 0,
    explain: "SEM decreases like 1/√n."
  },
  {
    id: "ci1",
    topic: "Confidence Intervals",
    q: "A 95% confidence interval means…",
    choices: [
      "95% of data fall in the interval",
      "There is a 95% chance μ is in this specific computed interval",
      "In repeated samples, ~95% of such intervals contain μ",
      "The sample mean equals μ 95% of the time"
    ],
    answer: 2,
    explain: "Correct interpretation is long-run coverage of the method."
  },
  {
    id: "bias1",
    topic: "Study Design",
    q: "Which is MOST likely to create selection bias?",
    choices: [
      "Random sampling from the population",
      "Voluntary response survey link posted online",
      "Stratified random sample",
      "Simple random sample"
    ],
    answer: 1,
    explain: "Voluntary response tends to overrepresent strong opinions."
  },
  {
    id: "corr1",
    topic: "Correlation",
    q: "A correlation of r = 0 implies…",
    choices: [
      "No linear association",
      "No association of any kind",
      "Perfect negative association",
      "Causation is absent"
    ],
    answer: 0,
    explain: "r=0 means no linear relationship; nonlinear may still exist."
  },
  {
    id: "caus1",
    topic: "Correlation vs Causation",
    q: "Which statement is best?",
    choices: [
      "Correlation always implies causation",
      "Causation always implies correlation",
      "Correlation does not prove causation",
      "If r is large, causation is guaranteed"
    ],
    answer: 2,
    explain: "Association alone doesn’t establish a causal mechanism."
  },
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let deck = shuffle(QUESTIONS);

function updateUI() {
  el.utScore.textContent = state.utScore;
  el.bamaScore.textContent = state.bamaScore;

  const pct = (state.correctTowardScore / CORRECTS_PER_SCORE) * 100;
  el.meterbar.style.width = `${pct}%`;
  el.streakText.textContent = `${state.correctTowardScore} / ${CORRECTS_PER_SCORE} correct`;

  const nextScoreType = (state.utScore < 49) ? "TD (7)" : (state.utScore < 52 ? "FG (3)" : "Done");
  el.progressText.textContent =
    `Need ${UT_TARGET} to win. Next score: ${nextScoreType}. ` +
    `TDs worth 7 until 49, then a field goal for 3.`;

  el.skipBtn.disabled = state.gameOver;
  el.resetBtn.disabled = false;
}

function logMsg(msg, kind="info") {
  const color = kind === "good" ? "var(--good)" : kind === "bad" ? "var(--bad)" : "var(--muted)";
  el.log.innerHTML = `<span style="color:${color};font-weight:700">${msg}</span>`;
}

function drawQuestion() {
  if (state.gameOver) return;

  // Ensure we always have questions
  if (deck.length === 0) deck = shuffle(QUESTIONS);

  // Avoid repeating too frequently
  let q = deck.pop();
  let tries = 0;
  while (state.usedIds.has(q.id) && tries < 8) {
    if (deck.length === 0) deck = shuffle(QUESTIONS);
    q = deck.pop();
    tries++;
  }
  state.usedIds.add(q.id);

  state.questionIndex += 1;
  el.qTopic.textContent = q.topic;
  el.qNumber.textContent = `Q${state.questionIndex}`;
  el.questionText.textContent = q.q;

  el.answers.innerHTML = "";
  q.choices.forEach((choice, idx) => {
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.type = "button";
    btn.textContent = choice;
    btn.addEventListener("click", () => handleAnswer(q, idx, btn));
    el.answers.appendChild(btn);
  });

  el.driveText.textContent = "Move the chains: answer correctly to score.";
  el.sceneTitle.textContent = "—";
  el.sceneCaption.textContent = "";
  el.sprites.classList.remove("play-td");
  resetSpritePositions();
  updateUI();
  logMsg("Pick an answer.", "info");
}

function lockAnswers(lock) {
  state.locked = lock;
  [...el.answers.querySelectorAll("button")].forEach(b => b.disabled = lock);
}

function resetSpritePositions() {
  // Reset inline transforms applied by animation end-state
  document.getElementById("hyatt").style.transform = "";
  document.getElementById("saban").style.transform = "";
  document.getElementById("hyatt").querySelector(".arm").style.transform = "";
}

function playTouchdownCutscene(points) {
  el.sprites.classList.remove("play-td");
  // restart animation
  void el.sprites.offsetWidth;
  el.sprites.classList.add("play-td");

  if (points === 7) {
    el.sceneTitle.textContent = "TOUCHDOWN VOLS!";
    el.sceneCaption.textContent = "Jalin Hyatt delivers the stiff-arm (cartoon) — and the Vols cash in.";
  } else {
    el.sceneTitle.textContent = "FIELD GOAL IS GOOD!";
    el.sceneCaption.textContent = "Three points. Enough to seal it in Neyland.";
  }
}

function scorePoints() {
  let points = 0;

  if (state.utScore < 49) {
    points = 7;
    state.utScore += 7;
    logMsg("INTO THE CHECKERBOARD! (+7)", "good");
    playTouchdownCutscene(7);
  } else if (state.utScore === 49) {
    // Final field goal to finish 52-49
    points = 3;
    state.utScore += 3;
    logMsg("FIELD GOAL… AND IT’S GOOD! (+3) INTO THE CHECKERBOARD!", "good");
    playTouchdownCutscene(3);
  }

  state.correctTowardScore = 0;
  updateUI();

  if (state.utScore >= UT_TARGET) {
    endGameWin();
  } else {
    el.driveText.textContent = `Score! Keep it going — ${UT_TARGET - state.utScore} more to win.`;
  }
}

function endGameWin() {
  state.gameOver = true;
  lockAnswers(true);

  el.driveText.textContent = "FINAL: TENNESSEE 52 — ALABAMA 49 (2022 vibes).";
  el.sceneTitle.textContent = "VOLS WIN! FANS STORM NEYLAND!";
  el.sceneCaption.textContent = "The crowd pours onto the field… and the goalposts are coming down!";

  // Storm + goalposts down
  el.storm.classList.add("storming");
  el.goalposts.classList.add("posts-down");

  logMsg("FINAL SCORE: 52–49. GO VOLS. 🟧⬜", "good");
  updateUI();
}

function handleAnswer(q, idx, btn) {
  if (state.locked || state.gameOver) return;
  lockAnswers(true);

  const buttons = [...el.answers.querySelectorAll("button")];
  const correctBtn = buttons[q.answer];

  if (idx === q.answer) {
    btn.classList.add("correct");
    state.correctTowardScore += 1;
    state.totalCorrect += 1;

    el.driveText.textContent = `Correct! ${q.explain}`;
    logMsg("Correct. Keep marching.", "good");
  } else {
    btn.classList.add("wrong");
    correctBtn.classList.add("correct");

    // No streak reset specified; I’m keeping momentum-friendly rules:
    // wrong answer does NOT erase prior corrects toward scoring, but it doesn't add.
    el.driveText.textContent = `Not quite. ${q.explain}`;
    logMsg("Missed it — but learn it and keep going.", "bad");
  }

  updateUI();

  setTimeout(() => {
    // If we reached 5 correct toward the next scoring event, score now.
    if (state.correctTowardScore >= CORRECTS_PER_SCORE) {
      scorePoints();
      // brief pause before next question
      setTimeout(() => {
        lockAnswers(false);
        drawQuestion();
      }, 850);
    } else {
      lockAnswers(false);
      drawQuestion();
    }
  }, 750);
}

el.skipBtn.addEventListener("click", () => {
  if (state.gameOver) return;
  logMsg("Skipped. No penalty.", "info");
  drawQuestion();
});

el.resetBtn.addEventListener("click", () => resetGame());

function resetGame() {
  state.utScore = 0;
  state.correctTowardScore = 0;
  state.totalCorrect = 0;
  state.questionIndex = 0;
  state.usedIds = new Set();
  state.locked = false;
  state.gameOver = false;

  deck = shuffle(QUESTIONS);

  el.goalposts.classList.remove("posts-down");
  el.storm.classList.remove("storming");
  el.sprites.classList.remove("play-td");
  resetSpritePositions();

  updateUI();
  logMsg("Game reset. Start the drive.", "info");
  drawQuestion();
}

// Init
updateUI();
drawQuestion();
