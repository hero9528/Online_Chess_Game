// Socket.io connection
let socket = null;
let currentUsername = null;
let currentGameId = null;
let myColor = null;
let friends = [];
let friendRequests = [];
let peerConnection = null;
let localStream = null;
let isVoiceEnabled = false;
let remoteAudio = null; // Store remote audio element

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeLogin();
});

// Login System
function initializeLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('usernameInput');
    
    // Setup socket connection first
    setupSocketConnection();
    setupGameModeSwitching();
    
    loginBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
}

function setupSocketConnection() {
    // Connect to server
    socket = io(window.location.origin, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showLoginError('Server connection failed. Please ensure server is running.');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    // Setup login event listeners once
    socket.on('loginSuccess', (data) => {
        console.log('Login successful:', data);
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login / Create Account';
        
        currentUsername = data.username;
        friends = data.friends || [];
        document.getElementById('currentUsername').textContent = currentUsername;
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        initializeGame();
        initializeOnlineFeatures();
        updateFriendsList();
    });
    
    socket.on('loginError', (data) => {
        console.error('Login error:', data);
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login / Create Account';
        showLoginError(data.message);
    });
}

function handleLogin() {
    const username = document.getElementById('usernameInput').value.trim();
    const loginBtn = document.getElementById('loginBtn');
    
    if (!username) {
        showLoginError('Please enter a username');
        return;
    }
    
    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.textContent = 'Connecting...';
    
    // Check if socket exists
    if (!socket) {
        showLoginError('Socket not initialized. Please refresh the page.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login / Create Account';
        return;
    }
    
    // Check if socket is connected
    if (!socket.connected) {
        showLoginError('Connecting to server... Please wait.');
        
        // Try to connect
        socket.connect();
        
        // Wait for connection then login
        const connectTimeout = setTimeout(() => {
            showLoginError('Connection timeout. Make sure server is running on port 3000.');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login / Create Account';
        }, 5000);
        
        socket.once('connect', () => {
            clearTimeout(connectTimeout);
            console.log('Socket connected, sending login request');
            socket.emit('login', { username });
        });
        
        socket.once('connect_error', () => {
            clearTimeout(connectTimeout);
            showLoginError('Cannot connect to server. Make sure server is running on port 3000.');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login / Create Account';
        });
    } else {
        // Socket is already connected, emit login directly
        console.log('Socket already connected, sending login request');
        socket.emit('login', { username });
    }
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    setTimeout(() => {
        errorDiv.textContent = '';
    }, 3000);
}

// Initialize Online Features
function initializeOnlineFeatures() {
    setupFriendSystem();
    setupChatSystem();
    setupVoiceChat();
    setupGameModeSwitching();
}

// Friend System
function setupFriendSystem() {
    const searchInput = document.getElementById('searchUsersInput');
    const toggleFriendsBtn = document.getElementById('toggleFriendsBtn');
    const toggleFriends = document.getElementById('toggleFriends');
    const friendsSidebar = document.getElementById('friendsSidebar');
    
    if (!searchInput || !socket) {
        console.error('Friend system setup failed: missing elements or socket');
        return;
    }
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
            if (socket && socket.connected) {
                console.log('Searching for users:', query);
                socket.emit('searchUsers', { query });
            } else {
                showNotification('Not connected to server. Please wait...');
            }
        } else {
            document.getElementById('searchResults').innerHTML = '';
        }
    });
    
    // Setup socket event listeners for friend system
    if (socket) {
        socket.on('searchResults', (results) => {
            console.log('Search results received:', results);
            const resultsDiv = document.getElementById('searchResults');
            if (!resultsDiv) return;
            
            resultsDiv.innerHTML = '';
            
            if (results.length === 0) {
                resultsDiv.innerHTML = '<p style="color: #999; font-size: 0.9em; padding: 10px;">No users found</p>';
                return;
            }
            
            results.forEach(user => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div>
                        <span class="username">${user.username}</span>
                        <span class="status">${user.online ? '🟢 Online' : '🔴 Offline'}</span>
                    </div>
                    ${!user.isFriend && !user.hasPendingRequest ? 
                        `<button onclick="sendFriendRequest('${user.username}')">Add Friend</button>` : 
                        user.isFriend ? '<span style="color: #4CAF50;">✓ Friend</span>' : '<span style="color: #999;">Request Sent</span>'
                    }
                `;
                resultsDiv.appendChild(item);
            });
        });
    
        socket.on('friendRequest', (data) => {
            console.log('Friend request received:', data);
            if (!friendRequests.includes(data.from)) {
                friendRequests.push(data.from);
            }
            updateFriendRequestsList();
            showNotification(`${data.from} sent you a friend request!`);
        });
        
        socket.on('friendAdded', (data) => {
            console.log('Friend added event received:', data);
            const friendUsername = data.username;
            if (!friends.includes(friendUsername)) {
                friends.push(friendUsername);
                console.log('Updated friends array:', friends);
            }
            updateFriendsList();
            showNotification(`${friendUsername} is now your friend!`);
        });
        
        socket.on('friendOnline', (data) => {
            updateFriendsList();
        });
        
        socket.on('friendOffline', (data) => {
            updateFriendsList();
        });
        
        socket.on('gameChallenge', (data) => {
            console.log('Game challenge received:', data);
            if (!data || !data.from || !data.fromSocketId) {
                console.error('Invalid challenge data:', data);
                showNotification('Invalid challenge received');
                return;
            }
            
            // Show challenge modal
            showChallengeModal(data.from, data.fromSocketId);
        });
        
        socket.on('gameStarted', (data) => {
            console.log('Game started event received:', data);
            
            if (!data || !data.gameId || !data.opponent || !data.color) {
                console.error('Invalid gameStarted data:', data);
                showNotification('Invalid game data received');
                return;
            }
            
            // Close challenge modal if open
            hideChallengeModal();
            
            currentGameId = data.gameId;
            myColor = data.color;
            
            console.log('Setting up game - ID:', currentGameId, 'Color:', myColor, 'Opponent:', data.opponent);
            
            // Switch to online mode
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            const onlineModeBtn = document.getElementById('modeOnline');
            if (onlineModeBtn) {
                onlineModeBtn.classList.add('active');
            }
            
            // Initialize or reset game
            if (!game) {
                console.log('Game not initialized, initializing now...');
                initializeGame();
            }
            
            if (game) {
                game.setGameMode('online');
                game.resetGame();
                console.log('Game reset and set to online mode');
            } else {
                console.error('Game object still not available after initialization');
                showNotification('Error: Game not initialized');
                return;
            }
            
            const opponentNameEl = document.getElementById('opponentName');
            if (opponentNameEl) {
                opponentNameEl.textContent = `Playing with: ${data.opponent}`;
            }
            
            const onlineGameInfo = document.getElementById('onlineGameInfo');
            if (onlineGameInfo) {
                onlineGameInfo.style.display = 'block';
            }
            
            // Show chat panel
            const chatPanel = document.getElementById('chatPanel');
            if (chatPanel) {
                chatPanel.classList.add('active');
            }
            
            // Clear chat messages for new game
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            // Show color-specific notification
            const colorEmoji = data.color === 'white' ? '⚪' : '⚫';
            const colorName = data.color === 'white' ? 'White' : 'Black';
            showNotification(`${colorEmoji} Game started! You are playing as ${colorName} pieces`);
            console.log('Game setup complete');
            
            // Update UI to show player color
            const turnIndicator = document.querySelector('.current-turn');
            if (turnIndicator) {
                const playerColor = data.color === 'white' ? 'White' : 'Black';
                turnIndicator.textContent = `You are ${playerColor}`;
                turnIndicator.className = `current-turn ${data.color}-turn`;
            }
        });
        
        // Handle errors
        socket.on('error', (data) => {
            console.error('Socket error:', data);
            if (data && data.message) {
                showNotification('Error: ' + data.message);
            }
        });
    }
    
    if (toggleFriendsBtn) {
        toggleFriendsBtn.addEventListener('click', () => {
            if (friendsSidebar) {
                friendsSidebar.classList.toggle('active');
            }
        });
    }
    
    if (toggleFriends) {
        toggleFriends.addEventListener('click', () => {
            if (friendsSidebar) {
                friendsSidebar.classList.remove('active');
            }
        });
    }
}

function sendFriendRequest(username) {
    if (!socket || !socket.connected) {
        showNotification('Not connected to server');
        return;
    }
    console.log('Sending friend request to:', username);
    socket.emit('sendFriendRequest', { toUsername: username });
    showNotification(`Friend request sent to ${username}`);
}

function acceptFriendRequest(fromUsername) {
    if (!socket || !socket.connected) {
        showNotification('Not connected to server');
        return;
    }
    console.log('Accepting friend request from:', fromUsername);
    socket.emit('acceptFriendRequest', { fromUsername });
    friendRequests = friendRequests.filter(f => f !== fromUsername);
    updateFriendRequestsList();
    // Friends list will be updated when server sends friendAdded event
}

function rejectFriendRequest(fromUsername) {
    socket.emit('rejectFriendRequest', { fromUsername });
    friendRequests = friendRequests.filter(f => f !== fromUsername);
    updateFriendRequestsList();
}

function challengeFriend(username) {
    if (!socket || !socket.connected) {
        showNotification('Not connected to server');
        return;
    }
    console.log('Challenging friend:', username);
    socket.emit('challengeFriend', { toUsername: username });
    showNotification(`Challenge sent to ${username}`);
}

function updateFriendRequestsList() {
    const requestsDiv = document.getElementById('friendRequestsList');
    requestsDiv.innerHTML = '';
    
    if (friendRequests.length === 0) {
        requestsDiv.innerHTML = '<p style="color: #999; font-size: 0.9em;">No pending requests</p>';
        return;
    }
    
    friendRequests.forEach(username => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.innerHTML = `
            <div>
                <span class="friend-name">${username}</span>
            </div>
            <div>
                <button class="btn-accept" onclick="acceptFriendRequest('${username}')">Accept</button>
                <button class="btn-reject" onclick="rejectFriendRequest('${username}')">Reject</button>
            </div>
        `;
        requestsDiv.appendChild(item);
    });
}

function updateFriendsList() {
    const friendsDiv = document.getElementById('friendsList');
    friendsDiv.innerHTML = '';
    
    if (friends.length === 0) {
        friendsDiv.innerHTML = '<p style="color: #999; font-size: 0.9em;">No friends yet</p>';
        return;
    }
    
    friends.forEach(username => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.innerHTML = `
            <div>
                <span class="friend-name">${username}</span>
                <span class="friend-status">🟢 Online</span>
            </div>
            <button class="btn-challenge" onclick="challengeFriend('${username}')">Challenge</button>
        `;
        friendsDiv.appendChild(item);
    });
}

// Chat System
function setupChatSystem() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const toggleChat = document.getElementById('toggleChat');
    const chatPanel = document.getElementById('chatPanel');
    
    if (!chatInput || !sendBtn || !emojiBtn || !emojiPicker) {
        console.error('Chat system setup failed: missing elements');
        return;
    }
    
    let typingTimeout = null;
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        } else {
            // Typing indicator
            if (currentGameId && socket && socket.connected) {
                socket.emit('typing', { gameId: currentGameId, isTyping: true });
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    if (socket && socket.connected) {
                        socket.emit('typing', { gameId: currentGameId, isTyping: false });
                    }
                }, 1000);
            }
        }
    });
    
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (emojiPicker) {
            const isVisible = emojiPicker.style.display !== 'none';
            emojiPicker.style.display = isVisible ? 'none' : 'block';
        }
    });
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (emojiPicker && emojiBtn && !emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
            emojiPicker.style.display = 'none';
        }
    });
    
    // Setup emoji click handlers
    const emojiElements = emojiPicker.querySelectorAll('.emoji');
    if (emojiElements.length > 0) {
        emojiElements.forEach(emoji => {
            emoji.addEventListener('click', (e) => {
                e.stopPropagation();
                if (chatInput) {
                    chatInput.value += emoji.textContent.trim();
                    chatInput.focus();
                }
            });
        });
    } else {
        console.warn('No emoji elements found in emoji picker');
    }
    
    // Setup socket event listeners for chat
    if (socket) {
        socket.on('chatMessage', (data) => {
            console.log('Chat message received:', data);
            addChatMessage(data.from, data.message, data.timestamp);
        });
        
        socket.on('typing', (data) => {
            const typingIndicator = document.getElementById('typingIndicator');
            const typingUsername = document.getElementById('typingUsername');
            if (typingIndicator && typingUsername) {
                if (data.isTyping) {
                    typingUsername.textContent = data.username;
                    typingIndicator.style.display = 'block';
                } else {
                    typingIndicator.style.display = 'none';
                }
            }
        });
    }
    
    if (toggleChat && chatPanel) {
        toggleChat.addEventListener('click', () => {
            chatPanel.classList.toggle('active');
        });
    }
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    
    if (!message) {
        return;
    }
    
    // Allow chat even without game (for future: global chat)
    if (!currentGameId) {
        showNotification('Start a game to chat with your opponent');
        return;
    }
    
    if (!socket || !socket.connected) {
        showNotification('Not connected to server');
        return;
    }
    
    console.log('Sending chat message:', message);
    socket.emit('chatMessage', { gameId: currentGameId, message });
    addChatMessage(currentUsername, message, new Date().toISOString());
    chatInput.value = '';
    
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker) {
        emojiPicker.style.display = 'none';
    }
}

function addChatMessage(author, message, timestamp) {
    console.log('Adding chat message:', { author, message, timestamp });
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) {
        console.error('Chat messages div not found');
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-author">${author}</div>
        <div class="message-text">${message}</div>
        <div class="message-time">${timeStr}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    console.log('Chat message added successfully');
}

// Voice Chat System
function setupVoiceChat() {
    const voiceChatBtn = document.getElementById('voiceChatBtn');
    const muteBtn = document.getElementById('muteBtn');
    
    if (!voiceChatBtn) {
        console.error('Voice chat button not found');
        return;
    }
    
    voiceChatBtn.addEventListener('click', async () => {
        if (!currentGameId) {
            showNotification('Start a game to use voice chat');
            return;
        }
        
        if (!socket || !socket.connected) {
            showNotification('Not connected to server');
            return;
        }
        
        try {
            if (!isVoiceEnabled) {
                await startVoiceChat();
            } else {
                stopVoiceChat();
            }
        } catch (error) {
            console.error('Voice chat error:', error);
            showNotification('Voice chat error: ' + error.message);
        }
    });
    
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (localStream) {
                localStream.getAudioTracks().forEach(track => {
                    track.enabled = !track.enabled;
                });
                muteBtn.textContent = muteBtn.textContent === '🔇 Mute' ? '🔊 Unmute' : '🔇 Mute';
            }
        });
    }
    
    // Setup voice chat socket listeners
    if (socket) {
        socket.on('voiceOffer', async (data) => {
            console.log('Voice offer received:', data);
            await handleVoiceOffer(data);
        });
        
        socket.on('voiceAnswer', async (data) => {
            console.log('Voice answer received:', data);
            await handleVoiceAnswer(data);
        });
        
        socket.on('voiceIceCandidate', async (data) => {
            console.log('ICE candidate received:', data);
            await handleIceCandidate(data);
        });
    }
}

async function startVoiceChat() {
    if (!currentGameId) {
        alert('You need to be in a game to use voice chat');
        return;
    }
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, echoCancellation: true, noiseSuppression: true });
        console.log('Got local audio stream');
        
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Add local tracks
        localStream.getAudioTracks().forEach(track => {
            console.log('Adding local track:', track.id);
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote audio stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            const stream = event.streams[0];
            
            // Remove old audio element if exists
            if (remoteAudio) {
                remoteAudio.pause();
                remoteAudio.srcObject = null;
                remoteAudio = null;
            }
            
            // Create new audio element
            remoteAudio = new Audio();
            remoteAudio.srcObject = stream;
            remoteAudio.autoplay = true;
            remoteAudio.volume = 1.0;
            
            // Play audio
            remoteAudio.play().then(() => {
                console.log('Remote audio playing');
            }).catch(err => {
                console.error('Error playing remote audio:', err);
                showNotification('Click anywhere to enable audio');
                
                // Try to play on user interaction
                const playAudio = () => {
                    if (remoteAudio) {
                        remoteAudio.play().catch(e => console.error('Still cannot play:', e));
                    }
                    document.removeEventListener('click', playAudio);
                    document.removeEventListener('touchstart', playAudio);
                };
                document.addEventListener('click', playAudio, { once: true });
                document.addEventListener('touchstart', playAudio, { once: true });
            });
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && socket && socket.connected) {
                console.log('Sending ICE candidate');
                socket.emit('voiceIceCandidate', {
                    gameId: currentGameId,
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed') {
                showNotification('Voice connection failed. Trying to reconnect...');
            }
        };
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('Created offer, sending to server');
        
        socket.emit('voiceOffer', {
            gameId: currentGameId,
            offer: offer
        });
        
        isVoiceEnabled = true;
        const voiceBtn = document.getElementById('voiceChatBtn');
        const muteBtn = document.getElementById('muteBtn');
        if (voiceBtn) voiceBtn.textContent = '🔴 Stop Voice';
        if (muteBtn) muteBtn.style.display = 'block';
        
        showNotification('Voice chat started!');
    } catch (error) {
        console.error('Error starting voice chat:', error);
        showNotification('Could not access microphone. Please check permissions.');
    }
}

async function handleVoiceOffer(data) {
    try {
        const offer = data.offer || data;
        if (!currentGameId) return;
        
        console.log('Handling voice offer (listen-only)');
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        // Receive-only so microphone is NOT enabled automatically
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });
        
        // Handle remote audio stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            const stream = event.streams[0];
            
            // Remove old audio element if exists
            if (remoteAudio) {
                remoteAudio.pause();
                remoteAudio.srcObject = null;
                remoteAudio = null;
            }
            
            // Create new audio element
            remoteAudio = new Audio();
            remoteAudio.srcObject = stream;
            remoteAudio.autoplay = true;
            remoteAudio.volume = 1.0;
            
            // Play audio
            remoteAudio.play().then(() => {
                console.log('Remote audio playing');
            }).catch(err => {
                console.error('Error playing remote audio:', err);
                showNotification('Click anywhere to enable audio');
                
                // Try to play on user interaction
                const playAudio = () => {
                    if (remoteAudio) {
                        remoteAudio.play().catch(e => console.error('Still cannot play:', e));
                    }
                    document.removeEventListener('click', playAudio);
                    document.removeEventListener('touchstart', playAudio);
                };
                document.addEventListener('click', playAudio, { once: true });
                document.addEventListener('touchstart', playAudio, { once: true });
            });
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && socket && socket.connected) {
                console.log('Sending ICE candidate');
                socket.emit('voiceIceCandidate', {
                    gameId: currentGameId,
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
        };
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('Created answer, sending to server');
        
        if (socket && socket.connected) {
            socket.emit('voiceAnswer', {
                gameId: currentGameId,
                answer: answer
            });
        }
        // Do NOT enable mic or change UI automatically for receiver
        showNotification('Incoming voice: listening only. Click Voice Chat to speak.');
    } catch (error) {
        console.error('Error handling voice offer:', error);
        showNotification('Voice chat error: ' + error.message);
    }
}

async function handleVoiceAnswer(data) {
    try {
        const answer = data.answer || data;
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    } catch (error) {
        console.error('Error handling voice answer:', error);
    }
}

async function handleIceCandidate(data) {
    try {
        const candidate = data.candidate || data;
        if (peerConnection && candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

function stopVoiceChat() {
    console.log('Stopping voice chat');
    
    // Stop and remove remote audio
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track:', track.id);
        });
        localStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    isVoiceEnabled = false;
    const voiceBtn = document.getElementById('voiceChatBtn');
    const muteBtn = document.getElementById('muteBtn');
    if (voiceBtn) voiceBtn.textContent = '🎤 Voice Chat';
    if (muteBtn) muteBtn.style.display = 'none';
    
    showNotification('Voice chat stopped');
}

// Game Mode Switching
function setupGameModeSwitching() {
    document.getElementById('modeLocal').addEventListener('click', () => {
        switchGameMode('local');
    });
    
    document.getElementById('modeOnline').addEventListener('click', () => {
        switchGameMode('online');
    });
    
    document.getElementById('modePvC').addEventListener('click', () => {
        switchGameMode('pvc');
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            location.reload();
        }
    });
}

function switchGameMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    const targetId = mode === 'pvc' ? 'modePvC' : `mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    const targetBtn = document.getElementById(targetId);
    if (targetBtn) targetBtn.classList.add('active');
    
    if (mode === 'online' && !currentGameId) {
        const el = document.getElementById('onlineGameInfo');
        if (el) el.style.display = 'none';
    }
    if (!game) {
        initializeGame();
    }
    const targetMode = mode === 'online' ? 'online' : mode === 'pvc' ? 'pvc' : 'local';
    game.setGameMode(targetMode);
}

// Chess Game Logic (keeping existing logic)
class ChessGame {
    constructor() {
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.gameMode = 'local'; // 'local', 'online', 'pvc'
        this.computerColor = 'black';
        this.enPassantTarget = null;
        this.halfmoveClock = 0;
        this.positionCounts = {};
        this.initBoard();
        this.renderBoard();
        this.setupEventListeners();
    }

    initBoard() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        for (let i = 0; i < 8; i++) {
            this.board[1][i] = { type: 'pawn', color: 'black', hasMoved: false };
            this.board[6][i] = { type: 'pawn', color: 'white', hasMoved: false };
        }
        
        const pieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let i = 0; i < 8; i++) {
            this.board[0][i] = { type: pieces[i], color: 'black', hasMoved: false };
            this.board[7][i] = { type: pieces[i], color: 'white', hasMoved: false };
        }
    }

    getPieceSymbol(piece) {
        const symbols = {
            white: {
                king: '♔', queen: '♕', rook: '♖',
                bishop: '♗', knight: '♘', pawn: '♙'
            },
            black: {
                king: '♚', queen: '♛', rook: '♜',
                bishop: '♝', knight: '♞', pawn: '♟'
            }
        };
        return symbols[piece.color][piece.type];
    }

    renderBoard() {
        const boardElement = document.getElementById('chessBoard');
        boardElement.innerHTML = '';
        
        // Rotate board if playing as black in online mode
        const shouldRotate = this.gameMode === 'online' && myColor === 'black';
        const rows = shouldRotate ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
        const cols = shouldRotate ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const row = rows[i];
                const col = cols[j];
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    pieceElement.textContent = this.getPieceSymbol(piece);
                    pieceElement.dataset.color = piece.color;
                    pieceElement.dataset.type = piece.type;
                    square.appendChild(pieceElement);
                }
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
        
        // Apply rotation transform if needed (for black player perspective)
        if (shouldRotate) {
            boardElement.style.transform = 'rotate(180deg)';
            // Also rotate pieces back so they appear correctly
            setTimeout(() => {
                boardElement.querySelectorAll('.piece').forEach(piece => {
                    piece.style.transform = 'rotate(180deg)';
                });
            }, 0);
        } else {
            boardElement.style.transform = '';
            boardElement.querySelectorAll('.piece').forEach(piece => {
                piece.style.transform = '';
            });
        }
    }

    handleSquareClick(row, col) {
        if (this.gameOver) return;
        
        // Online mode: only allow moves on your turn
        if (this.gameMode === 'online') {
            if (this.currentPlayer !== myColor) {
                return;
            }
        }
        
        if (this.gameMode === 'pvc' && this.currentPlayer === this.computerColor) {
            return;
        }
        
        const piece = this.board[row][col];
        const squareElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
            this.clearSelection();
            return;
        }
        
        if (piece && piece.color === this.currentPlayer) {
            this.selectSquare(row, col);
            return;
        }
        
        if (this.selectedSquare) {
            if (this.isLegalMove(this.selectedSquare.row, this.selectedSquare.col, row, col)) {
                this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
            } else {
                squareElement.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    squareElement.style.animation = '';
                }, 500);
            }
        }
    }

    selectSquare(row, col) {
        this.clearSelection();
        this.selectedSquare = { row, col };
        
        const squareElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        squareElement.classList.add('selected');
        
        this.showPossibleMoves(row, col);
    }

    clearSelection() {
        if (this.selectedSquare) {
            const squareElement = document.querySelector(
                `[data-row="${this.selectedSquare.row}"][data-col="${this.selectedSquare.col}"]`
            );
            squareElement.classList.remove('selected');
        }
        
        document.querySelectorAll('.possible-move, .possible-capture').forEach(sq => {
            sq.classList.remove('possible-move', 'possible-capture');
        });
        
        this.selectedSquare = null;
    }

    showPossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isLegalMove(row, col, r, c)) {
                    const squareElement = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (this.board[r][c]) {
                        squareElement.classList.add('possible-capture');
                    } else {
                        squareElement.classList.add('possible-move');
                    }
                }
            }
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        
        if (this.board[toRow][toCol] && this.board[toRow][toCol].color === piece.color) {
            return false;
        }
        
        switch (piece.type) {
            case 'pawn':
                return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, piece.color);
            case 'rook':
                return this.isValidRookMove(fromRow, fromCol, toRow, toCol);
            case 'knight':
                return this.isValidKnightMove(fromRow, fromCol, toRow, toCol);
            case 'bishop':
                return this.isValidBishopMove(fromRow, fromCol, toRow, toCol);
            case 'queen':
                return this.isValidQueenMove(fromRow, fromCol, toRow, toCol);
            case 'king':
                return this.isValidKingMove(fromRow, fromCol, toRow, toCol);
            default:
                return false;
        }
    }

    isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        if (toCol === fromCol && toRow === fromRow + direction && !this.board[toRow][toCol]) {
            return true;
        }
        
        if (toCol === fromCol && fromRow === startRow && toRow === fromRow + 2 * direction && 
            !this.board[toRow][toCol] && !this.board[fromRow + direction][toCol]) {
            return true;
        }
        
        if (Math.abs(toCol - fromCol) === 1 && toRow === fromRow + direction && 
            this.board[toRow][toCol] && this.board[toRow][toCol].color !== color) {
            return true;
        }

        if (Math.abs(toCol - fromCol) === 1 && toRow === fromRow + direction && !this.board[toRow][toCol]) {
            if (this.canEnPassant(fromRow, fromCol, toRow, toCol, color)) {
                return true;
            }
        }
        
        return false;
    }

    isValidRookMove(fromRow, fromCol, toRow, toCol) {
        if (fromRow !== toRow && fromCol !== toCol) return false;
        
        const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
        const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
        
        let r = fromRow + rowStep;
        let c = fromCol + colStep;
        
        while (r !== toRow || c !== toCol) {
            if (this.board[r][c]) return false;
            r += rowStep;
            c += colStep;
        }
        
        return true;
    }

    isValidKnightMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }

    isValidBishopMove(fromRow, fromCol, toRow, toCol) {
        if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;
        
        const rowStep = toRow > fromRow ? 1 : -1;
        const colStep = toCol > fromCol ? 1 : -1;
        
        let r = fromRow + rowStep;
        let c = fromCol + colStep;
        
        while (r !== toRow || c !== toCol) {
            if (this.board[r][c]) return false;
            r += rowStep;
            c += colStep;
        }
        
        return true;
    }

    isValidQueenMove(fromRow, fromCol, toRow, toCol) {
        return this.isValidRookMove(fromRow, fromCol, toRow, toCol) || 
               this.isValidBishopMove(fromRow, fromCol, toRow, toCol);
    }

    isValidKingMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        if (rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0)) {
            return true;
        }
        if (rowDiff === 0 && colDiff === 2) {
            const piece = this.board[fromRow][fromCol];
            if (!piece || piece.type !== 'king') return false;
            if (piece.hasMoved) return false;
            const color = piece.color;
            const isKingSide = toCol > fromCol;
            const rookCol = isKingSide ? 7 : 0;
            const rook = this.board[fromRow][rookCol];
            if (!rook || rook.type !== 'rook' || rook.color !== color || rook.hasMoved) return false;
            const pathCols = isKingSide ? [fromCol + 1, fromCol + 2] : [fromCol - 1, fromCol - 2, fromCol - 3];
            for (const c of pathCols) {
                if (this.board[fromRow][c]) return false;
            }
            if (this.isInCheck(color)) return false;
            const opponent = color === 'white' ? 'black' : 'white';
            const passCols = isKingSide ? [fromCol + 1, fromCol + 2] : [fromCol - 1, fromCol - 2];
            for (const c of passCols) {
                if (this.isSquareAttacked(fromRow, c, opponent)) return false;
            }
            return true;
        }
        return false;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) {
            console.error('No piece at source position');
            return;
        }
        
        const capturedPiece = this.board[toRow][toCol];
        let isCapture = capturedPiece && capturedPiece.color !== piece.color;
        let enPassantCapture = null;
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && !capturedPiece && fromCol !== toCol) {
            const capturedRow = fromRow;
            const potential = this.board[capturedRow][toCol];
            if (potential && potential.type === 'pawn' && potential.color !== piece.color) {
                enPassantCapture = { row: capturedRow, col: toCol, piece: potential };
                isCapture = true;
            }
        }
        
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: isCapture ? (enPassantCapture ? enPassantCapture.piece : capturedPiece) : null
        });
        
        if (enPassantCapture) {
            this.board[enPassantCapture.row][enPassantCapture.col] = null;
            this.capturedPieces[enPassantCapture.piece.color].push(enPassantCapture.piece);
            this.updateCapturedPieces();
        } else if (isCapture && capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
        }
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        if (piece.hasMoved === false) {
            piece.hasMoved = true;
        }
        if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
            const d = piece.color === 'white' ? -1 : 1;
            this.enPassantTarget = { row: fromRow + d, col: fromCol };
        }
        if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
            const isKingSide = toCol > fromCol;
            const rookFromCol = isKingSide ? 7 : 0;
            const rookToCol = isKingSide ? 5 : 3;
            const rook = this.board[toRow][rookFromCol];
            if (rook && rook.type === 'rook' && rook.color === piece.color) {
                this.board[toRow][rookToCol] = rook;
                this.board[toRow][rookFromCol] = null;
                if (rook.hasMoved === false) {
                    rook.hasMoved = true;
                }
            }
        }
        
        this.animateMove(fromRow, fromCol, toRow, toCol);
        
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            if (this.gameMode === 'online') {
                piece.type = 'queen';
            } else {
                const choice = prompt('Promote to (q,r,b,n):', 'q');
                const map = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
                piece.type = map[(choice || 'q').toLowerCase()] || 'queen';
            }
        }
        
        // Send move to server if online
        if (this.gameMode === 'online' && currentGameId && socket) {
            socket.emit('makeMove', {
                gameId: currentGameId,
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol }
            });
        }
        
        this.clearSelection();
        if (isCapture || piece.type === 'pawn') {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock += 1;
        }
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        const posKey = this.getPositionKey();
        this.positionCounts[posKey] = (this.positionCounts[posKey] || 0) + 1;
        this.updateTurnIndicator();
        
        this.checkGameStatus();
        
        if (this.gameMode === 'pvc' && this.currentPlayer === this.computerColor && !this.gameOver) {
            setTimeout(() => this.makeComputerMove(), 500);
        }
    }

    animateMove(fromRow, fromCol, toRow, toCol) {
        const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const pieceElement = fromSquare ? fromSquare.querySelector('.piece') : null;
        
        if (!pieceElement || !fromSquare || !toSquare) {
            // If animation fails, just render the board
            this.renderBoard();
            return;
        }
        
        pieceElement.classList.add('moving');
        
        const fromRect = fromSquare.getBoundingClientRect();
        const toRect = toSquare.getBoundingClientRect();
        const boardRect = document.getElementById('chessBoard').getBoundingClientRect();
        
        const deltaX = toRect.left - fromRect.left;
        const deltaY = toRect.top - fromRect.top;
        
        // Ensure piece stays within board bounds
        pieceElement.style.position = 'absolute';
        pieceElement.style.zIndex = '1000';
        pieceElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        pieceElement.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        setTimeout(() => {
            // Reset all styles
            pieceElement.style.transform = '';
            pieceElement.style.position = '';
            pieceElement.style.zIndex = '';
            pieceElement.style.transition = '';
            pieceElement.classList.remove('moving');
            
            // Re-render board to ensure proper positioning
            this.renderBoard();
        }, 300);
    }

    checkGameStatus() {
        const statusElement = document.getElementById('gameStatus');
        if (!statusElement) return;
        
        const inCheck = this.isInCheck(this.currentPlayer);
        const hasValidMoves = this.hasValidMoves(this.currentPlayer);
        
        console.log(`Game status check - Player: ${this.currentPlayer}, InCheck: ${inCheck}, HasValidMoves: ${hasValidMoves}`);
        
        if (inCheck && !hasValidMoves) {
            this.gameOver = true;
            const winner = this.currentPlayer === 'white' ? 'Black' : 'White';
            statusElement.textContent = `🏆 ${winner} Wins! Checkmate! 🎉`;
            statusElement.classList.add('checkmate');
            statusElement.classList.remove('check');
            showNotification(`🎉 ${winner} wins by checkmate!`);
            console.log(`CHECKMATE! ${winner} wins!`);
        } 
        else if (!inCheck && !hasValidMoves) {
            this.gameOver = true;
            statusElement.textContent = '🤝 Stalemate! Game Draw';
            statusElement.classList.remove('check', 'checkmate');
            showNotification('Game ended in stalemate!');
            console.log('STALEMATE!');
        } 
        else if (this.halfmoveClock >= 100) {
            this.gameOver = true;
            statusElement.textContent = '🤝 Draw by fifty-move rule';
            statusElement.classList.remove('check', 'checkmate');
            showNotification('Draw by fifty-move rule');
            console.log('DRAW 50-MOVE');
        }
        else if (this.positionCounts[this.getPositionKey()] >= 3) {
            this.gameOver = true;
            statusElement.textContent = '🤝 Draw by threefold repetition';
            statusElement.classList.remove('check', 'checkmate');
            showNotification('Draw by threefold repetition');
            console.log('DRAW REPETITION');
        }
        else if (this.isInsufficientMaterial()) {
            this.gameOver = true;
            statusElement.textContent = '🤝 Draw by insufficient material';
            statusElement.classList.remove('check', 'checkmate');
            showNotification('Draw by insufficient material');
            console.log('DRAW INSUFFICIENT MATERIAL');
        }
        else if (inCheck && hasValidMoves) {
            const playerName = this.currentPlayer === 'white' ? 'White' : 'Black';
            statusElement.textContent = `⚠️ ${playerName} is in Check!`;
            statusElement.classList.add('check');
            statusElement.classList.remove('checkmate');
            console.log(`${playerName} is in check but has valid moves`);
        } 
        else {
            statusElement.textContent = 'Game in Progress';
            statusElement.classList.remove('check', 'checkmate');
        }
    }

    isInCheck(color) {
        let kingRow = -1, kingCol = -1;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] && this.board[r][c].type === 'king' && this.board[r][c].color === color) {
                    kingRow = r;
                    kingCol = c;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }
        if (kingRow === -1) {
            return false;
        }
        const opponentColor = color === 'white' ? 'black' : 'white';
        return this.isSquareAttacked(kingRow, kingCol, opponentColor);
    }

    isSquareAttacked(row, col, byColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece || piece.color !== byColor) continue;
                if (piece.type === 'pawn') {
                    const direction = byColor === 'white' ? -1 : 1;
                    if (row === r + direction && Math.abs(col - c) === 1) return true;
                    continue;
                }
                if (piece.type === 'knight') {
                    const rd = Math.abs(row - r);
                    const cd = Math.abs(col - c);
                    if ((rd === 2 && cd === 1) || (rd === 1 && cd === 2)) return true;
                    continue;
                }
                if (piece.type === 'king') {
                    const rd = Math.abs(row - r);
                    const cd = Math.abs(col - c);
                    if (rd <= 1 && cd <= 1 && (rd + cd > 0)) return true;
                    continue;
                }
                if (piece.type === 'bishop' || piece.type === 'rook' || piece.type === 'queen') {
                    if (this.isValidMove(r, c, row, col)) return true;
                }
            }
        }
        return false;
    }

    isLegalMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) return false;
        const color = piece.color;
        const captured = this.board[toRow][toCol];
        const tempEnPassant = piece.type === 'pawn' && !captured && fromCol !== toCol;
        let epCapture = null;
        if (tempEnPassant) {
            if (this.enPassantTarget && this.enPassantTarget.row === toRow && this.enPassantTarget.col === toCol) {
                const pr = fromRow;
                const p = this.board[pr][toCol];
                if (p && p.type === 'pawn' && p.color !== color) {
                    epCapture = { row: pr, col: toCol };
                }
            }
        }
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        if (epCapture) {
            this.board[epCapture.row][epCapture.col] = null;
        }
        const illegal = this.isInCheck(color);
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = captured;
        if (epCapture) {
            if (!this.board[epCapture.row][epCapture.col]) {
                this.board[epCapture.row][epCapture.col] = { type: 'pawn', color: color === 'white' ? 'black' : 'white', hasMoved: true };
            }
        }
        return !illegal;
    }

    canEnPassant(fromRow, fromCol, toRow, toCol, color) {
        if (!this.enPassantTarget) return false;
        const direction = color === 'white' ? -1 : 1;
        if (toRow !== this.enPassantTarget.row || toCol !== this.enPassantTarget.col) return false;
        if (fromRow !== toRow - direction) return false;
        return true;
    }

    getCastlingRights() {
        let rights = '';
        const wk = this.board[7][4];
        const wrA = this.board[7][0];
        const wrH = this.board[7][7];
        if (wk && wk.type === 'king' && wk.color === 'white' && wk.hasMoved === false) {
            if (wrH && wrH.type === 'rook' && wrH.color === 'white' && wrH.hasMoved === false) rights += 'K';
            if (wrA && wrA.type === 'rook' && wrA.color === 'white' && wrA.hasMoved === false) rights += 'Q';
        }
        const bk = this.board[0][4];
        const brA = this.board[0][0];
        const brH = this.board[0][7];
        if (bk && bk.type === 'king' && bk.color === 'black' && bk.hasMoved === false) {
            if (brH && brH.type === 'rook' && brH.color === 'black' && brH.hasMoved === false) rights += 'k';
            if (brA && brA.type === 'rook' && brA.color === 'black' && brA.hasMoved === false) rights += 'q';
        }
        return rights || '-';
    }

    getPositionKey() {
        let rows = [];
        for (let r = 0; r < 8; r++) {
            let cols = [];
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (!p) {
                    cols.push('.');
                } else {
                    let ch = 'p';
                    if (p.type === 'king') ch = 'k';
                    else if (p.type === 'queen') ch = 'q';
                    else if (p.type === 'rook') ch = 'r';
                    else if (p.type === 'bishop') ch = 'b';
                    else if (p.type === 'knight') ch = 'n';
                    else ch = 'p';
                    cols.push(p.color === 'white' ? ch.toUpperCase() : ch);
                }
            }
            rows.push(cols.join(''));
        }
        const boardStr = rows.join('/');
        const side = this.currentPlayer;
        const rights = this.getCastlingRights();
        const ep = this.enPassantTarget ? `${this.enPassantTarget.row},${this.enPassantTarget.col}` : '-';
        return `${boardStr} ${side} ${rights} ${ep}`;
    }

    isInsufficientMaterial() {
        let white = { pawns: 0, bishops: 0, knights: 0, rooks: 0, queens: 0 };
        let black = { pawns: 0, bishops: 0, knights: 0, rooks: 0, queens: 0 };
        let bishopSquares = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (!p) continue;
                if (p.type === 'pawn') { (p.color === 'white' ? white : black).pawns++; }
                else if (p.type === 'bishop') { (p.color === 'white' ? white : black).bishops++; bishopSquares.push({ color: p.color, colorSquare: (r + c) % 2 }); }
                else if (p.type === 'knight') { (p.color === 'white' ? white : black).knights++; }
                else if (p.type === 'rook') { (p.color === 'white' ? white : black).rooks++; }
                else if (p.type === 'queen') { (p.color === 'white' ? white : black).queens++; }
            }
        }
        const noMajors = (w) => w.pawns === 0 && w.rooks === 0 && w.queens === 0;
        if (noMajors(white) && noMajors(black)) {
            if (white.bishops === 0 && white.knights === 0 && black.bishops === 0 && black.knights === 0) return true;
            if (white.bishops === 1 && white.knights === 0 && black.bishops === 0 && black.knights === 0 && black.bishops === 0 && black.knights === 0) return true;
            if (white.bishops === 0 && white.knights === 1 && black.bishops === 0 && black.knights === 0 && black.bishops === 0) return true;
            if (black.bishops === 1 && black.knights === 0 && white.bishops === 0 && white.knights === 0) return true;
            if (black.bishops === 0 && black.knights === 1 && white.bishops === 0 && white.knights === 0) return true;
            if (white.bishops === 1 && black.bishops === 1 && white.knights === 0 && black.knights === 0) {
                const wColor = bishopSquares.find(b => b.color === 'white')?.colorSquare;
                const bColor = bishopSquares.find(b => b.color === 'black')?.colorSquare;
                if (wColor !== undefined && bColor !== undefined && wColor === bColor) return true;
            }
        }
        return false;
    }

    hasValidMoves(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    for (let toR = 0; toR < 8; toR++) {
                        for (let toC = 0; toC < 8; toC++) {
                            if (r === toR && c === toC) continue;
                            if (this.isLegalMove(r, c, toR, toC)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    updateTurnIndicator() {
        const turnElement = document.querySelector('.current-turn');
        if (!turnElement) return;
        
        // In online mode, show if it's your turn
        if (this.gameMode === 'online' && myColor) {
            if (this.currentPlayer === myColor) {
                turnElement.textContent = `⚡ Your Turn (${this.currentPlayer === 'white' ? 'White' : 'Black'})`;
            } else {
                turnElement.textContent = `⏳ Opponent's Turn (${this.currentPlayer === 'white' ? 'White' : 'Black'})`;
            }
        } else {
        turnElement.textContent = `${this.currentPlayer === 'white' ? 'White' : 'Black'}'s Turn`;
        }
        turnElement.className = `current-turn ${this.currentPlayer}-turn`;
    }

    updateCapturedPieces() {
        const whiteContainer = document.getElementById('capturedWhite');
        const blackContainer = document.getElementById('capturedBlack');
        
        if (!whiteContainer || !blackContainer) {
            console.error('Captured pieces containers not found');
            return;
        }
        
        whiteContainer.innerHTML = '';
        blackContainer.innerHTML = '';
        
        // Only show pieces that were actually captured
        if (this.capturedPieces.white && Array.isArray(this.capturedPieces.white)) {
        this.capturedPieces.white.forEach(piece => {
                if (piece && piece.type && piece.color) {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = this.getPieceSymbol(piece);
            whiteContainer.appendChild(pieceElement);
                }
        });
        }
        
        if (this.capturedPieces.black && Array.isArray(this.capturedPieces.black)) {
        this.capturedPieces.black.forEach(piece => {
                if (piece && piece.type && piece.color) {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = this.getPieceSymbol(piece);
            blackContainer.appendChild(pieceElement);
                }
        });
        }
    }

    resetGame() {
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.enPassantTarget = null;
        this.halfmoveClock = 0;
        this.positionCounts = {};
        this.initBoard();
        this.renderBoard();
        this.updateTurnIndicator();
        document.getElementById('gameStatus').textContent = 'Game in Progress';
        document.getElementById('gameStatus').classList.remove('check', 'checkmate');
        this.updateCapturedPieces();
    }

    undoMove() {
        if (this.moveHistory.length === 0 || this.gameOver) return;
        if (this.gameMode === 'online') return; // No undo in online mode
        
        const lastMove = this.moveHistory.pop();
        
        // Restore piece to original position
        this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
        
        // Restore captured piece if any
        if (lastMove.captured) {
            this.board[lastMove.to.row][lastMove.to.col] = lastMove.captured;
            // Remove from captured pieces array
            const capturedArray = this.capturedPieces[lastMove.captured.color];
            const index = capturedArray.findIndex(p => 
                p.type === lastMove.captured.type && p.color === lastMove.captured.color
            );
            if (index !== -1) {
                capturedArray.splice(index, 1);
            }
        } else {
            this.board[lastMove.to.row][lastMove.to.col] = null;
        }
        
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.updateTurnIndicator();
        this.renderBoard();
        this.updateCapturedPieces();
        this.checkGameStatus();
    }

    makeComputerMove() {
        const thinkingElement = document.getElementById('computerThinking');
        if (thinkingElement) thinkingElement.style.display = 'inline-block';
        
        setTimeout(() => {
            const bestMove = this.findBestMove();
            if (bestMove) {
                this.makeMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col);
            }
            if (thinkingElement) thinkingElement.style.display = 'none';
        }, 800);
    }

    findBestMove() {
        const allMoves = this.getAllValidMoves(this.computerColor);
        if (allMoves.length === 0) return null;
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            const piece = this.board[move.from.row][move.from.col];
            const captured = this.board[move.to.row][move.to.col];
            
            this.board[move.to.row][move.to.col] = piece;
            this.board[move.from.row][move.from.col] = null;
            
            const score = this.evaluatePosition();
            
            this.board[move.from.row][move.from.col] = piece;
            this.board[move.to.row][move.to.col] = captured;
            
            let moveScore = score;
            if (captured) {
                moveScore += this.getPieceValue(captured) * 10;
            }
            
            this.board[move.to.row][move.to.col] = piece;
            this.board[move.from.row][move.from.col] = null;
            const inCheck = this.isInCheck(this.computerColor);
            this.board[move.from.row][move.from.col] = piece;
            this.board[move.to.row][move.to.col] = captured;
            
            if (inCheck) {
                moveScore -= 50;
            }
            
            const centerBonus = this.getCenterControlBonus(move.to.row, move.to.col);
            moveScore += centerBonus;
            
            if (moveScore > bestScore) {
                bestScore = moveScore;
                bestMove = move;
            }
        }
        
        if (!bestMove && allMoves.length > 0) {
            bestMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        }
        
        return bestMove;
    }

    getAllValidMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] && this.board[r][c].color === color) {
                    for (let toR = 0; toR < 8; toR++) {
                        for (let toC = 0; toC < 8; toC++) {
                            if (this.isLegalMove(r, c, toR, toC)) {
                                moves.push({ from: { row: r, col: c }, to: { row: toR, col: toC } });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    evaluatePosition() {
        let score = 0;
        const pieceValues = {
            pawn: 10,
            knight: 30,
            bishop: 30,
            rook: 50,
            queen: 90,
            king: 900
        };
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece) {
                    const value = pieceValues[piece.type];
                    if (piece.color === this.computerColor) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }
        
        return score;
    }

    getPieceValue(piece) {
        const values = {
            pawn: 1,
            knight: 3,
            bishop: 3,
            rook: 5,
            queen: 9,
            king: 0
        };
        return values[piece.type] || 0;
    }

    getCenterControlBonus(row, col) {
        const centerRows = [3, 4];
        const centerCols = [3, 4];
        
        if (centerRows.includes(row) && centerCols.includes(col)) {
            return 2;
        }
        return 0;
    }

    setGameMode(mode) {
        this.gameMode = mode;
        this.computerColor = 'black';
        this.resetGame();
    }

    setupEventListeners() {
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
    }
}

// Initialize game
let game;

function initializeGame() {
    game = new ChessGame();
    
    // Listen for moves from opponent in online mode
    if (socket) {
        socket.on('moveMade', (data) => {
            if (data.gameId === currentGameId) {
                const from = data.from;
                const to = data.to;
                game.makeMove(from.row, from.col, to.row, to.col);
            }
        });
        
        socket.on('opponentDisconnected', (data) => {
            alert('Your opponent has disconnected. Game ended.');
            currentGameId = null;
            document.getElementById('onlineGameInfo').style.display = 'none';
        });
    }
}

// Challenge Modal Functions
let currentChallengeData = null;

function showChallengeModal(fromUsername, fromSocketId) {
    console.log('Showing challenge modal for:', fromUsername);
    const challengeModal = document.getElementById('challengeModal');
    const challengeFromUser = document.getElementById('challengeFromUser');
    
    if (!challengeModal || !challengeFromUser) {
        console.error('Challenge modal elements not found');
        // Fallback to confirm dialog
        if (confirm(`${fromUsername} wants to play chess with you. Accept?`)) {
            acceptChallengeAction(fromSocketId);
        }
        return;
    }
    
    // Store challenge data
    currentChallengeData = { fromUsername, fromSocketId };
    
    // Update modal content
    challengeFromUser.textContent = fromUsername;
    challengeModal.style.display = 'flex';
    
    // Setup button handlers (remove old ones first)
    const acceptBtn = document.getElementById('acceptChallengeBtn');
    const rejectBtn = document.getElementById('rejectChallengeBtn');
    
    // Remove old event listeners by cloning
    const newAcceptBtn = acceptBtn.cloneNode(true);
    const newRejectBtn = rejectBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
    
    // Add new event listeners
    newAcceptBtn.addEventListener('click', () => {
        acceptChallengeAction(fromSocketId);
        hideChallengeModal();
    });
    
    newRejectBtn.addEventListener('click', () => {
        rejectChallengeAction();
        hideChallengeModal();
    });
    
    // Play notification sound or visual effect
    showNotification(`${fromUsername} challenged you to a game!`);
}

function hideChallengeModal() {
    const challengeModal = document.getElementById('challengeModal');
    if (challengeModal) {
        challengeModal.style.display = 'none';
    }
    currentChallengeData = null;
}

function acceptChallengeAction(fromSocketId) {
    console.log('User accepted challenge from socket:', fromSocketId);
    if (!socket || !socket.connected) {
        console.error('Socket not connected');
        showNotification('Not connected to server');
        return;
    }
    
    socket.emit('acceptChallenge', { fromSocketId: fromSocketId });
    showNotification('Challenge accepted! Starting game...');
}

function rejectChallengeAction() {
    console.log('User rejected challenge');
    showNotification('Challenge rejected');
}

// Helper function
function showNotification(message) {
    // Simple notification - can be enhanced
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: bold;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
