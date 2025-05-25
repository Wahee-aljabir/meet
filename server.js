const express = require('express');
const http = require('http');
const crypto = require('crypto'); // Added crypto module

const app = express();
app.use(express.static('public')); // Serve static files from 'public' directory
app.use(express.json()); // Enable JSON parsing for Express

const server = http.createServer(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 3000;
const ROOM_EXPIRATION_MS = 1 * 60 * 60 * 1000; // 1 hour

// In-memory storage for active rooms
const activeRooms = new Map(); // meetingCode -> { participants: new Set(), createdAt: Date.now() }

// --- Room Cleanup Function ---
function cleanupInactiveRooms() {
    console.log('[Scheduler] Running cleanup for inactive rooms...');
    const now = Date.now();
    let deletedCount = 0;
    let checkedCount = 0;

    activeRooms.forEach((roomData, roomId) => {
        checkedCount++;
        // Ensure roomData and createdAt exist, and participants is a Set
        if (roomData && roomData.createdAt && roomData.participants instanceof Set) {
            if (roomData.participants.size === 0 && (now - roomData.createdAt) > ROOM_EXPIRATION_MS) {
                activeRooms.delete(roomId);
                deletedCount++;
                console.log(`[Scheduler] Room ${roomId} expired and was deleted. Created at: ${new Date(roomData.createdAt).toISOString()}`);
            }
        } else {
            console.warn(`[Scheduler] Room ${roomId} has malformed data or missing createdAt/participants. Skipping for expiration check.`);
            // Consider a more robust cleanup for malformed rooms if they persist unexpectedly
            // For example, if a room is extremely old and still malformed.
        }
    });

    console.log(`[Scheduler] Cleanup finished. Checked ${checkedCount} rooms, deleted ${deletedCount} expired rooms.`);
}

// Function to generate a random meeting code (ensure this is defined before use in API)
function generateMeetingCode(length = 8) {
    if (length < 5 || length > 10) {
        length = 8; 
    }
    const byteLength = Math.ceil(length * 0.75); 
    let code = crypto.randomBytes(byteLength).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    while (code.length < length) {
        code += crypto.randomBytes(1).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    }
    return code.slice(0, length);
}

// --- REST API Endpoints for Meeting Management ---
app.post('/api/create-meeting', (req, res) => {
    let newMeetingCode;
    let attempts = 0;
    const maxAttempts = 10; 

    do {
        newMeetingCode = generateMeetingCode();
        attempts++;
        if (attempts > maxAttempts) {
            console.error('Failed to generate a unique meeting code after several attempts.');
            return res.status(500).json({ error: 'Failed to create meeting code. Please try again.' });
        }
    } while (activeRooms.has(newMeetingCode));

    activeRooms.set(newMeetingCode, { participants: new Set(), createdAt: Date.now() });
    res.json({ meetingCode: newMeetingCode });
    console.log(`Meeting created via API with code: ${newMeetingCode}`);
});

app.get('/api/validate-code', (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ error: 'Meeting code is required.' });
    }
    const isValid = activeRooms.has(code);
    res.json({ isValid });
    console.log(`Validation attempt for code ${code} via API: ${isValid ? 'Valid' : 'Invalid'}`);
});


// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // // Handle create-meeting event (REMOVED - Handled by POST /api/create-meeting)
  // socket.on('create-meeting', () => {
  //   let newMeetingCode;
  //   do {
  //     newMeetingCode = generateMeetingCode();
  //   } while (activeRooms.has(newMeetingCode)); // Ensure code is unique
  //
  //   activeRooms.set(newMeetingCode, { participants: new Set(), createdAt: Date.now() });
  //   socket.emit('meeting-created', newMeetingCode);
  //   console.log(`Meeting created with code: ${newMeetingCode} by ${socket.id}`);
  // });

  // // Handle validate-meeting event (REMOVED - Handled by GET /api/validate-code)
  // socket.on('validate-meeting', (meetingCode) => {
  //   const isValid = activeRooms.has(meetingCode);
  //   socket.emit('meeting-validated', { meetingCode, isValid });
  //   if (isValid) {
  //     console.log(`Meeting code ${meetingCode} validated for ${socket.id}`);
  //   } else {
  //     console.log(`Invalid meeting code ${meetingCode} received from ${socket.id}`);
  //   }
  // });

  // Handle join-room event
  socket.on('join-room', ({ roomId, userId }) => {
    if (userId !== socket.id) {
      console.error(`User ID ${userId} does not match socket ID ${socket.id} for join-room.`);
      // Optionally, emit an error back to the client
      return;
    }

    const room = activeRooms.get(roomId);
    if (room) {
      room.participants.add(socket.id);
      socket.join(roomId);

      const otherUsers = Array.from(room.participants).filter(id => id !== socket.id);
      socket.emit('room-joined', { roomId, otherUsers });
      
      socket.to(roomId).emit('user-joined', socket.id);
      console.log(`User ${socket.id} joined room ${roomId}. Participants: ${Array.from(room.participants)}`);
    } else {
      console.log(`Room ${roomId} not found for join-room request by ${socket.id}`);
      // Optionally, emit an error back to the client, e.g., 'room-not-found'
    }
  });

  // Handle WebRTC signaling events
  socket.on('offer', ({ targetUserId, sdp }) => {
    socket.to(targetUserId).emit('offer-received', { sdp, offererUserId: socket.id });
    console.log(`Offer relayed from ${socket.id} to ${targetUserId}`);
  });

  socket.on('answer', ({ targetUserId, sdp }) => {
    socket.to(targetUserId).emit('answer-received', { sdp, answererUserId: socket.id });
    console.log(`Answer relayed from ${socket.id} to ${targetUserId}`);
  });

  socket.on('ice-candidate', ({ targetUserId, candidate }) => {
    socket.to(targetUserId).emit('ice-candidate-received', { candidate, candidateUserId: socket.id });
    console.log(`ICE candidate relayed from ${socket.id} to ${targetUserId}`);
  });

  // Handle chat messages
  socket.on('chat-message', ({ roomId, message, userName }) => {
    // Basic validation
    if (!activeRooms.has(roomId) || !message || !userName) {
      console.log(`Invalid chat message data from ${socket.id}:`, { roomId, message, userName });
      return;
    }
    console.log(`Chat message from ${userName} (${socket.id}) in room ${roomId}: ${message}`);
    // Broadcast to all users in the room including sender
    // Client-side will handle not displaying own message twice if it's already shown optimistically
    io.to(roomId).emit('new-chat-message', { message, userName, senderId: socket.id });
  });

  // Handle raise hand
  socket.on('raise-hand', ({ roomId, userId, isRaised }) => {
    // Basic validation
    if (!activeRooms.has(roomId) || userId !== socket.id) {
      console.log(`Invalid raise-hand data from ${socket.id}:`, { roomId, userId, isRaised });
      return;
    }
    console.log(`User ${userId} in room ${roomId} ${isRaised ? 'raised' : 'lowered'} hand.`);
    // Broadcast to all users in the room including sender
    io.to(roomId).emit('user-raised-hand', { userId, isRaised });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Find and remove user from any active room
    activeRooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        console.log(`User ${socket.id} removed from room ${roomId}`);

        // Notify other users in the room
        socket.to(roomId).emit('user-left', socket.id);

        if (room.participants.size === 0) {
          activeRooms.delete(roomId);
          console.log(`Room ${roomId} is now empty and has been deleted.`);
        } else {
          console.log(`Room ${roomId} now has participants: ${Array.from(room.participants)}`);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start the scheduled cleanup task
  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes
  setInterval(cleanupInactiveRooms, CLEANUP_INTERVAL_MS);
  console.log(`[Scheduler] Inactive room cleanup task scheduled to run every ${CLEANUP_INTERVAL_MS / (60 * 1000)} minutes.`);
});
