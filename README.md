# ChatJS - Real-time Customer Support Chat

A modern, real-time chat application built with Socket.IO that enables seamless communication between customers and support agents.

## Features

- **Real-time Messaging**: Instant communication powered by Socket.IO
- **Dual Interface**: Separate interfaces for customers and support agents
- **File Sharing**: Support for sharing images and documents
- **Queue Management**: Automatic agent assignment for waiting customers
- **Modern UI**: Beautiful, responsive design with smooth animations
- **Bot Integration**: Initial bot interaction with menu options
- **Agent Dashboard**: Professional interface for support agents

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Deployment**: Vercel (Serverless)

## Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/asharibkhannn/chatjs.git
   cd chatjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Customer Interface: http://localhost:3000
   - Agent Dashboard: http://localhost:3000/agent

## Deployment on Vercel

This application is optimized for deployment on Vercel with serverless functions.

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fasharibkhannn%2Fchatjs)

### Manual Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment Setup

The application is configured to work with Vercel's serverless environment:
- Socket.IO endpoint: `/api/socket`
- Static files served from root directory
- Node.js 18.x runtime

## File Structure

```
chatjs/
├── api/
│   └── socket.js          # Serverless Socket.IO handler
├── agent.html             # Agent dashboard interface
├── user.html              # Customer chat interface
├── user_fixed.html        # Alternative customer interface
├── server.js              # Local development server
├── package.json           # Dependencies and scripts
├── vercel.json            # Vercel configuration
└── README.md              # Project documentation
```

## Usage

### For Customers
1. Visit the main URL
2. Interact with the bot menu:
   - View Services
   - Contact Support
   - Chat with Agent
   - Exit
3. Select "Chat with Agent" to connect with a live agent
4. Share files and images during the conversation

### For Agents
1. Visit `/agent` endpoint
2. Wait for customer connections
3. Handle multiple customer chats
4. Share files and provide support

## API Endpoints

- `GET /` - Customer interface
- `GET /user` - Customer interface (alternative)
- `GET /agent` - Agent dashboard
- `WebSocket /api/socket` - Socket.IO connection

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@example.com or create an issue in this repository. 