import { Server } from 'socket.io';

let io;

export default function handler(req, res) {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...');
    
    io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      allowEIO3: true,
      transports: ['polling', 'websocket']
    });

    res.socket.server.io = io;

    // Store connected users and agents
    const users = new Map();
    const agents = new Map();
    const waitingUsers = [];

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('role', (role) => {
        socket.role = role;
        
        if (role === 'user') {
          users.set(socket.id, socket);
          socket.emit('bot-message', `👋 Hello! Choose an option:\n1. View Services\n2. Contact Support\n3. Chat with Agent\n4. Exit`);
        } else if (role === 'agent') {
          agents.set(socket.id, socket);
          
          // Check for waiting users
          if (waitingUsers.length > 0) {
            const userSocket = waitingUsers.shift();
            if (userSocket && userSocket.connected) {
              connectUserToAgent(userSocket, socket);
            }
          } else {
            socket.emit('bot-message', '👩‍💼 Agent dashboard ready. Waiting for customers...');
          }
        }
      });

      socket.on('user-message', (msg) => {
        if (socket.role === 'user') {
          if (socket.partnerId) {
            // Forward to connected agent
            const partner = agents.get(socket.partnerId);
            if (partner && partner.connected) {
              partner.emit('chat-message', `Customer: ${msg}`);
            }
          } else if (msg.trim() === '3') {
            // Request agent connection
            socket.emit('bot-message', '🔄 Connecting you to an agent...');
            
            // Find available agent
            const availableAgent = Array.from(agents.values()).find(agent => !agent.partnerId);
            
            if (availableAgent) {
              connectUserToAgent(socket, availableAgent);
            } else {
              waitingUsers.push(socket);
              socket.emit('bot-message', '⏳ All agents are busy. You are in queue...');
            }
          } else {
            // Handle bot responses
            handleBotMessage(socket, msg.trim());
          }
        }
      });

      socket.on('chat-message', (msg) => {
        if (socket.role === 'agent' && socket.partnerId) {
          const partner = users.get(socket.partnerId);
          if (partner && partner.connected) {
            partner.emit('chat-message', `Agent: ${msg}`);
          }
        }
      });

      socket.on('user-file', (fileData) => {
        if (socket.partnerId) {
          const partner = socket.role === 'user' ? agents.get(socket.partnerId) : users.get(socket.partnerId);
          if (partner && partner.connected) {
            partner.emit('user-file', fileData);
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Remove from collections
        users.delete(socket.id);
        agents.delete(socket.id);
        
        // Remove from waiting queue
        const waitingIndex = waitingUsers.findIndex(s => s.id === socket.id);
        if (waitingIndex > -1) {
          waitingUsers.splice(waitingIndex, 1);
        }
        
        // Notify partner if connected
        if (socket.partnerId) {
          const partner = socket.role === 'user' ? agents.get(socket.partnerId) : users.get(socket.partnerId);
          if (partner && partner.connected) {
            partner.emit('bot-message', '❌ The other party has disconnected.');
            partner.partnerId = null;
          }
        }
      });
    });

    function connectUserToAgent(userSocket, agentSocket) {
      userSocket.partnerId = agentSocket.id;
      agentSocket.partnerId = userSocket.id;
      
      userSocket.emit('bot-message', '✅ Connected to a live agent! You can now chat.');
      agentSocket.emit('bot-message', '👤 Customer connected. You can now assist them.');
    }

    function handleBotMessage(socket, msg) {
      let reply = '';
      switch (msg) {
        case '1':
          reply = '🛠️ Our Services:\n• Web Development\n• SEO Optimization\n• AI Chatbots\n• Digital Marketing';
          break;
        case '2':
          reply = '📧 Contact Information:\n• Email: support@example.com\n• Phone: +1-234-567-8900\n• Hours: 9 AM - 5 PM EST';
          break;
        case '4':
          reply = '👋 Thank you for visiting! Have a great day!';
          break;
        default:
          reply = '❓ Please choose a valid option:\n1. View Services\n2. Contact Support\n3. Chat with Agent\n4. Exit';
      }
      socket.emit('bot-message', reply);
    }
  }
  
  res.end();
} 