import { Server } from 'socket.io';

export default function handler(req, res) {
  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...');
    
    const io = new Server(res.socket.server, {
      path: '/api/socket/',
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
      },
      allowEIO3: true,
      transports: ['polling'], // Only use polling for better serverless compatibility
      pingTimeout: 60000, // Increase ping timeout
      pingInterval: 25000, // Increase ping interval
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6,
      allowRequest: (req, callback) => {
        callback(null, true);
      }
    });

    res.socket.server.io = io;

    // Use global variables for persistence across function calls
    if (!global.chatUsers) global.chatUsers = new Map();
    if (!global.chatAgents) global.chatAgents = new Map();
    if (!global.waitingUsers) global.waitingUsers = [];

    io.on('connection', (socket) => {
      console.log('[SERVER] New client connected', {
        id: socket.id,
        transport: socket.conn.transport.name,
        headers: socket.handshake.headers['user-agent']
      });

      socket.conn.on('upgrade', () => {
        console.log('[SERVER] Transport upgraded', socket.id, 'to', socket.conn.transport.name);
      });

      socket.on('error', (err) => {
        console.error('[SERVER] Socket error', socket.id, err);
      });

      socket.onAny((event, ...args) => {
        if (['ping', 'pong'].includes(event)) return;
        console.log(`[SERVER] Event "${event}" from ${socket.id}`, args[0]);
      });
      
      // Send immediate connection confirmation
      socket.emit('connection-confirmed', { id: socket.id, timestamp: Date.now() });

      socket.on('role', (role) => {
        console.log(`Setting role ${role} for socket ${socket.id}`);
        socket.role = role;
        
        if (role === 'user') {
          global.chatUsers.set(socket.id, {
            id: socket.id,
            socket: socket,
            partnerId: null,
            connected: true
          });
          
          socket.emit('bot-message', `👋 Welcome! Choose an option:\n1. View Services\n2. Contact Support\n3. Chat with Agent\n4. Exit`);
          socket.emit('status', 'ready');
          
        } else if (role === 'agent') {
          global.chatAgents.set(socket.id, {
            id: socket.id,
            socket: socket,
            partnerId: null,
            connected: true
          });
          
          // Check for waiting users
          if (global.waitingUsers.length > 0) {
            const waitingUser = global.waitingUsers.shift();
            const userObj = global.chatUsers.get(waitingUser);
            if (userObj && userObj.connected) {
              connectUserToAgent(userObj, global.chatAgents.get(socket.id));
            }
          } else {
            socket.emit('bot-message', '👩‍💼 Agent dashboard ready. Waiting for customers...');
          }
          socket.emit('status', 'ready');
        }
      });

      socket.on('user-message', (msg) => {
        const userObj = global.chatUsers.get(socket.id);
        if (!userObj) return;

        if (userObj.partnerId) {
          // Forward to connected agent
          const agentObj = global.chatAgents.get(userObj.partnerId);
          if (agentObj && agentObj.connected && agentObj.socket.connected) {
            agentObj.socket.emit('chat-message', `Customer: ${msg}`);
          }
        } else if (msg.trim() === '3') {
          // Request agent connection
          socket.emit('bot-message', '🔄 Connecting you to an agent...');
          
          // Find available agent
          const availableAgent = Array.from(global.chatAgents.values())
            .find(agent => !agent.partnerId && agent.connected);
          
          if (availableAgent) {
            connectUserToAgent(userObj, availableAgent);
          } else {
            if (!global.waitingUsers.includes(socket.id)) {
              global.waitingUsers.push(socket.id);
            }
            socket.emit('bot-message', '⏳ All agents are busy. You are in queue...');
          }
        } else {
          // Handle bot responses
          handleBotMessage(socket, msg.trim());
        }
      });

      socket.on('chat-message', (msg) => {
        const agentObj = global.chatAgents.get(socket.id);
        if (agentObj && agentObj.partnerId) {
          const userObj = global.chatUsers.get(agentObj.partnerId);
          if (userObj && userObj.connected && userObj.socket.connected) {
            userObj.socket.emit('chat-message', `Agent: ${msg}`);
          }
        }
      });

      socket.on('user-file', (fileData) => {
        const userObj = global.chatUsers.get(socket.id);
        const agentObj = global.chatAgents.get(socket.id);
        
        let partnerId = null;
        let targetCollection = null;
        
        if (userObj && userObj.partnerId) {
          partnerId = userObj.partnerId;
          targetCollection = global.chatAgents;
        } else if (agentObj && agentObj.partnerId) {
          partnerId = agentObj.partnerId;
          targetCollection = global.chatUsers;
        }
        
        if (partnerId && targetCollection) {
          const partner = targetCollection.get(partnerId);
          if (partner && partner.connected && partner.socket.connected) {
            partner.socket.emit('user-file', fileData);
          }
        }
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
        
        const userObj = global.chatUsers.get(socket.id);
        const agentObj = global.chatAgents.get(socket.id);
        
        // Handle user disconnect
        if (userObj) {
          userObj.connected = false;
          if (userObj.partnerId) {
            const partner = global.chatAgents.get(userObj.partnerId);
            if (partner && partner.connected && partner.socket.connected) {
              partner.socket.emit('bot-message', '❌ Customer disconnected.');
              partner.partnerId = null;
            }
          }
          global.chatUsers.delete(socket.id);
        }
        
        // Handle agent disconnect
        if (agentObj) {
          agentObj.connected = false;
          if (agentObj.partnerId) {
            const partner = global.chatUsers.get(agentObj.partnerId);
            if (partner && partner.connected && partner.socket.connected) {
              partner.socket.emit('bot-message', '❌ Agent disconnected.');
              partner.partnerId = null;
            }
          }
          global.chatAgents.delete(socket.id);
        }
        
        // Remove from waiting queue
        global.waitingUsers = global.waitingUsers.filter(id => id !== socket.id);
      });
    });

    function connectUserToAgent(userObj, agentObj) {
      if (!userObj || !agentObj) return;
      
      userObj.partnerId = agentObj.id;
      agentObj.partnerId = userObj.id;
      
      if (userObj.socket && userObj.socket.connected) {
        userObj.socket.emit('bot-message', '✅ Connected to a live agent! You can now chat.');
        userObj.socket.emit('status', 'connected-to-agent');
      }
      
      if (agentObj.socket && agentObj.socket.connected) {
        agentObj.socket.emit('bot-message', '👤 Customer connected. You can now assist them.');
        agentObj.socket.emit('status', 'connected-to-customer');
      }
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