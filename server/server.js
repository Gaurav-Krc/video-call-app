require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

// Fix CORS
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Add CORS middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());

// User and room state
const connectedUsers = new Map();
const activeRooms = new Map();

// Users endpoint
app.get('/users', async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, name, email, status FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});



app.post('/rooms', async (req, res) => {
    try {
        const { created_by, participants } = req.body;
        const roomId = uuidv4();

        await db.query(
            'INSERT INTO rooms (id, created_by) VALUES (?, ?)',
            [roomId, created_by]
        );

        // Add participants
        for (const participant of participants) {
            await db.query(
                'INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)',
                [roomId, participant]
            );
        }

        res.json({ roomId });
    } catch (error) {
        console.error('Room creation error:', error);
        res.status(500).json({ error: 'Room creation failed' });
    }
});

// Add participant to room
app.post('/rooms/:roomId/participants', async (req, res) => {
    try {
        const { participantId } = req.body;

        await db.query(
            'INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)',
            [req.params.roomId, participantId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding participant:', error);
        res.status(500).json({ error: 'Failed to add participant' });
    }
});

const activeCalls = new Map();

io.on('connection', (socket) => {
    const updateUserStatus = (userId, status) => {
        db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId])
            .catch(err => console.error('Error updating user status:', err));
    };
    // Handle user registration
    socket.on('register-user', (userId) => {
        connectedUsers.set(userId, socket.id);
        socket.userId = userId;
        updateUserStatus(userId, 'active');
    });

    // Handle call initiation
    socket.on('initiate-call', ({ callerId, calleeId, roomId }) => {
        const calleeSocket = connectedUsers.get(calleeId);
        if (calleeSocket) {
            io.to(calleeSocket).emit('incoming-call', {
                callerId,
                roomId
            });
        }
    });

    // Handle call acceptance
    socket.on('accept-call', ({ roomId, calleeId }) => {
        const call = activeCalls.get(roomId);
        if (call && call.calleeId === calleeId) {
            const callerSocket = connectedUsers.get(call.callerId);
            if (callerSocket) {
                io.to(callerSocket).emit('call-accepted', { roomId });
            }
        }
    });

    socket.on('webrtc-signal', ({ roomId, signal, sender }) => {
        // Join the room when receiving first signal
        socket.join(roomId);
        socket.to(roomId).emit('webrtc-signal', { roomId, signal, sender });
    });

    // Add this handler for room joining:
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room ${roomId}`);
    });



    socket.on('transcript', async ({ roomId, text, userId }) => {
        try {
            // Fetch user name from database
            const [users] = await db.query(
                'SELECT name FROM users WHERE id = ?',
                [userId]
            );
            const userName = users[0]?.name;


            // Broadcast to OTHER users only
            socket.to(roomId).emit('transcript', {  // Changed from io.to()
                text,
                userId,
                userName,
                timestamp: new Date().toISOString()
            });

            // Store in database
            await db.query(
                'INSERT INTO transcripts (room_id, user_id, user_name, text) VALUES (?, ?, ?, ?)',
                [roomId, userId, userName, text]
            );
        } catch (error) {
            console.error('Error handling transcript:', error);
        }
    });

    // Handle call rejection
    socket.on('reject-call', ({ callerId, roomId }) => {
        const callerSocket = connectedUsers.get(callerId);
        if (callerSocket) {
            io.to(callerSocket).emit('call-rejected', { roomId });
        }

        // // Clean up room if it exists
        // db.query('DELETE FROM rooms WHERE id = ?', [roomId])
        //     .catch(err => console.error('Error cleaning up rejected call room:', err));
    });

    // Handle call rejection notification
    socket.on('call-rejected', ({ roomId }) => {
        // Clean up any local call state
        activeCalls.delete(roomId);
    });

    socket.on('end-call', async ({ roomId }) => {
        try {
            // Force all participants to leave the room
            io.socketsLeave(roomId); 
            // Mark room as ended
            await db.query(
                'UPDATE rooms SET ended_at = NOW() WHERE id = ?',
                [roomId]
            );

            // Notify all participants
            io.to(roomId).emit('call-ended');
            activeCalls.delete(roomId);
            console.log(`Room ${roomId} terminated`);
        } catch (error) {
            console.error('Error ending call:', error);
        }
    });

    // Handle explicit room leaving
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${socket.userId} left room ${roomId}`);
    });


    socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);

        // Leave all rooms
        socket.rooms.forEach(room => {
            if (room !== socket.id) { // Skip default room
                socket.leave(room);
                console.log(`User ${socket.userId} left room ${room}`);
            }
        });

        if (socket.userId) {
            connectedUsers.delete(socket.userId);
        }
    });

});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));