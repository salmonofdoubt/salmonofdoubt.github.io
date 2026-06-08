import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";

const sceneWrap = document.querySelector(".scene-wrap");
const oldBoard = document.getElementById("board3d");
const pitch = document.getElementById("pitch");
const turn = document.getElementById("turn");
const flipBoard = document.getElementById("flipBoard");
const resetBoard = document.getElementById("resetBoard");
const playWebsite = document.getElementById("playWebsite");
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

if (oldBoard) oldBoard.remove();

const FILES = ["a","b","c","d","e","f","g","h"];
const STARTING_PIECES = {
  a1: "♖", b1: "♘", c1: "♗", d1: "♕", e1: "♔", f1: "♗", g1: "♘", h1: "♖",
  a2: "♙", b2: "♙", c2: "♙", d2: "♙", e2: "♙", f2: "♙", g2: "♙", h2: "♙",
  a7: "♟", b7: "♟", c7: "♟", d7: "♟", e7: "♟", f7: "♟", g7: "♟", h7: "♟",
  a8: "♜", b8: "♞", c8: "♝", d8: "♛", e8: "♚", f8: "♝", g8: "♞", h8: "♜"
};

let game = new Chess();
let pieces = piecesFromGame();
let activeLesson = "freeplay";
let currentTarget = "e4";
let selectedFrom = null;
let selectedPiece = null;
let turnColour = "white";
let flipped = false;
let score = 0;
let playAgainstWebsite = true;
let humanColour = "white";
let websiteColour = "black";
let websiteThinking = false;
const ENGINE_DEPTH = 2;
let lastCalculation = [];

const lessons = [
  {
    id: "freeplay",
    title: "Free play",
    summary: "Play White against the website. Click a standing piece, then a highlighted destination.",
    focus: "Play the position",
    text: "This is now a real 3D teaching board with procedural standing pieces.",
    intro: "You play White. The website replies as Black using a lightweight tactical heuristic."
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

function pieceKind(symbol) {
  return ({
    "♔": "king", "♚": "king",
    "♕": "queen", "♛": "queen",
    "♖": "rook", "♜": "rook",
    "♗": "bishop", "♝": "bishop",
    "♘": "knight", "♞": "knight",
    "♙": "pawn", "♟": "pawn"
  })[symbol] || "pawn";
}

function pieceName(symbol) {
  return ({
    "♔": "White king", "♕": "White queen", "♖": "White rook", "♗": "White bishop", "♘": "White knight", "♙": "White pawn",
    "♚": "Black king", "♛": "Black queen", "♜": "Black rook", "♝": "Black bishop", "♞": "Black knight", "♟": "Black pawn"
  })[symbol] || "Piece";
}


function colourWord(code) {
  return code === "w" ? "white" : "black";
}

function colourCode(word) {
  return word === "white" ? "w" : "b";
}

function symbolFromPiece(piece) {
  if (!piece) return null;
  const map = {
    wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
    bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚"
  };
  return map[`${piece.color}${piece.type}`] || null;
}

function piecesFromGame() {
  const out = {};
  const rows = game.board();

  rows.forEach((row, rowIndex) => {
    const rank = 8 - rowIndex;

    row.forEach((piece, fileIndex) => {
      if (!piece) return;

      const square = `${FILES[fileIndex]}${rank}`;
      out[square] = symbolFromPiece(piece);
    });
  });

  return out;
}

function syncPiecesFromGame() {
  pieces = piecesFromGame();
  turnColour = colourWord(game.turn());
}

function legalMoves(square) {
  return game.moves({ square, verbose: true }).map(m => m.to);
}



function legalVerboseMoves(square) {
  return game.moves({ square, verbose: true });
}

function currentStatusText() {
  const side = colourWord(game.turn());
  if (game.isCheckmate()) return `Checkmate. ${side} is mated.`;
  if (game.isStalemate()) return "Stalemate.";
  if (game.isDraw()) return "Draw.";
  if (game.isCheck()) return `${side} is in check.`;
  return `${side} to move.`;
}

function ensureStrategyPanel() {
  if (document.getElementById("strategyPanel")) return;

  const trainer = document.getElementById("trainer");
  if (!trainer) return;

  trainer.insertAdjacentHTML("afterend", `
    <section class="panel strategy-panel" id="strategyPanel">
      <p class="eyebrow">Strategy engine</p>
      <h2>Calculation cockpit</h2>
      <p class="panel-intro">
        The website uses legal moves from chess.js, then evaluates candidate moves with a small transparent search.
      </p>

      <div class="strategy-grid">
        <article>
          <span>Rules status</span>
          <strong id="rulesStatus">Loading</strong>
        </article>
        <article>
          <span>Search depth</span>
          <strong id="searchDepth">2 ply</strong>
        </article>
        <article>
          <span>Position score</span>
          <strong id="positionScore">0</strong>
        </article>
      </div>

      <div class="calc-table-wrap">
        <table class="calc-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Candidate</th>
              <th>Score</th>
              <th>Why it likes it</th>
            </tr>
          </thead>
          <tbody id="calculationRows">
            <tr><td colspan="4">No calculation yet.</td></tr>
          </tbody>
        </table>
      </div>

      <div class="coach-box">
        <strong>Coach note</strong>
        <p id="coachNote">Make a move. The website will reply and explain its candidate list.</p>
      </div>

      <details class="fen-box">
        <summary>FEN / PGN</summary>
        <code id="fenOutput"></code>
        <pre id="pgnOutput"></pre>
      </details>
    </section>
  `);
}

const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function centreBonus(square) {
  const f = FILES.indexOf(square[0]);
  const r = Number(square[1]) - 1;
  const d = Math.abs(f - 3.5) + Math.abs(r - 3.5);
  return Math.round((7 - d) * 6);
}

function evaluatePosition() {
  if (game.isCheckmate()) {
    return colourWord(game.turn()) === websiteColour ? -999999 : 999999;
  }

  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const sign = colourWord(piece.color) === websiteColour ? 1 : -1;
      score += sign * (pieceValues[piece.type] || 0);
      score += sign * centreBonus(piece.square);

      if ((piece.type === "n" || piece.type === "b") && ["b1","g1","b8","g8","c1","f1","c8","f8"].includes(piece.square)) {
        score -= sign * 18;
      }
    }
  }

  const turnBefore = game.turn();
  const mobility = game.moves().length;
  score += colourWord(turnBefore) === websiteColour ? mobility * 2 : -mobility * 2;

  if (game.isCheck()) {
    score += colourWord(game.turn()) === websiteColour ? -70 : 70;
  }

  return Math.round(score);
}

function search(depth, alpha, beta) {
  if (game.isCheckmate()) {
    return colourWord(game.turn()) === websiteColour ? -999999 + depth : 999999 - depth;
  }
  if (game.isDraw() || game.isStalemate()) return 0;
  if (depth === 0) return evaluatePosition();

  const moves = game.moves({ verbose: true });
  const websiteToMove = colourWord(game.turn()) === websiteColour;

  if (websiteToMove) {
    let best = -Infinity;
    for (const move of moves) {
      game.move(move);
      best = Math.max(best, search(depth - 1, alpha, beta));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    game.move(move);
    best = Math.min(best, search(depth - 1, alpha, beta));
    game.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function moveTags(move, score) {
  const tags = [];

  if (move.captured) tags.push(`wins material: captures ${move.captured}`);
  if (move.san.includes("+")) tags.push("gives check");
  if (move.san.includes("#")) tags.push("checkmate");
  if (["e4", "d4", "e5", "d5", "c4", "f4", "c5", "f5"].includes(move.to)) tags.push("claims central space");
  if ((move.piece === "n" || move.piece === "b") && ["b8","g8","b1","g1","c8","f8","c1","f1"].includes(move.from)) tags.push("develops a minor piece");
  if (move.flags && move.flags.includes("k")) tags.push("castles king-side");
  if (move.flags && move.flags.includes("q")) tags.push("castles queen-side");
  if (Math.abs(score) > 600) tags.push("large tactical swing");
  if (!tags.length) tags.push("improves position according to material, centre, mobility, and king safety");

  return tags.join("; ");
}

function analyseRoot(depth = ENGINE_DEPTH) {
  const moves = game.moves({ verbose: true });
  const rows = [];

  for (const move of moves) {
    game.move(move);
    const score = search(depth - 1, -Infinity, Infinity);
    game.undo();

    rows.push({
      move,
      san: move.san,
      from: move.from,
      to: move.to,
      score,
      why: moveTags(move, score)
    });
  }

  rows.sort((a, b) => b.score - a.score);
  lastCalculation = rows.slice(0, 6);
  return lastCalculation;
}

function renderStrategyPanel() {
  ensureStrategyPanel();

  const rulesStatus = document.getElementById("rulesStatus");
  const searchDepth = document.getElementById("searchDepth");
  const positionScore = document.getElementById("positionScore");
  const calculationRows = document.getElementById("calculationRows");
  const coachNote = document.getElementById("coachNote");
  const fenOutput = document.getElementById("fenOutput");
  const pgnOutput = document.getElementById("pgnOutput");

  if (!rulesStatus) return;

  const evalScore = evaluatePosition();
  rulesStatus.textContent = currentStatusText();
  searchDepth.textContent = `${ENGINE_DEPTH} ply`;
  positionScore.textContent = `${evalScore > 0 ? "+" : ""}${evalScore}`;

  if (fenOutput) fenOutput.textContent = game.fen();
  if (pgnOutput) pgnOutput.textContent = game.pgn() || "No moves yet.";

  if (calculationRows) {
    if (!lastCalculation.length) {
      calculationRows.innerHTML = `<tr><td colspan="4">No calculation yet.</td></tr>`;
    } else {
      calculationRows.innerHTML = lastCalculation.map((row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${row.san}</strong><small>${row.from}→${row.to}</small></td>
          <td>${row.score > 0 ? "+" : ""}${row.score}</td>
          <td>${row.why}</td>
        </tr>
      `).join("");
    }
  }

  if (coachNote) {
    if (game.isCheckmate()) coachNote.textContent = "The position is checkmate. The rules engine, not the visual board, determines this.";
    else if (game.isCheck()) coachNote.textContent = "The side to move is in check. Only moves that resolve check are legal.";
    else if (lastCalculation[0]) coachNote.textContent = `Website preference: ${lastCalculation[0].san}. It is ranking candidate moves, not guessing.`;
    else coachNote.textContent = "Make a move. The website will calculate candidate replies.";
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 8.5, 9.5);
camera.lookAt(0, 0, 0);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const squareMeshes = new Map();
const pieceMeshes = new Map();
const markerMeshes = [];
const boardSize = 8;
const squareSize = 1;
const boardOffset = 3.5;

const matLight = new THREE.MeshStandardMaterial({
  color: 0xe7d5b4,
  roughness: 0.42,
  metalness: 0.08
});

const matDark = new THREE.MeshStandardMaterial({
  color: 0x273247,
  roughness: 0.52,
  metalness: 0.10
});

const matEdge = new THREE.MeshStandardMaterial({
  color: 0x111722,
  roughness: 0.38,
  metalness: 0.22
});

const matWhite = new THREE.MeshPhysicalMaterial({
  color: 0xf5e6c8,
  roughness: 0.34,
  metalness: 0.06,
  clearcoat: 0.72,
  clearcoatRoughness: 0.18
});

const matBlack = new THREE.MeshPhysicalMaterial({
  color: 0x151b28,
  roughness: 0.36,
  metalness: 0.18,
  clearcoat: 0.82,
  clearcoatRoughness: 0.20
});

const matWhiteTrim = new THREE.MeshStandardMaterial({
  color: 0xd6bd8e,
  roughness: 0.28,
  metalness: 0.34
});

const matBlackTrim = new THREE.MeshStandardMaterial({
  color: 0x5be7ff,
  roughness: 0.22,
  metalness: 0.42,
  emissive: 0x0a5d70,
  emissiveIntensity: 0.16
});

const matLegal = new THREE.MeshBasicMaterial({
  color: 0x18c6d8,
  transparent: true,
  opacity: 0.38,
  depthWrite: false
});

const matTarget = new THREE.MeshBasicMaterial({
  color: 0xf2c46d,
  transparent: true,
  opacity: 0.52,
  depthWrite: false
});

scene.add(new THREE.HemisphereLight(0xdff8ff, 0x080a10, 2.2));

const key = new THREE.DirectionalLight(0xffffff, 3.6);
key.position.set(-4, 8, 6);
key.castShadow = true;
key.shadow.mapSize.width = 2048;
key.shadow.mapSize.height = 2048;
scene.add(key);

const rim = new THREE.DirectionalLight(0x66eaff, 2.4);
rim.position.set(5, 5, -5);
scene.add(rim);

const warm = new THREE.PointLight(0xf2c46d, 1.8, 20);
warm.position.set(0, 4, 3.8);
scene.add(warm);

function squareToWorld(square) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  const x = file - boardOffset;
  const z = flipped ? rank - boardOffset : boardOffset - rank;
  return { x, z };
}

function worldToSquareName(fileIndex, rank) {
  return `${FILES[fileIndex]}${rank}`;
}

function createBoard() {
  boardGroup.clear();
  squareMeshes.clear();
  pieceMeshes.clear();
  markerMeshes.length = 0;

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(8.65, 0.32, 8.65),
    matEdge
  );
  slab.position.y = -0.2;
  slab.receiveShadow = true;
  slab.castShadow = true;
  boardGroup.add(slab);

  for (let rank = 1; rank <= 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = `${FILES[file]}${rank}`;
      const { x, z } = squareToWorld(sq);
      const isLight = (file + rank) % 2 === 1;

      const square = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.12, 1),
        isLight ? matLight : matDark
      );
      square.position.set(x, 0, z);
      square.receiveShadow = true;
      square.userData.square = sq;
      square.userData.type = "square";
      boardGroup.add(square);
      squareMeshes.set(sq, square);
    }
  }

  renderPieces();
}

function makeLathe(points, material) {
  const geometry = new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    56
  );
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addCylinder(group, radius, height, y, material, segments = 64) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addSphere(group, radius, y, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.scale.set(...scale);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(group, size, pos, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function pieceProfile(kind) {
  const common = [
    [0.00, 0.00],
    [0.36, 0.00],
    [0.42, 0.06],
    [0.42, 0.12],
    [0.34, 0.18],
    [0.26, 0.22]
  ];

  if (kind === "pawn") {
    return [
      ...common,
      [0.20, 0.40],
      [0.22, 0.58],
      [0.30, 0.68],
      [0.22, 0.80],
      [0.00, 0.82]
    ];
  }

  if (kind === "rook") {
    return [
      ...common,
      [0.25, 0.42],
      [0.31, 0.56],
      [0.30, 0.70],
      [0.38, 0.74],
      [0.38, 0.88],
      [0.00, 0.88]
    ];
  }

  if (kind === "bishop") {
    return [
      ...common,
      [0.22, 0.42],
      [0.30, 0.58],
      [0.24, 0.80],
      [0.10, 1.02],
      [0.00, 1.07]
    ];
  }

  if (kind === "queen") {
    return [
      ...common,
      [0.24, 0.42],
      [0.31, 0.60],
      [0.23, 0.82],
      [0.33, 0.98],
      [0.22, 1.12],
      [0.00, 1.14]
    ];
  }

  if (kind === "king") {
    return [
      ...common,
      [0.25, 0.44],
      [0.32, 0.64],
      [0.24, 0.86],
      [0.30, 1.02],
      [0.18, 1.16],
      [0.00, 1.18]
    ];
  }

  return [
    ...common,
    [0.25, 0.46],
    [0.18, 0.78],
    [0.00, 0.88]
  ];
}

function createKnight(material, trim) {
  const group = new THREE.Group();

  addCylinder(group, 0.38, 0.12, 0.06, material);
  addCylinder(group, 0.30, 0.10, 0.18, trim);
  addCylinder(group, 0.22, 0.38, 0.40, material);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.42, 10, 20),
    material
  );
  body.position.set(0.02, 0.68, 0);
  body.rotation.z = -0.28;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.24),
    material
  );
  head.position.set(0.08, 0.98, 0);
  head.rotation.z = -0.52;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.34, 4),
    material
  );
  nose.position.set(0.22, 0.96, 0);
  nose.rotation.z = -Math.PI / 2.7;
  nose.rotation.y = Math.PI / 4;
  nose.castShadow = true;
  group.add(nose);

  const mane = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.45, 0.28),
    trim
  );
  mane.position.set(-0.09, 0.88, 0);
  mane.rotation.z = -0.18;
  mane.castShadow = true;
  group.add(mane);

  return group;
}

function createStandingPiece(symbol) {
  const kind = pieceKind(symbol);
  const colour = colourOfPiece(symbol);
  const material = colour === "white" ? matWhite : matBlack;
  const trim = colour === "white" ? matWhiteTrim : matBlackTrim;

  const group = new THREE.Group();
  group.userData.symbol = symbol;
  group.userData.kind = kind;
  group.userData.colour = colour;

  if (kind === "knight") {
    const knight = createKnight(material, trim);
    group.add(knight);
  } else {
    const body = makeLathe(pieceProfile(kind), material);
    group.add(body);

    if (kind === "rook") {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const tooth = addBox(group, [0.12, 0.16, 0.12], [Math.cos(a) * 0.28, 0.96, Math.sin(a) * 0.28], trim);
        tooth.rotation.y = a;
      }
    }

    if (kind === "bishop") {
      const cut = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.36, 0.08),
        trim
      );
      cut.position.set(0.08, 0.94, 0);
      cut.rotation.z = -0.65;
      cut.castShadow = true;
      group.add(cut);
    }

    if (kind === "queen") {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        addSphere(group, 0.055, 1.22, trim).position.set(Math.cos(a) * 0.27, 1.22, Math.sin(a) * 0.27);
      }
      addSphere(group, 0.07, 1.29, trim);
    }

    if (kind === "king") {
      addBox(group, [0.08, 0.32, 0.08], [0, 1.32, 0], trim);
      addBox(group, [0.26, 0.07, 0.07], [0, 1.40, 0], trim);
    }

    if (kind === "pawn") {
      addSphere(group, 0.19, 0.86, material);
    }
  }

  const scale = kind === "pawn" ? 0.72 : kind === "king" ? 0.84 : kind === "queen" ? 0.82 : 0.78;
  group.scale.setScalar(scale);

  group.traverse(obj => {
    if (obj.isMesh) {
      obj.userData.type = "piece";
      obj.userData.parentPiece = group;
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

function renderPieces() {
  syncPiecesFromGame();
  for (const mesh of pieceMeshes.values()) {
    boardGroup.remove(mesh);
  }
  pieceMeshes.clear();

  for (const [sq, symbol] of Object.entries(pieces)) {
    const piece = createStandingPiece(symbol);
    const { x, z } = squareToWorld(sq);
    piece.position.set(x, 0.07, z);
    piece.userData.square = sq;
    piece.rotation.y = colourOfPiece(symbol) === "white" ? 0 : Math.PI;
    boardGroup.add(piece);
    pieceMeshes.set(sq, piece);
  }
}

function clearMarkers() {
  markerMeshes.forEach(m => boardGroup.remove(m));
  markerMeshes.length = 0;
}

function mark(square, mode = "legal") {
  const { x, z } = squareToWorld(square);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(mode === "target" ? 0.44 : 0.24, mode === "target" ? 0.44 : 0.24, 0.025, 64),
    mode === "target" ? matTarget : matLegal
  );
  mesh.position.set(x, 0.095, z);
  mesh.userData.type = "marker";
  boardGroup.add(mesh);
  markerMeshes.push(mesh);
}

function randomSquare() {
  const f = FILES[Math.floor(Math.random() * FILES.length)];
  const r = 1 + Math.floor(Math.random() * 8);
  return `${f}${r}`;
}

function setCamera() {
  const p = Number(pitch.value);
  const t = Number(turn.value) * Math.PI / 180;
  const radius = 11.2;
  const y = 4.3 + (p / 68) * 6;
  camera.position.set(Math.sin(t) * radius, y, Math.cos(t) * radius);
  if (flipped) camera.position.multiplyScalar(-1);
  camera.lookAt(0, 0, 0);
}

function resize() {
  const rect = sceneWrap.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

function render() {
  renderer.render(scene, camera);
}

function animate() {
  for (const piece of pieceMeshes.values()) {
    piece.rotation.y += 0;
  }
  render();
  requestAnimationFrame(animate);
}

function squareName(fileIndex, rank) {
  return `${FILES[fileIndex]}${rank}`;
}

function occupant(file, rank) {
  return pieces[squareName(file, rank)];
}

function inBounds(file, rank) {
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8;
}




function setPrompt() {
  clearMarkers();
  selectedPiece = null;
  selectedFrom = null;

  if (activeLesson === "freeplay") {
    promptEl.textContent = `${turnColour === "white" ? "White" : "Black"} to move`;
    feedback.textContent = currentStatusText() + " Click one of your standing pieces, then click a highlighted destination.";
    renderStrategyPanel();
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
  if (websiteThinking) {
    feedback.textContent = "The website is thinking. A modest silicon meditation is in progress.";
    return;
  }

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
    clearMarkers();
    mark(square, "target");
    legalMoves(square).forEach(s => mark(s));
    feedback.textContent = `${pieceName(pieces[square])} on ${square}: movement geometry highlighted.`;
    score = Math.min(100, score + 4);
    updateScore();
    return;
  }

  score = Math.min(100, score + 4);
  feedback.textContent = `${square} inspected. Pattern recognition improving.`;
  updateScore();
}

function handleFreePlay(square) {
  syncPiecesFromGame();

  if (playAgainstWebsite && turnColour === websiteColour) {
    scheduleWebsiteMove();
    return;
  }

  const piece = game.get(square);

  if (!selectedFrom) {
    if (!piece) {
      feedback.textContent = `${square} is empty. Select a ${turnColour} piece.`;
      return;
    }

    if (colourWord(piece.color) !== turnColour) {
      feedback.textContent = `It is ${turnColour}'s move. That piece is ${colourWord(piece.color)}.`;
      return;
    }

    selectedFrom = square;
    clearMarkers();
    mark(square, "target");
    legalMoves(square).forEach(s => mark(s));
    feedback.textContent = `${pieceName(pieces[square])} selected on ${square}. Choose a legal highlighted square.`;
    renderStrategyPanel();
    return;
  }

  if (square === selectedFrom) {
    selectedFrom = null;
    clearMarkers();
    feedback.textContent = "Selection cancelled.";
    renderStrategyPanel();
    return;
  }

  const selectedPieceData = game.get(selectedFrom);
  const clickedPieceData = game.get(square);

  if (clickedPieceData && selectedPieceData && clickedPieceData.color === selectedPieceData.color) {
    selectedFrom = null;
    handleFreePlay(square);
    return;
  }

  const move = legalVerboseMoves(selectedFrom).find(m => m.to === square);

  if (!move) {
    feedback.textContent = `${square} is not legal from ${selectedFrom}. If you are in check, the move must resolve check.`;
    renderStrategyPanel();
    return;
  }

  executeMove(selectedFrom, square, false);
}



function executeMove(from, to, byWebsite = false) {
  const move = game.move({ from, to, promotion: "q" });

  if (!move) {
    feedback.textContent = `${from} to ${to} is illegal in the current position.`;
    renderStrategyPanel();
    return false;
  }

  syncPiecesFromGame();
  renderPieces();
  clearMarkers();

  selectedFrom = null;
  selectedPiece = null;
  promptEl.textContent = currentStatusText();

  if (byWebsite) {
    feedback.textContent = `Website played ${move.san}. ${currentStatusText()}`;
  } else {
    feedback.textContent = `You played ${move.san}. ${currentStatusText()}`;
  }

  score = Math.min(100, score + (byWebsite ? 2 : 3));
  updateScore();
  renderStrategyPanel();

  if (!byWebsite && activeLesson === "freeplay" && playAgainstWebsite && turnColour === websiteColour && !game.isGameOver()) {
    scheduleWebsiteMove();
  }

  return true;
}


function allLegalMoves(colour) {
  if (turnColour !== colour) return [];
  return game.moves({ verbose: true });
}


function moveValue(move) {
  const values = {
    pawn: 100,
    knight: 320,
    bishop: 330,
    rook: 500,
    queen: 900,
    king: 10000
  };

  const kind = pieceKind(move.piece);
  const targetKind = move.capture ? pieceKind(move.capture) : null;

  let v = 0;

  if (move.capture) {
    v += (values[targetKind] || 0) * 5;
    v -= (values[kind] || 0) * 0.25;
  }

  const file = FILES.indexOf(move.to[0]);
  const rank = Number(move.to[1]);
  const centreDistance = Math.abs(file - 3.5) + Math.abs(rank - 4.5);
  v += (7 - centreDistance) * 18;

  if (kind === "knight" || kind === "bishop") {
    if (["b8", "g8", "b1", "g1", "c8", "f8", "c1", "f1"].includes(move.from)) {
      v += 70;
    }
  }

  if (kind === "queen") v -= 18;
  if (kind === "king") v -= 120;

  if (kind === "pawn") {
    v += websiteColour === "black" ? (8 - rank) * 8 : rank * 8;
  }

  v += Math.random() * 42;

  return v;
}

function chooseWebsiteMove() {
  if (game.isGameOver()) return null;
  const lines = analyseRoot(ENGINE_DEPTH);
  renderStrategyPanel();
  return lines[0]?.move || null;
}


function scheduleWebsiteMove() {
  if (!playAgainstWebsite || activeLesson !== "freeplay") return;
  if (turnColour !== websiteColour) return;
  if (websiteThinking) return;

  websiteThinking = true;
  promptEl.textContent = "Website thinking";
  feedback.textContent = "Website is calculating a reply. Crude, but enthusiastic.";

  setTimeout(makeWebsiteMove, 650);
}

function makeWebsiteMove() {
  if (!playAgainstWebsite || activeLesson !== "freeplay" || turnColour !== websiteColour) {
    websiteThinking = false;
    return;
  }

  if (game.isGameOver()) {
    websiteThinking = false;
    renderStrategyPanel();
    return;
  }

  const move = chooseWebsiteMove();

  if (!move) {
    websiteThinking = false;
    feedback.textContent = "Website has no legal move.";
    renderStrategyPanel();
    return;
  }

  websiteThinking = false;
  executeMove(move.from, move.to, true);
}



function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const objects = [];
  boardGroup.traverse(obj => {
    if (obj.isMesh && obj.userData.type !== "marker") objects.push(obj);
  });

  const hits = raycaster.intersectObjects(objects, true);
  if (!hits.length) return;

  let target = hits[0].object;

  if (target.userData.type === "piece" && target.userData.parentPiece) {
    handleSquareClick(target.userData.parentPiece.userData.square);
    return;
  }

  if (target.userData.type === "square") {
    handleSquareClick(target.userData.square);
  }
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

function updateScore() {
  scoreEl.textContent = score;
  if (score < 30) scoreText.textContent = "Early pattern acquisition.";
  else if (score < 70) scoreText.textContent = "Board vision improving.";
  else scoreText.textContent = "Strong session. The neurons appear cooperative.";
}

pitch.addEventListener("input", () => {
  setCamera();
  render();
});

turn.addEventListener("input", () => {
  setCamera();
  render();
});

flipBoard.addEventListener("click", () => {
  flipped = !flipped;
  createBoard();
  setCamera();
  setPrompt();
});


function syncWebsiteButton() {
  if (!playWebsite) return;
  playWebsite.textContent = playAgainstWebsite ? "Website: Black" : "Human vs human";
  playWebsite.classList.toggle("primary", playAgainstWebsite);
}

if (playWebsite) {
  playWebsite.addEventListener("click", () => {
    playAgainstWebsite = !playAgainstWebsite;
    websiteThinking = false;
    selectedFrom = null;
    clearMarkers();
    syncWebsiteButton();
    setPrompt();

    if (playAgainstWebsite && activeLesson === "freeplay" && turnColour === websiteColour) {
      scheduleWebsiteMove();
    }
  });
}


resetBoard.addEventListener("click", () => {
  game.reset();
  syncPiecesFromGame();
  turnColour = "white";
  selectedFrom = null;
  selectedPiece = null;
  websiteThinking = false;
  score = 0;
  flipped = false;
  pitch.value = 52;
  turn.value = 0;
  createBoard();
  setCamera();
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
    mark(currentTarget, "target");
    feedback.textContent = `Answer shown: ${currentTarget}. Observe, then repeat without assistance.`;
  } else if (selectedPiece) {
    legalMoves(selectedPiece).forEach(s => mark(s));
    feedback.textContent = `Answer geometry shown for ${selectedPiece}.`;
  } else {
    feedback.textContent = "No single answer for this lesson. Chess resists lazy certainty.";
  }
});

renderer.domElement.addEventListener("pointerdown", onPointerDown);
window.addEventListener("resize", () => {
  resize();
  setCamera();
});

ensureStrategyPanel();
resize();
createBoard();
setCamera();
renderLessons();
syncWebsiteButton();
selectLesson("freeplay");
updateScore();
renderStrategyPanel();
animate();
