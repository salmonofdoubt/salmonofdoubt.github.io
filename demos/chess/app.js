const board = document.getElementById("board3d");
const scene = document.getElementById("scene");
const pitch = document.getElementById("pitch");
const turn = document.getElementById("turn");
const flipBoard = document.getElementById("flipBoard");
const resetBoard = document.getElementById("resetBoard");
const startLesson = document.getElementById("startLesson");
const lessonGrid = document.getElementById("lessonGrid");
const trainerTitle = document.getElementById("trainerTitle");
const trainerIntro = document.getElementById("trainerIntro");
const promptEl = document.getElementById("prompt");
const feedback = document.getElementById("feedback");
const newPrompt = document.getElementById("newPrompt");
const showAnswer = document.getElementById("showAnswer");
const scoreEl = document.getElementById("score");
const scoreText = document.getElementById("scoreText");
const focusTitle = document.getElementById("focusTitle");
const focusText = document.getElementById("focusText");
const boardNote = document.getElementById("boardNote");

const FILES = ["a","b","c","d","e","f","g","h"];
let flipped = false;
let score = 0;
let activeLesson = "coordinates";
let currentTarget = "e4";
let selectedPiece = null;

const STARTING_PIECES = {
  a1: "♖", b1: "♘", c1: "♗", d1: "♕", e1: "♔", f1: "♗", g1: "♘", h1: "♖",
  a2: "♙", b2: "♙", c2: "♙", d2: "♙", e2: "♙", f2: "♙", g2: "♙", h2: "♙",
  a7: "♟", b7: "♟", c7: "♟", d7: "♟", e7: "♟", f7: "♟", g7: "♟", h7: "♟",
  a8: "♜", b8: "♞", c8: "♝", d8: "♛", e8: "♚", f8: "♝", g8: "♞", h8: "♜"
};

let pieces = { ...STARTING_PIECES };
let turnColour = "white";
let selectedFrom = null;

function isWhitePiece(piece) {
  return "♔♕♖♗♘♙".includes(piece);
}

function isBlackPiece(piece) {
  return "♚♛♜♝♞♟".includes(piece);
}

function colourOfPiece(piece) {
  if (isWhitePiece(piece)) return "white";
  if (isBlackPiece(piece)) return "black";
  return null;
}

const pieceColour = square => colourOfPiece(pieces[square]) || "white";

function pieceClass(symbol) {
  return ({
    "♔": "king", "♚": "king",
    "♕": "queen", "♛": "queen",
    "♖": "rook", "♜": "rook",
    "♗": "bishop", "♝": "bishop",
    "♘": "knight", "♞": "knight",
    "♙": "pawn", "♟": "pawn"
  })[symbol] || "pawn";
}

function pieceMarkup() {
  return `
    <i class="piece-shadow"></i>
    <i class="piece-base"></i>
    <i class="piece-stem"></i>
    <i class="piece-head"></i>
    <i class="piece-crown"></i>
    <i class="piece-cut"></i>
  `;
}


const lessons = [
  {
    id: "freeplay",
    title: "Free play",
    summary: "Click a piece, then click a highlighted destination. White moves first.",
    focus: "Play the position",
    text: "This is a teaching board with pseudo-legal movement, not yet a tournament engine.",
    intro: "White to move. Click a piece, inspect the legal destinations, then move."
  },
  {
    id: "coordinates",
    title: "Coordinate fluency",
    summary: "Name and find squares until the board becomes automatic.",
    focus: "Coordinate fluency",
    text: "Board literacy lowers cognitive load. A small but decisive advantage, Captain.",
    intro: "Click the requested square. You are learning the grammar of chess."
  },
  {
    id: "movement",
    title: "Piece movement",
    summary: "Click a piece to see its movement geometry.",
    focus: "Piece vectors",
    text: "Every piece is a different spatial instrument.",
    intro: "Click any piece. The lab highlights its movement vectors from the current square."
  },
  {
    id: "tactics",
    title: "Tactical motifs",
    summary: "Identify forks, pins, skewers, and loose pieces as board geometries.",
    focus: "Tactical patterning",
    text: "Tactics are recurring geometries plus timing.",
    intro: "Use the highlighted examples as motif prompts rather than engine verdicts."
  },
  {
    id: "candidates",
    title: "Candidate moves",
    summary: "Practise checks, captures, threats before committing to a move.",
    focus: "Candidate discipline",
    text: "The first plausible move is merely a suspect, not yet a conclusion.",
    intro: "Generate candidates, compare them, then decide. This is chess as judgement."
  },
  {
    id: "king",
    title: "King safety",
    summary: "Read open lines, weak diagonals, back-rank threats, and escape squares.",
    focus: "King safety",
    text: "A monarch without escape squares is a governance failure on 64 squares.",
    intro: "Inspect the board for open files, diagonals, and overloaded defenders."
  },
  {
    id: "endgame",
    title: "Endgame geometry",
    summary: "Opposition, pawn races, triangulation, and square-of-the-pawn logic.",
    focus: "Endgame clarity",
    text: "When material thins, geometry becomes louder.",
    intro: "Use simple positions to study distance, tempo, and promotion races."
  }
];

function squareName(fileIndex, rank) {
  return `${FILES[fileIndex]}${rank}`;
}

function renderBoard() {
  board.innerHTML = "";
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const files = flipped ? [...FILES].reverse() : FILES;

  ranks.forEach(rank => {
    files.forEach(file => {
      const sq = `${file}${rank}`;
      const fileIndex = FILES.indexOf(file);
      const isLight = (fileIndex + rank) % 2 === 1;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `square ${isLight ? "light" : "dark"}`;
      cell.dataset.square = sq;
      cell.setAttribute("aria-label", `Square ${sq}`);

      if (pieces[sq]) {
        const symbol = pieces[sq];
        const p = document.createElement("span");
        p.className = `piece ${pieceColour(sq)} ${pieceClass(symbol)}`;
        p.setAttribute("aria-hidden", "true");
        p.innerHTML = pieceMarkup(symbol);
        cell.appendChild(p);
      }

      cell.addEventListener("click", () => handleSquareClick(sq));
      board.appendChild(cell);
    });
  });
  applyLessonDecorations();
}

function setSceneTransform() {
  scene.style.transform = `rotateX(${pitch.value}deg) rotateZ(${turn.value}deg)`;
  document.querySelectorAll(".piece").forEach(piece => {
    piece.style.transform = `translateZ(46px) rotateX(-${pitch.value}deg)`;
  });
}

function clearMarks() {
  document.querySelectorAll(".square").forEach(s => {
    s.classList.remove("target", "legal", "answer");
  });
}

function mark(square, cls) {
  const el = document.querySelector(`[data-square="${square}"]`);
  if (el) el.classList.add(cls);
}

function randomSquare() {
  const f = FILES[Math.floor(Math.random() * FILES.length)];
  const r = 1 + Math.floor(Math.random() * 8);
  return `${f}${r}`;
}

function setPrompt() {
  clearMarks();
  selectedPiece = null;

  if (activeLesson === "freeplay") {
    promptEl.textContent = `${turnColour === "white" ? "White" : "Black"} to move`;
    feedback.textContent = "Click one of your pieces, then click a highlighted destination.";
  } else if (activeLesson === "coordinates") {
    currentTarget = randomSquare();
    promptEl.textContent = `Click ${currentTarget}`;
    feedback.textContent = "Awaiting square selection.";
  } else if (activeLesson === "movement") {
    promptEl.textContent = "Click any piece";
    feedback.textContent = "Movement vectors will appear.";
  } else if (activeLesson === "tactics") {
    currentTarget = "c7";
    promptEl.textContent = "Find the knight fork square: c7";
    mark("c7", "target");
    feedback.textContent = "A knight on c7 would fork king and rook in a common motif pattern.";
  } else if (activeLesson === "candidates") {
    promptEl.textContent = "List candidates: checks, captures, threats";
    ["e4", "d4", "g1", "f7"].forEach(s => mark(s, "target"));
    feedback.textContent = "The board highlights candidate zones, not final answers.";
  } else if (activeLesson === "king") {
    promptEl.textContent = "Inspect weak king lines";
    ["e1", "e8", "f7", "g8", "h7"].forEach(s => mark(s, "target"));
    feedback.textContent = "Open lines and weak escape squares determine king safety.";
  } else {
    promptEl.textContent = "Study pawn race geometry";
    ["a4", "a5", "h4", "h5", "e5"].forEach(s => mark(s, "target"));
    feedback.textContent = "Endgames are often distance problems with tempo attached.";
  }
}

function handleSquareClick(square) {
  if (activeLesson === "freeplay") {
    handleFreePlay(square);
    return;
  }

  if (activeLesson === "coordinates") {
    if (square === currentTarget) {
      score = Math.min(100, score + 10);
      feedback.textContent = `Correct: ${square}. Efficient navigation, Captain.`;
      updateScore();
      setTimeout(setPrompt, 520);
    } else {
      feedback.textContent = `Not ${square}. Recalibrate. Target is ${currentTarget}.`;
    }
    return;
  }

  if (activeLesson === "movement") {
    if (!pieces[square]) {
      feedback.textContent = `${square} is empty. Click a piece.`;
      return;
    }
    selectedPiece = square;
    clearMarks();
    mark(square, "target");
    legalMoves(square).forEach(s => mark(s, "legal"));
    const name = pieceName(pieces[square]);
    feedback.textContent = `${name} on ${square}: movement geometry highlighted.`;
    score = Math.min(100, score + 4);
    updateScore();
    return;
  }

  if (document.querySelector(`[data-square="${square}"]`)?.classList.contains("target")) {
    score = Math.min(100, score + 6);
    feedback.textContent = `${square} is relevant to this lesson. Pattern recognised.`;
    updateScore();
  } else {
    feedback.textContent = `${square} may be legal in chess, but it is not the current lesson signal.`;
  }
}

function handleFreePlay(square) {
  const piece = pieces[square];

  if (!selectedFrom) {
    if (!piece) {
      feedback.textContent = `${square} is empty. Select a ${turnColour} piece.`;
      return;
    }

    if (colourOfPiece(piece) !== turnColour) {
      feedback.textContent = `It is ${turnColour}'s move. That piece is ${colourOfPiece(piece)}.`;
      return;
    }

    selectedFrom = square;
    clearMarks();
    mark(square, "target");
    const moves = legalMoves(square);
    moves.forEach(s => mark(s, "legal"));
    feedback.textContent = `${pieceName(piece)} selected on ${square}. Choose a highlighted square.`;
    return;
  }

  if (square === selectedFrom) {
    selectedFrom = null;
    clearMarks();
    feedback.textContent = "Selection cancelled.";
    return;
  }

  const allowed = legalMoves(selectedFrom);

  if (!allowed.includes(square)) {
    if (piece && colourOfPiece(piece) === turnColour) {
      selectedFrom = null;
      handleFreePlay(square);
      return;
    }

    feedback.textContent = `${square} is not a legal destination for ${pieceName(pieces[selectedFrom])} on ${selectedFrom}.`;
    return;
  }

  const movedPiece = pieces[selectedFrom];
  const captured = pieces[square];

  pieces[square] = movedPiece;
  delete pieces[selectedFrom];

  const from = selectedFrom;
  selectedFrom = null;
  turnColour = turnColour === "white" ? "black" : "white";

  renderBoard();
  clearMarks();

  promptEl.textContent = `${turnColour === "white" ? "White" : "Black"} to move`;
  feedback.textContent = captured
    ? `${pieceName(movedPiece)} moved ${from} to ${square} and captured ${pieceName(captured)}.`
    : `${pieceName(movedPiece)} moved ${from} to ${square}.`;

  score = Math.min(100, score + 3);
  updateScore();
}

function legalMoves(square) {
  const piece = pieces[square];
  if (!piece) return [];

  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const colour = colourOfPiece(piece);
  const moves = [];

  const occupant = (f, r) => pieces[squareName(f, r)];
  const inBounds = (f, r) => f >= 0 && f < 8 && r >= 1 && r <= 8;

  const add = (f, r) => {
    if (!inBounds(f, r)) return false;
    const target = occupant(f, r);
    if (!target) {
      moves.push(squareName(f, r));
      return true;
    }
    if (colourOfPiece(target) !== colour) moves.push(squareName(f, r));
    return false;
  };

  const ray = (df, dr) => {
    for (let step = 1; step < 8; step++) {
      const nf = file + df * step;
      const nr = rank + dr * step;
      if (!inBounds(nf, nr)) break;
      if (!add(nf, nr)) break;
    }
  };

  if ("♘♞".includes(piece)) {
    [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]].forEach(([df, dr]) => add(file + df, rank + dr));
  } else if ("♗♝".includes(piece)) {
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([df, dr]) => ray(df, dr));
  } else if ("♖♜".includes(piece)) {
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([df, dr]) => ray(df, dr));
  } else if ("♕♛".includes(piece)) {
    [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([df, dr]) => ray(df, dr));
  } else if ("♔♚".includes(piece)) {
    [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([df, dr]) => add(file + df, rank + dr));
  } else if (piece === "♙") {
    if (inBounds(file, rank + 1) && !occupant(file, rank + 1)) {
      moves.push(squareName(file, rank + 1));
      if (rank === 2 && !occupant(file, rank + 2)) moves.push(squareName(file, rank + 2));
    }
    [[-1,1],[1,1]].forEach(([df, dr]) => {
      const target = occupant(file + df, rank + dr);
      if (target && colourOfPiece(target) === "black") moves.push(squareName(file + df, rank + dr));
    });
  } else if (piece === "♟") {
    if (inBounds(file, rank - 1) && !occupant(file, rank - 1)) {
      moves.push(squareName(file, rank - 1));
      if (rank === 7 && !occupant(file, rank - 2)) moves.push(squareName(file, rank - 2));
    }
    [[-1,-1],[1,-1]].forEach(([df, dr]) => {
      const target = occupant(file + df, rank + dr);
      if (target && colourOfPiece(target) === "white") moves.push(squareName(file + df, rank + dr));
    });
  }

  return moves;
}

function pieceName(symbol) {
  return ({
    "♔": "White king", "♕": "White queen", "♖": "White rook", "♗": "White bishop", "♘": "White knight", "♙": "White pawn",
    "♚": "Black king", "♛": "Black queen", "♜": "Black rook", "♝": "Black bishop", "♞": "Black knight", "♟": "Black pawn"
  })[symbol] || "Piece";
}

function renderLessons() {
  lessonGrid.innerHTML = lessons.map(lesson => `
    <article class="lesson-card ${lesson.id === activeLesson ? "active" : ""}" data-lesson="${lesson.id}">
      <strong>${lesson.title}</strong>
      <span>${lesson.summary}</span>
    </article>
  `).join("");

  document.querySelectorAll(".lesson-card").forEach(card => {
    card.addEventListener("click", () => selectLesson(card.dataset.lesson));
  });
}

function selectLesson(id) {
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return;

  activeLesson = id;
  trainerTitle.textContent = lesson.title;
  trainerIntro.textContent = lesson.intro;
  focusTitle.textContent = lesson.focus;
  focusText.textContent = lesson.text;
  boardNote.textContent = lesson.summary;
  renderLessons();
  setPrompt();
}

function applyLessonDecorations() {
  if (activeLesson !== "coordinates") {
    setPrompt();
  }
}

function updateScore() {
  scoreEl.textContent = score;
  if (score < 30) scoreText.textContent = "Early pattern acquisition.";
  else if (score < 70) scoreText.textContent = "Board vision improving.";
  else scoreText.textContent = "Strong session. The neurons appear cooperative.";
}

pitch.addEventListener("input", setSceneTransform);
turn.addEventListener("input", setSceneTransform);

flipBoard.addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
});

resetBoard.addEventListener("click", () => {
  score = 0;
  flipped = false;
  turnColour = "white";
  selectedFrom = null;
  pieces = { ...STARTING_PIECES };
  pitch.value = 52;
  turn.value = 0;
  renderBoard();
  setSceneTransform();
  updateScore();
  selectLesson("freeplay");
});

startLesson.addEventListener("click", () => {
  document.getElementById("trainer").scrollIntoView({ behavior: "smooth" });
  setPrompt();
});

newPrompt.addEventListener("click", setPrompt);

showAnswer.addEventListener("click", () => {
  if (activeLesson === "coordinates") {
    mark(currentTarget, "answer");
    feedback.textContent = `Answer shown: ${currentTarget}. Observe, then repeat without assistance.`;
  } else if (selectedPiece) {
    legalMoves(selectedPiece).forEach(s => mark(s, "answer"));
    feedback.textContent = `Answer geometry shown for ${selectedPiece}.`;
  } else {
    feedback.textContent = "No single answer for this lesson. Chess resists lazy certainty.";
  }
});

selectLesson("freeplay");
renderBoard();
setSceneTransform();
setPrompt();
updateScore();
