// ===== Firebase Setup =====
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

// ===== Elements =====
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const turnInfo = document.getElementById('turnInfo');
const scoreBoard = document.getElementById('scoreBoard');
const roomInput = document.getElementById('roomIdInput');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendChatBtn = document.getElementById('sendChat');

let roomId = null;
let playerSymbol = null; // X or O
let currentTurn = 'X';
let scores = { X:0, O:0 };

// ===== Create / Join Room =====
createRoomBtn.addEventListener('click', () => {
  roomId = Math.random().toString(36).substring(2,8);
  roomInput.value = roomId;
  playerSymbol = 'X';
  initRoom();
  alert(`Room created! Share this ID: ${roomId}`);
});

joinRoomBtn.addEventListener('click', () => {
  roomId = roomInput.value.trim();
  if(!roomId) return alert('Enter Room ID');
  playerSymbol = 'O';
  initRoom();
});

// ===== Initialize Room =====
function initRoom() {
  const roomRef = db.ref('rooms/' + roomId);
  
  // Setup initial board if X creates room
  if(playerSymbol === 'X') {
    roomRef.set({ board: Array(9).fill(''), turn: 'X', chat: [] });
  }

  // Listen for board changes
  roomRef.child('board').on('value', snap => {
    const board = snap.val();
    if(board){
      board.forEach((val, i) => cells[i].textContent = val);
      checkWin(board);
    }
  });

  // Listen for turn
  roomRef.child('turn').on('value', snap => {
    currentTurn = snap.val();
    turnInfo.textContent = `Turn: ${currentTurn}`;
  });

  // Listen for chat
  roomRef.child('chat').on('value', snap => {
    const messages = snap.val() || [];
    chatMessages.innerHTML = messages.map(m => `<p>${m}</p>`).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ===== Cell Click =====
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = cell.dataset.index;
    if(playerSymbol !== currentTurn) return;
    const roomRef = db.ref('rooms/' + roomId);
    roomRef.child('board').once('value').then(snap => {
      const board = snap.val();
      if(board[index] === ''){
        board[index] = playerSymbol;
        roomRef.update({ board: board, turn: playerSymbol === 'X' ? 'O' : 'X' });
      }
    });
  });
});

// ===== Chat =====
sendChatBtn.addEventListener('click', () => {
  const msg = chatInput.value.trim();
  if(!msg) return;
  const roomRef = db.ref('rooms/' + roomId + '/chat');
  roomRef.once('value').then(snap => {
    const messages = snap.val() || [];
    messages.push(`${playerSymbol}: ${msg}`);
    roomRef.set(messages);
    chatInput.value = '';
  });
});

// ===== Check Win =====
function checkWin(board) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for(const [a,b,c] of wins){
    if(board[a] && board[a] === board[b] && board[a] === board[c]){
      statusEl.textContent = `${board[a]} Wins!`;
      scores[board[a]] += 1;
      scoreBoard.textContent = `X: ${scores.X} | O: ${scores.O}`;
      resetBoard();
      return;
    }
  }
  if(board.every(cell => cell !== '')){
    statusEl.textContent = `Draw!`;
    resetBoard();
  }
}

// ===== Reset Board =====
function resetBoard(){
  const roomRef = db.ref('rooms/' + roomId);
  setTimeout(()=>{
    roomRef.update({ board: Array(9).fill(''), turn: currentTurn });
    statusEl.textContent = '';
  }, 1500);
}
