const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Store users, games, and friend requests
const users = new Map(); // socketId -> {username, socketId, online, friends: Set}
const games = new Map(); // gameId -> {player1, player2, board, currentPlayer, moves}
const friendRequests = new Map(); // fromUsername -> Set of toUsernames
const usernameToSocketId = new Map(); // username -> socketId

// Helper functions
function getUserByUsername(username) {
  for (const [socketId, user] of users.entries()) {
    if (user.username === username) {
      return { socketId, ...user };
    }
  }
  return null;
}

function generateGameId() {
  return Math.random().toString(36).substring(2, 15);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Login/Register
  socket.on('login', (data) => {
    console.log('Login request received:', data);
    const { username } = data;
    
    if (!username || username.trim().length === 0) {
      console.log('Login error: Username is required');
      socket.emit('loginError', { message: 'Username is required' });
      return;
    }

    // Check if username already exists
    const existingUser = getUserByUsername(username);
    if (existingUser && existingUser.online) {
      console.log('Login error: Username already in use');
      socket.emit('loginError', { message: 'Username already in use' });
      return;
    }

    // Create or update user
    users.set(socket.id, {
      username,
      socketId: socket.id,
      online: true,
      friends: new Set(),
      typing: false
    });
    usernameToSocketId.set(username, socket.id);

    console.log('Login successful for:', username);
    socket.emit('loginSuccess', {
      username,
      friends: Array.from(users.get(socket.id).friends),
      onlineUsers: Array.from(users.values())
        .filter(u => u.online && u.username !== username)
        .map(u => ({ username: u.username, online: u.online }))
    });

    // Notify friends
    const user = users.get(socket.id);
    user.friends.forEach(friendUsername => {
      const friendSocketId = usernameToSocketId.get(friendUsername);
      if (friendSocketId && io.sockets.sockets.get(friendSocketId)) {
        io.to(friendSocketId).emit('friendOnline', { username });
      }
    });

    // Broadcast new user online
    socket.broadcast.emit('userOnline', { username });
  });

  // Search users
  socket.on('searchUsers', (data) => {
    console.log('Search users request:', data);
    const { query } = data;
    if (!query || query.trim().length === 0) {
      socket.emit('searchResults', []);
      return;
    }

    const currentUser = users.get(socket.id);
    if (!currentUser) {
      console.log('User not found for search');
      return;
    }

    const results = Array.from(users.values())
      .filter(u => 
        u.username.toLowerCase().includes(query.toLowerCase()) &&
        u.username !== currentUser.username &&
        u.online
      )
      .map(u => ({
        username: u.username,
        online: u.online,
        isFriend: currentUser.friends.has(u.username),
        hasPendingRequest: friendRequests.has(currentUser.username) && 
                          friendRequests.get(currentUser.username).has(u.username)
      }));

    console.log('Search results:', results);
    socket.emit('searchResults', results);
  });

  // Send friend request
  socket.on('sendFriendRequest', (data) => {
    const { toUsername } = data;
    const currentUser = users.get(socket.id);
    
    if (!currentUser) {
      socket.emit('error', { message: 'Not logged in' });
      return;
    }

    const toUser = getUserByUsername(toUsername);
    if (!toUser) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    if (currentUser.friends.has(toUsername)) {
      socket.emit('error', { message: 'Already friends' });
      return;
    }

    if (!friendRequests.has(currentUser.username)) {
      friendRequests.set(currentUser.username, new Set());
    }
    friendRequests.get(currentUser.username).add(toUsername);

    // Notify recipient
    const toSocketId = usernameToSocketId.get(toUsername);
    if (toSocketId && io.sockets.sockets.get(toSocketId)) {
      io.to(toSocketId).emit('friendRequest', {
        from: currentUser.username
      });
    }

    socket.emit('friendRequestSent', { to: toUsername });
  });

  // Accept friend request
  socket.on('acceptFriendRequest', (data) => {
    console.log('Accept friend request received:', data);
    const { fromUsername } = data;
    const currentUser = users.get(socket.id);
    
    if (!currentUser) {
      console.log('Current user not found');
      return;
    }

    // Add to friends
    currentUser.friends.add(fromUsername);
    const fromUser = getUserByUsername(fromUsername);
    if (fromUser) {
      fromUser.friends.add(currentUser.username);
      console.log('Added friend relationship between', currentUser.username, 'and', fromUsername);
    } else {
      console.log('From user not found:', fromUsername);
    }

    // Remove from pending requests
    if (friendRequests.has(fromUsername)) {
      friendRequests.get(fromUsername).delete(currentUser.username);
    }

    // Notify both users
    socket.emit('friendAdded', { username: fromUsername });
    console.log('Sent friendAdded to current user:', currentUser.username);
    
    // Notify sender
    const fromSocketId = usernameToSocketId.get(fromUsername);
    if (fromSocketId && io.sockets.sockets.get(fromSocketId)) {
      io.to(fromSocketId).emit('friendAdded', { username: currentUser.username });
      console.log('Sent friendAdded to from user:', fromUsername);
    } else {
      console.log('From socket not found or not connected:', fromSocketId);
    }
  });

  // Reject friend request
  socket.on('rejectFriendRequest', (data) => {
    const { fromUsername } = data;
    if (friendRequests.has(fromUsername)) {
      friendRequests.get(fromUsername).delete(users.get(socket.id).username);
    }
  });

  // Challenge friend to game
  socket.on('challengeFriend', (data) => {
    console.log('Challenge friend received:', data);
    const { toUsername } = data;
    const currentUser = users.get(socket.id);
    
    if (!currentUser) {
      console.log('Current user not found for challenge');
      return;
    }

    const toUser = getUserByUsername(toUsername);
    if (!toUser) {
      console.log('To user not found:', toUsername);
      socket.emit('error', { message: 'User not found' });
      return;
    }

    const toSocketId = usernameToSocketId.get(toUsername);
    console.log('Sending challenge to:', toUsername, 'socket:', toSocketId);
    
    if (toSocketId && io.sockets.sockets.get(toSocketId)) {
      io.to(toSocketId).emit('gameChallenge', {
        from: currentUser.username,
        fromSocketId: socket.id
      });
      console.log('Challenge sent successfully');
    } else {
      console.log('To socket not found or not connected');
      socket.emit('error', { message: 'Friend is not online' });
    }
  });

  // Accept game challenge
  socket.on('acceptChallenge', (data) => {
    console.log('Accept challenge received:', data);
    const { fromSocketId } = data;
    const currentUser = users.get(socket.id);
    
    if (!currentUser) {
      console.log('Current user not found for acceptChallenge');
      socket.emit('error', { message: 'You are not logged in' });
      return;
    }
    
    console.log('Looking for fromUser with socketId:', fromSocketId);
    const fromUser = users.get(fromSocketId);
    
    if (!fromUser) {
      console.log('From user not found for acceptChallenge. Available users:', Array.from(users.keys()));
      socket.emit('error', { message: 'Challenger not found or disconnected' });
      return;
    }

    console.log('Found fromUser:', fromUser.username);
    const gameId = generateGameId();
    const game = {
      id: gameId,
      player1: fromUser.username,
      player2: currentUser.username,
      player1Socket: fromSocketId,
      player2Socket: socket.id,
      board: null,
      currentPlayer: 'white',
      moves: []
    };

    games.set(gameId, game);
    console.log('Game created:', gameId, 'between', fromUser.username, 'and', currentUser.username);

    // Notify both players - use io.to() for better reliability
    // Challenger (who sent request) gets BLACK pieces
    // Accepter (who accepted) gets WHITE pieces
    console.log('Sending gameStarted events...');
    io.to(fromSocketId).emit('gameStarted', { 
      gameId, 
      opponent: currentUser.username, 
      color: 'black'  // Challenger gets black
    });
    console.log('Sent gameStarted to challenger (black):', fromUser.username, 'socket:', fromSocketId);
    
    io.to(socket.id).emit('gameStarted', { 
      gameId, 
      opponent: fromUser.username, 
      color: 'white'  // Accepter gets white
    });
    console.log('Sent gameStarted to accepter (white):', currentUser.username, 'socket:', socket.id);
  });

  // Make move
  socket.on('makeMove', (data) => {
    const { gameId, from, to } = data;
    const game = games.get(gameId);
    
    if (!game) return;

    const currentUser = users.get(socket.id);
    const isPlayer1 = game.player1Socket === socket.id;
    const isPlayer2 = game.player2Socket === socket.id;
    
    if (!isPlayer1 && !isPlayer2) return;

    // Update game state
    game.moves.push({ from, to });
    game.currentPlayer = game.currentPlayer === 'white' ? 'black' : 'white';

    // Broadcast move to opponent
    const opponentSocket = isPlayer1 ? game.player2Socket : game.player1Socket;
    io.to(opponentSocket).emit('moveMade', { gameId, from, to });
  });

  // Chat messages
  socket.on('chatMessage', (data) => {
    console.log('Chat message received:', data);
    const { gameId, message } = data;
    const game = games.get(gameId);
    
    if (!game) {
      console.log('Game not found for chat message');
      return;
    }

    const currentUser = users.get(socket.id);
    if (!currentUser) {
      console.log('User not found for chat message');
      return;
    }

    const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
    
    console.log('Sending chat message to opponent:', opponentSocket);
    io.to(opponentSocket).emit('chatMessage', {
      from: currentUser.username,
      message,
      timestamp: new Date().toISOString()
    });
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { gameId, isTyping } = data;
    const game = games.get(gameId);
    
    if (!game) return;

    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
    
    io.to(opponentSocket).emit('typing', {
      username: currentUser.username,
      isTyping
    });
  });

  // Voice chat signaling (WebRTC)
  socket.on('voiceOffer', (data) => {
    const { gameId, offer } = data;
    const game = games.get(gameId);
    if (!game) return;

    const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
    io.to(opponentSocket).emit('voiceOffer', { offer, from: users.get(socket.id).username });
  });

  socket.on('voiceAnswer', (data) => {
    const { gameId, answer } = data;
    const game = games.get(gameId);
    if (!game) return;

    const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
    io.to(opponentSocket).emit('voiceAnswer', { answer });
  });

  socket.on('voiceIceCandidate', (data) => {
    const { gameId, candidate } = data;
    const game = games.get(gameId);
    if (!game) return;

    const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
    io.to(opponentSocket).emit('voiceIceCandidate', { candidate });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      user.online = false;
      usernameToSocketId.delete(user.username);
      
      // Notify friends
      user.friends.forEach(friendUsername => {
        const friendSocketId = usernameToSocketId.get(friendUsername);
        if (friendSocketId && io.sockets.sockets.get(friendSocketId)) {
          io.to(friendSocketId).emit('friendOffline', { username: user.username });
        }
      });

      // Remove from active games
      for (const [gameId, game] of games.entries()) {
        if (game.player1Socket === socket.id || game.player2Socket === socket.id) {
          const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
          if (opponentSocket && io.sockets.sockets.get(opponentSocket)) {
            io.to(opponentSocket).emit('opponentDisconnected', { gameId });
          }
          games.delete(gameId);
        }
      }

      socket.broadcast.emit('userOffline', { username: user.username });
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

