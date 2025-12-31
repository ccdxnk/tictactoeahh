// TicTacToe P2P with username/group info
const boardEl = document.getElementById('board');
const groupListEl = document.getElementById('groupList');
const statusEl = document.getElementById('status');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const codeInput = document.getElementById('codeInput');

let board = Array(9).fill(null);
let isMyTurn = true;
let symbol = 'X'; // default for creator
let myName = '';
let remoteName = '';

// Ask username once page loads
window.addEventListener('load', () => {
  myName = prompt('Enter your username') || 'Player';
  updateGroupList();
});

// Generate board cells
const cellTemplate = document.getElementById('cellTemplate');
for (let i = 0; i < 9; i++) {
  const cell = cellTemplate.content.firstElementChild.cloneNode(true);
  cell.dataset.index = i;
  cell.addEventListener('click', onCellClick);
  boardEl.appendChild(cell);
}

function onCellClick(e) {
  const idx = e.target.dataset.index;
  if (!isMyTurn || board[idx]) return;
  makeMove(idx, symbol, true);
}

function makeMove(idx, sym, local) {
  board[idx] = sym;
  const cell = boardEl.children[idx];
  cell.textContent = sym;
  cell.classList.add(sym.toLowerCase());
  cell.classList.add('disabled');

  if (checkWin(sym)) {
    statusEl.textContent = `${sym} wins!`;
    disableBoard();
  } else if (board.every(Boolean)) {
    statusEl.textContent = 'Draw';
  } else {
    isMyTurn = !isMyTurn;
    statusEl.textContent = isMyTurn ? 'Your turn' : "Opponent's turn";
  }

  if (local && dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'move', idx }));
  }
}

function updateGroupList() {
  groupListEl.innerHTML = '';
  const liMe = document.createElement('li');
  liMe.textContent = myName + ' (You)';
  groupListEl.appendChild(liMe);
  if (remoteName) {
    const liRemote = document.createElement('li');
    liRemote.textContent = remoteName;
    groupListEl.appendChild(liRemote);
  }
}

function disableBoard() {
  [...boardEl.children].forEach(c => c.classList.add('disabled'));
}

function checkWin(sym) {
  const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  return wins.some(combo => combo.every(i => board[i] === sym));
}

// --- P2P ----
let peerConnection;
let dataChannel;
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

createBtn.addEventListener('click', async () => {
  symbol = 'X';
  isMyTurn = true;
  statusEl.textContent = 'Creating offer...';
  updateGroupList();
  await initConnection(true);
});

joinBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  if (!code) return alert('Please paste a code');
  symbol = 'O';
  isMyTurn = false;
  statusEl.textContent = 'Joining...';
  updateGroupList();
  await initConnection(false, code);
});

async function initConnection(isCreator, remoteCode = '') {
  peerConnection = new RTCPeerConnection(iceServers);

  if (isCreator) {
    dataChannel = peerConnection.createDataChannel('game');
    setupDataChannel();
  } else {
    peerConnection.ondatachannel = (e) => {
      dataChannel = e.channel;
      setupDataChannel();
    };
  }

  peerConnection.onicecandidate = (e) => {
    if (!e.candidate) {
      const code = JSON.stringify(peerConnection.localDescription);
      navigator.clipboard.writeText(code);
      statusEl.textContent = 'Code copied! Send to friend.';
    }
  };

  if (isCreator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
  } else {
    const remoteDesc = new RTCSessionDescription(JSON.parse(remoteCode));
    await peerConnection.setRemoteDescription(remoteDesc);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
  }
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    statusEl.textContent = 'Connected!';
    // Send intro with username
    dataChannel.send(JSON.stringify({ type: 'intro', name: myName }));
  };

  dataChannel.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'move') {
      makeMove(msg.idx, symbol === 'X' ? 'O' : 'X', false);
    } else if (msg.type === 'intro') {
      remoteName = msg.name;
      updateGroupList();
    }
  };

  dataChannel.onclose = () => {
    remoteName = '';
    updateGroupList();
    statusEl.textContent = 'Disconnected';
  };
}
