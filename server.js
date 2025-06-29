const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the current directory
app.use(express.static(__dirname));

// Routes for HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'user.html'));
});

app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'user.html'));
});

app.get('/agent', (req, res) => {
    res.sendFile(path.join(__dirname, 'agent.html'));
});

// Maintain a queue of waiting users
let waitingUsers = [];

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('role', (role) => {
        socket.data.role = role;

        if (role === 'user') {
            // Show menu to user
            socket.emit('bot-message', `Choose:\n1. View Services\n2. Contact Support\n3. Chat with Agent\n4. Exit`);
        }

        if (role === 'agent') {
            // Check if user is waiting
            if (waitingUsers.length > 0) {
                const userSocket = waitingUsers.shift();
                const roomId = `room-${userSocket.id}-${socket.id}`;

                userSocket.join(roomId);
                socket.join(roomId);

                userSocket.data.roomId = roomId;
                socket.data.roomId = roomId;

                userSocket.emit('bot-message', 'You are now connected to a live agent.');
                socket.emit('bot-message', 'You are now chatting with a user.');
            } else {
                socket.emit('bot-message', 'Waiting for a user to request chat...');
            }
        }
    });    socket.on('user-message', (msg) => {
        const role = socket.data.role;

        if (role === 'user') {
            if (socket.data.roomId) {
                // User is already in a chat room with an agent
                socket.to(socket.data.roomId).emit('chat-message', `User: ${msg}`);
            } else if (msg.trim() === '3') {
                // User requested escalation
                waitingUsers.push(socket);
                socket.emit('bot-message', 'Connecting you to a live agent...');
                
                // Check if any agents are available
                const availableAgents = Array.from(io.sockets.sockets.values())
                    .filter(s => s.data.role === 'agent' && !s.data.roomId);
                
                if (availableAgents.length > 0) {
                    const agentSocket = availableAgents[0];
                    const roomId = `room-${socket.id}-${agentSocket.id}`;

                    socket.join(roomId);
                    agentSocket.join(roomId);

                    socket.data.roomId = roomId;
                    agentSocket.data.roomId = roomId;

                    // Remove user from waiting queue
                    const userIndex = waitingUsers.indexOf(socket);
                    if (userIndex > -1) {
                        waitingUsers.splice(userIndex, 1);
                    }

                    socket.emit('bot-message', 'You are now connected to a live agent.');
                    agentSocket.emit('bot-message', 'You are now chatting with a user.');
                }
            } else {
                // Bot handles other menu options
                let reply = '';
                switch (msg.trim()) {
                    case '1':
                        reply = 'Services: Web Dev, SEO, AI Bots.';
                        break;
                    case '2':
                        reply = 'Contact: support@example.com';
                        break;
                    case '4':
                        reply = 'Thanks! Goodbye!';
                        break;
                    default:
                        reply = `Choose:\n1. View Services\n2. Contact Support\n3. Chat with Agent\n4. Exit`;
                }
                socket.emit('bot-message', reply);
            }
        }
    });    socket.on('user-file', (fileData) => {
        console.log('User file received:', fileData.name, fileData.size);
        
        if (socket.data.roomId) {
            // User is in a chat room with an agent, forward the file
            socket.to(socket.data.roomId).emit('agent-file', fileData);
            socket.emit('file-received'); // Confirm receipt
        } else {
            // User not connected to agent, handle as needed
            socket.emit('bot-message', 'File received. Please connect to an agent to share files.');
        }
    });

    socket.on('agent-file', (fileData) => {
        console.log('Agent file received:', fileData.name, fileData.size);
        
        if (socket.data.roomId) {
            // Agent is in a chat room with a user, forward the file
            socket.to(socket.data.roomId).emit('user-file', fileData);
            socket.emit('file-received'); // Confirm receipt
        }
    });

    socket.on('chat-message', (msg) => {
        if (socket.data.roomId) {
            const role = socket.data.role;
            const prefix = role === 'agent' ? 'Agent: ' : 'User: ';
            socket.to(socket.data.roomId).emit('chat-message', prefix + msg);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        
        // Remove from waiting queue if present
        const waitingIndex = waitingUsers.indexOf(socket);
        if (waitingIndex > -1) {
            waitingUsers.splice(waitingIndex, 1);
        }
        
        // If in a room, notify the other party
        if (socket.data.roomId) {
            socket.to(socket.data.roomId).emit('bot-message', 'The other party has disconnected.');
        }
    });
});

server.listen(3000, () => {
    console.log('Server listening on http://localhost:3000');
});
