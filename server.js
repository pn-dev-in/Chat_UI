const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const chatBot = {
    responses: [
        "That's interesting! Tell me more about that.",
        "I see what you're saying. How do you feel about it?",
        "Thanks for sharing! What else is on your mind?",
        "I understand. Can you elaborate on that?",
        "That's a great point! What made you think of that?",
        "Fascinating! I'd love to hear more details.",
        "I appreciate you sharing that with me.",
        "That sounds important. Could you explain further?",
        "I'm following along. What happened next?",
        "Interesting perspective! How did you come to that conclusion?"
    ],
    
    // Track last responses to avoid repetition
    lastUsedResponses: [],
    maxHistory: 5,
    
    getResponse: function(userMessage) {
        // Convert user message to lowercase for matching
        const userMsg = userMessage.toLowerCase().trim();
        
        // Special responses for specific keywords
        if (userMsg.includes('hello') || userMsg.includes('hi') || userMsg.includes('hey')) {
            return "Hello there! How can I help you today?";
        }
        if (userMsg.includes('how are you')) {
            return "I'm doing well, thank you! How about you?";
        }
        if (userMsg.includes('name')) {
            return "I'm ChatFlow Bot! I'm here to chat with you.";
        }
        if (userMsg.includes('thank')) {
            return "You're welcome! Is there anything else you'd like to talk about?";
        }
        if (userMsg.includes('bye') || userMsg.includes('goodbye')) {
            return "Goodbye! It was nice chatting with you!";
        }
        if (userMsg.includes('weather')) {
            return "I'm not sure about the weather, but I hope it's nice where you are!";
        }
        if (userMsg.includes('time')) {
            return `According to my clock, it's ${new Date().toLocaleTimeString()}`;
        }
        if (userMsg.includes('help')) {
            return "I'm here to chat with you! Just type anything and I'll respond.";
        }
        
        // For other messages, use a random response from available ones
        return this.getRandomResponse();
    },
    
    getRandomResponse: function() {
        // Filter out recently used responses
        const availableResponses = this.responses.filter(
            response => !this.lastUsedResponses.includes(response)
        );
        
        // If all responses have been used recently, reset the history
        const responsesToUse = availableResponses.length > 0 ? availableResponses : this.responses;
        
        // Get random response
        const randomIndex = Math.floor(Math.random() * responsesToUse.length);
        const selectedResponse = responsesToUse[randomIndex];
        
        // Add to recently used
        this.lastUsedResponses.push(selectedResponse);
        
        // Maintain history size
        if (this.lastUsedResponses.length > this.maxHistory) {
            this.lastUsedResponses.shift();
        }
        
        return selectedResponse;
    }
};

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// MySQL Database Connection
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'chatflow_db'
};


const pool = mysql.createPool(dbConfig);

// Create messages table if not exists
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                content TEXT NOT NULL,
                sender VARCHAR(50) NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                chat_id INT DEFAULT 1
            )
        `);
        console.log('✅ Database initialized');
        connection.release();
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// REST API
app.get('/api/messages', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM messages ORDER BY timestamp ASC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Socket.IO Events
io.on('connection', (socket) => {
    console.log('🔌 A user connected:', socket.id);

    socket.on('sendMessage', async (msg) => {
        try {
            // Save user message to DB
            const [result] = await pool.execute(
                'INSERT INTO messages (content, sender) VALUES (?, ?)',
                [msg.content, msg.sender]
            );

            const savedMessage = {
                id: result.insertId,
                content: msg.content,
                sender: msg.sender,
                timestamp: new Date()
            };

            // Send to all connected clients
            io.emit('receiveMessage', savedMessage);
            
            // Generate bot response after a short delay (1-3 seconds)
            const delay = 1000 + Math.random() * 2000; // 1-3 seconds random delay
            
            setTimeout(async () => {
                const botResponse = chatBot.getResponse(msg.content);
                
                const autoReply = {
                    content: botResponse,
                    sender: 'other'
                };
                
                const [replyResult] = await pool.execute(
                    'INSERT INTO messages (content, sender) VALUES (?, ?)',
                    [autoReply.content, autoReply.sender]
                );
                
                const savedAutoReply = {
                    id: replyResult.insertId,
                    content: autoReply.content,
                    sender: autoReply.sender,
                    timestamp: new Date()
                };
                
                io.emit('receiveMessage', savedAutoReply);
            }, delay);
            
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});
// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize DB + start server
initializeDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
    });
});
