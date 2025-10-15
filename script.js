// script.js
// Fully fixed & robust online Tic Tac Toe logic (Firebase compat required)
// - Requirements addressed: popup messages, 3s confetti, auto-reset, presence cleanup, scoreboard sync,
//   winner starts next round, draw behavior, stable labels, highlight removal, defensive checks.

// ---------------- Firebase init (keep your config) ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBaUs_6FGX6q2WGqJJxOUD4qNbYevD_E3o",
  authDomain: "my-happiness-01.firebaseapp.com",
  databaseURL: "https://my-happiness-01-default-rtdb.firebaseio.com",
  projectId: "my-happiness-01",
  storageBucket: "my-happiness-01.firebasestorage.app",
  messagingSenderId: "53559041527",
  appId: "1:53559041527:web:d49abb1756ffec28e0a2f2",
  measurementId: "G-5XW3H8HQML"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------------- Main ----------------
document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const createRoomBtn = document.querySelector('.create-room');
  const joinRoomBtn = document.querySelector('.join');
  const roomInput = document.querySelector('.room input');
  const cells = Array.from(document.querySelectorAll('.cell'));
  const infoText = document.querySelector('.name p');
  const resetBtn = document.querySelector('.name button');
  const playerXScoreEl = document.getElementById('player1'); // Player X (left)
  const drawScoreEl = document.getElementById('draw');
  const playerOScoreEl = document.getElementById('player2'); // Player O (right)
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const messagesEl = document.getElementById('messages');

  // State
  let roomId = null;
  let playerSymbol = null; // 'X' or 'O' for this client
  let board = Array(9).fill('');
  let isGameActive = false;
  let bothConnected = false;
  let confettiHandle = null;
  let confettiParticles = [];
  let scores = { X: 0, O: 0, D: 0 }; // local mirror; authoritative in DB

  // Helpers
  function genRoomId() { return Math.random().toString(36).slice(2,8).toUpperCase(); }

  function setStatus(msg) { infoText.textContent = msg; }

  function updateBoardUI() {
    cells.forEach((cell, i) => {
      cell.textContent = board[i] || '';
      cell.style.fontSize = '3rem';
      cell.style.fontWeight = 'bold';
      // ensure default bg restored if not highlighted
      if (!cell.classList.contains('highlight')) {
        cell.style.backgroundColor = '#000';
      }
    });
  }

  function updateScoreUI() {
    // Keep labels static: left is Player X, right is Player O
    playerXScoreEl.innerHTML = `Player X<br>${scores.X}`;
    drawScoreEl.innerHTML = `Draws<br>${scores.D}`;
    playerOScoreEl.innerHTML = `Player O<br>${scores.O}`;
  }

  // Popups (centered)
  function showPopupCentered(text, duration = 3000) {
    const p = document.createElement('div');
    p.className = 'ttt-popup';
    p.innerText = text;
    Object.assign(p.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.85)',
      color: '#fff',
      padding: '18px 24px',
      borderRadius: '12px',
      zIndex: 9999,
      fontSize: '1.1rem',
      textAlign: 'center',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
    });
    document.body.appendChild(p);
    setTimeout(() => { p.remove(); }, duration);
  }

  // Confetti (canvas) - run for exact duration (ms)
  const confettiCanvas = document.createElement('canvas');
  confettiCanvas.style.position = 'fixed';
  confettiCanvas.style.left = '0';
  confettiCanvas.style.top = '0';
  confettiCanvas.style.width = '100%';
  confettiCanvas.style.height = '100%';
  confettiCanvas.style.pointerEvents = 'none';
  confettiCanvas.style.zIndex = '9998';
  document.body.appendChild(confettiCanvas);
  const confettiCtx = confettiCanvas.getContext('2d');

  function startConfetti(duration = 3000) {
    // set canvas size
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiParticles = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height - confettiCanvas.height,
        r: Math.random() * 6 + 4,
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltAngleIncrement: Math.random() * 0.07 + 0.05,
        color: `hsl(${Math.floor(Math.random() * 360)}, 90%, 55%)`,
        speed: Math.random() * 3 + 2
      });
    }
    let start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiParticles.forEach(p => {
        confettiCtx.beginPath();
        confettiCtx.lineWidth = p.r / 2;
        confettiCtx.strokeStyle = p.color;
        confettiCtx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        confettiCtx.stroke();

        p.tiltAngle += p.tiltAngleIncrement;
        p.y += (Math.cos(p.tiltAngle) + p.speed);
        p.tilt = Math.sin(p.tiltAngle) * 15;
        if (p.y > confettiCanvas.height + 20) {
          p.y = -20 - Math.random() * 200;
          p.x = Math.random() * confettiCanvas.width;
        }
      });
      confettiHandle = requestAnimationFrame(frame);
      if (elapsed >= duration) {
        stopConfetti();
      }
    }
    confettiHandle = requestAnimationFrame(frame);
  }

  function stopConfetti() {
    if (confettiHandle) cancelAnimationFrame(confettiHandle);
    confettiHandle = null;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles = [];
  }

  // Highlight winning cells & mark with class
  function highlightCombo(combo) {
    combo.forEach(i => {
      const c = cells[i];
      c.classList.add('highlight');
      // color set by winner check prior to calling
    });
  }

  function clearHighlights() {
    cells.forEach(c => {
      c.classList.remove('highlight');
      c.style.backgroundColor = '#000';
    });
  }

  // ---------- Firebase utilities ----------
  function roomRef(id) { return db.ref(`rooms/${id}`); }

  // set onDisconnect for player flags
  function attachPresenceHandlers(id, isPlayer1) {
    const ref = roomRef(id);
    const playerKey = isPlayer1 ? 'player1' : 'player2';
    const myPresenceRef = ref.child(playerKey);
    // When this client disconnects, mark their slot false
    myPresenceRef.onDisconnect().set(false).catch(e => console.warn('onDisconnect error', e));
  }

  // ---------- Game logic helpers (safely sync) ----------
  function safeWriteScoresToDB(id) {
    return roomRef(id).child('scores').set(scores).catch(e => console.warn('score set err', e));
  }

  function safeSetBoardAndTurn(id, newBoard, nextTurn, lastWinner = null) {
    const updates = { board: newBoard, turn: nextTurn };
    if (lastWinner !== null) updates.lastWinner = lastWinner;
    return roomRef(id).update(updates).catch(e => console.warn('safeSetBoardAndTurn err', e));
  }

  // check for winner locally & return { winner, combo } or null, but keep as read-only decision
  function detectWinner(boardState) {
    const combos = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const combo of combos) {
      const [a,b,c] = combo;
      if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
        return { winner: boardState[a], combo };
      }
    }
    return null;
  }

  // ---------- Core listeners & actions ----------

  // attach cell listeners (prevent double attaching)
  cells.forEach((cell, i) => {
    cell.addEventListener('click', async () => {
      try {
        if (!roomId || !bothConnected || !isGameActive) return;
        if (board[i]) return; // already marked
        // get live room data to ensure we have latest turn
        const snap = await roomRef(roomId).once('value');
        const data = snap.val();
        if (!data) return;
        if (data.turn !== playerSymbol) return; // not our turn
        // write move
        board[i] = playerSymbol;
        await roomRef(roomId).child('board').set(board);

        // check winner on server-state (we use local board but server will broadcast)
        const detection = detectWinner(board);
        if (detection) {
          // update scores & lastWinner
          scores[detection.winner] = (scores[detection.winner] || 0) + 1;
          await safeWriteScoresToDB(roomId);
          await roomRef(roomId).update({ lastWinner: detection.winner, turn: detection.winner }); // winner starts next
          // highlight (both clients will do highlight on incoming snapshot)
          // schedule auto-reset after 3s (we'll rely on DB listeners to reset board)
          // but set a small timeout to reset board on DB after 3s:
          setTimeout(async () => {
            clearHighlights();
            // prepare next board (empty) and set turn to lastWinner (winner starts)
            board = Array(9).fill('');
            await safeSetBoardAndTurn(roomId, board, detection.winner, detection.winner);
          }, 3000);
        } else if (!board.includes('')) {
          // draw
          scores.D = (scores.D || 0) + 1;
          await safeWriteScoresToDB(roomId);
          // next round turn = lastWinner if exists else 'X'
          const snap2 = await roomRef(roomId).once('value');
          const lastW = (snap2.val() && snap2.val().lastWinner) || 'X';
          setTimeout(async () => {
            board = Array(9).fill('');
            await safeSetBoardAndTurn(roomId, board, lastW, snap2.val() ? snap2.val().lastWinner : null);
          }, 3000);
        } else {
          // no win/draw - just change turn
          const next = (playerSymbol === 'X') ? 'O' : 'X';
          await roomRef(roomId).child('turn').set(next);
        }
      } catch (err) {
        console.error('cell click err', err);
      }
    });
  });

  // Create room
  createRoomBtn.addEventListener('click', async () => {
    try {
      roomId = genRoomId();
      roomInput.value = roomId; // put ID into input for sharing
      playerSymbol = 'X';
      // initialize room structure
      await roomRef(roomId).set({
        board: Array(9).fill(''),
        turn: 'X',
        player1: true,
        player2: false,
        scores: { X: 0, O: 0, D: 0 },
        lastWinner: null
      });
      // set presence cleanup
      attachPresenceHandlers(roomId, true);
      // listen to room & chat
      listenRoom(roomId);
      listenChat(roomId);
      setStatus(`Room ${roomId} created. Waiting for other player...`);
    } catch (e) {
      console.error('create room err', e);
      alert('Failed to create room. Check console.');
    }
  });

  // Join room
  joinRoomBtn.addEventListener('click', async () => {
    try {
      const id = (roomInput.value || '').trim().toUpperCase();
      if (!id) return alert('Enter a Room ID to join');
      roomId = id;
      playerSymbol = 'O';
      const snap = await roomRef(roomId).once('value');
      const room = snap.val();
      if (!room) return alert('Room not found');
      if (room.player2 === true) return alert('Room is already full');
      // set player2 presence true
      await roomRef(roomId).child('player2').set(true);
      attachPresenceHandlers(roomId, false);
      listenRoom(roomId);
      listenChat(roomId);
      setStatus('Connected! You are Player O');
    } catch (err) {
      console.error('join err', err);
      alert('Failed to join. Check console.');
    }
  });

  // Listen room updates
  function listenRoom(id) {
    roomRef(id).on('value', snap => {
      const data = snap.val();
      if (!data) return;
      // presence handling: bothConnected only if both flags true
      const p1 = !!data.player1;
      const p2 = !!data.player2;
      bothConnected = p1 && p2;
      // when either disconnected, pause the game
      if (!bothConnected) {
        isGameActive = false;
        setStatus('Waiting for other player...');
      } else {
        isGameActive = true;
        setStatus('Both players connected');
      }

      // sync board
      board = Array.isArray(data.board) ? data.board.slice() : Array(9).fill('');
      updateBoardUI();

      // detect winner on incoming data to show highlight/popup/confetti correctly for both clients
      const detection = detectWinner(board);
      if (detection) {
        // highlight
        highlightCombo(detection.combo);
        // update scoreboard from DB if present
        if (data.scores) scores = { X: data.scores.X || 0, O: data.scores.O || 0, D: data.scores.D || 0 };
        updateScoreUI();

        // show popups according to perspective
        if (detection.winner === playerSymbol) {
          // you won
          showPopupCentered('You WIN! First turn is yours', 3000);
          startConfetti(3000);
        } else {
          // you lost
          showPopupCentered('You LOSE! Opponent starts', 3000);
        }

        // after 3s the creator or listener will set empty board & turn according to lastWinner (handled elsewhere)
        // ensure we are not allowing moves
        isGameActive = false;

        // Return early (we keep highlights until next board reset)
        return;
      } else {
        // no winner - update scores if present
        if (data.scores) {
          scores = { X: data.scores.X || 0, O: data.scores.O || 0, D: data.scores.D || 0 };
          updateScoreUI();
        }
        // if board empty after a scheduled reset, clear UI highlights
        if (!board.some(Boolean)) {
          clearHighlights();
        }
      }

      // handle draw detection: if DB indicates lastWinner unchanged and board empty, handle nothing special
      // handle turn UI / blocked moves: if both connected and isGameActive then clicking allowed only if data.turn === playerSymbol
      if (bothConnected && isGameActive) {
        if (data.turn) {
          // show whose turn in status for local clarity
          setStatus(`Both players connected — ${data.turn}'s turn`);
        }
      }
    }, err => {
      console.error('listenRoom error', err);
    });
  }

  // Chat
  function listenChat(id) {
    roomRef(id).child('chat').on('child_added', snap => {
      const m = snap.val();
      if (!m) return;
      // append safely (escape minimal)
      const safeMsg = String(m.msg).replace(/</g, '&lt;');
      messagesEl.innerHTML += `<br><strong>${m.sender}:</strong> ${safeMsg}`;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  sendBtn.addEventListener('click', () => {
    if (!roomId) return;
    const txt = (chatInput.value || '').trim();
    if (!txt) return;
    roomRef(roomId).child('chat').push({ sender: playerSymbol || '?:', msg: txt }).catch(e => console.warn(e));
    chatInput.value = '';
  });

  chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendBtn.click();
  });

  // Reset button (manual)
  resetBtn.addEventListener('click', async () => {
    if (!roomId) return;
    // only allow reset when bothConnected true (safer) or allow creator always
    try {
      // clear highlights and local board
      clearHighlights();
      board = Array(9).fill('');
      await safeSetBoardAndTurn(roomId, board, 'X', null);
      // reset scores in DB and locally (optional: keep scores — here we keep them)
      // if you want to zero scores on manual reset uncomment:
      // scores = { X:0, O:0, D:0 }; await safeWriteScoresToDB(roomId);
    } catch (e) { console.warn('manual reset err', e); }
  });

  // Clean up presence when window unloads (redundant with onDisconnect, but keep)
  window.addEventListener('beforeunload', async () => {
    if (!roomId) return;
    // using onDisconnect ensures this, but attempt best-effort
    try {
      if (playerSymbol === 'X') {
        await roomRef(roomId).child('player1').set(false);
      } else if (playerSymbol === 'O') {
        await roomRef(roomId).child('player2').set(false);
      }
    } catch (_) { /* ignore */ }
  });

  // Resize confetti canvas when window resizes
  window.addEventListener('resize', () => {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  });

  // Ensure score UI shows initial zeros on load
  updateScoreUI();
  updateBoardUI();

}); // DOMContentLoaded end



const messagesEl = document.getElementById('messages');

// Add placeholder only if empty
if (!messagesEl.innerHTML.trim()) {
  messagesEl.innerHTML = `<div class="chat-placeholder">Chatting...<br> With you...... 😅</div>`;
}

// Function to safely append a new message
function appendMessage(sender, msg) {
  // Remove placeholder on first message
  const placeholder = messagesEl.querySelector('.chat-placeholder');
  if (placeholder) placeholder.remove();

  // Append the new message
  const safeMsg = String(msg).replace(/</g, '&lt;');
  const newMsg = document.createElement('div');
  newMsg.innerHTML = `<strong>${sender}:</strong> ${safeMsg}`;
  messagesEl.appendChild(newMsg);

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Example: listening to Firebase messages
function listenChat(id) {
  roomRef(id).child('chat').on('child_added', snap => {
    const m = snap.val();
    if (!m) return;
    appendMessage(m.sender, m.msg);
  });
}
