const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg'); // Import Pool from pg

const app = express();
app.use(express.static('public'));
app.use(express.json());

const server = http.createServer(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 3000;
const ROOM_EXPIRATION_MS = 1 * 60 * 60 * 1000; // 1 hour

// --- PostgreSQL (Neon) Client Setup ---
const neonConnectionString = 'postgresql://Neondb_owner:npg_IKBHdX3QJnP4@ep-jolly-pine-abaqqczg-pooler.eu-west-2.aws.neon.tech/Neondb?sslmode=require';
const pool = new Pool({
    connectionString: neonConnectionString,
});

pool.on('connect', () => {
    console.log('Connected to NeonDB!');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // process.exit(-1); // Consider if critical
});

// --- Database Table Creation ---
async function createTables() {
    const client = await pool.connect();
    try {
        // Create meetings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS meetings (
                id SERIAL PRIMARY KEY,
                meeting_code VARCHAR(10) UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Meetings table checked/created.');

        // Create participants table
        await client.query(`
            CREATE TABLE IF NOT EXISTS participants (
                id SERIAL PRIMARY KEY,
                meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
                socket_id VARCHAR(255) NOT NULL,
                joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (meeting_id, socket_id) -- Ensure a socket isn't added twice to the same meeting
            );
        `);
        console.log('Participants table checked/created.');

    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        client.release();
    }
}

const MAX_ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours for very old rooms regardless of participants

// In-memory storage for active rooms (REMOVED - Replaced by database)
// const activeRooms = new Map(); 

// --- Room Cleanup Function (Database Version) ---
async function cleanupInactiveRooms() {
    console.log('[Scheduler] Running cleanup for inactive rooms from DB...');
    const now = Date.now();
    let deletedCount = 0;

    try {
        // Find meetings that are candidates for deletion
        // 1. Empty rooms (no participants) older than ROOM_EXPIRATION_MS based on last_active_at
        // 2. OR, very old rooms (e.g., > 24 hours based on created_at) regardless of participants (safety net)
        const query = `
            SELECT m.id, m.meeting_code, m.last_active_at, m.created_at
            FROM meetings m
            WHERE (
                NOT EXISTS (SELECT 1 FROM participants p WHERE p.meeting_id = m.id) 
                AND m.last_active_at < $1
            ) OR m.created_at < $2; 
        `;
        // Calculate expiration time for empty rooms based on last_active_at
        const emptyRoomExpirationTime = new Date(now - ROOM_EXPIRATION_MS);
        // Calculate creation time limit for very old rooms based on created_at
        const maxLifetimeThreshhold = new Date(now - MAX_ROOM_LIFETIME_MS);

        const candidates = await pool.query(query, [emptyRoomExpirationTime, maxLifetimeThreshhold]);
        
        if (candidates.rows.length > 0) {
            console.log(`[Scheduler] Found ${candidates.rows.length} candidate rooms for cleanup.`);
            for (const room of candidates.rows) {
                // The query itself now does the primary filtering.
                // We can add logging here about why it was selected.
                const isExpiredEmpty = !await (async () => { // Check if it had participants recently
                    const res = await pool.query("SELECT 1 FROM participants WHERE meeting_id = $1 LIMIT 1", [room.id]);
                    return res.rows.length > 0;
                })() && new Date(room.last_active_at) < emptyRoomExpirationTime;
                const isBeyondMaxLifetime = new Date(room.created_at) < maxLifetimeThreshhold;
                
                await pool.query("DELETE FROM meetings WHERE id = $1", [room.id]);
                deletedCount++;
                console.log(`[Scheduler] Room ${room.meeting_code} (ID: ${room.id}) deleted. Expired & Empty: ${isExpiredEmpty}, Max Lifetime Exceeded: ${isBeyondMaxLifetime}`);
            }
        }
        console.log(`[Scheduler] DB Cleanup finished. Deleted ${deletedCount} rooms.`);
    } catch (dbError) {
        console.error('[Scheduler] Error during database cleanup:', dbError);
    }
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
app.post('/api/create-meeting', async (req, res) => { // Made async
    let newMeetingCode;
    let attempts = 0;
    const maxAttempts = 5; // As per instructions

    while (attempts < maxAttempts) {
        newMeetingCode = generateMeetingCode();
        try {
            const result = await pool.query(
                "INSERT INTO meetings (meeting_code, created_at, last_active_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING meeting_code",
                [newMeetingCode]
            );
            // If insert is successful
            console.log(`Meeting created with code: ${result.rows[0].meeting_code} (DB)`);
            // Note: activeRooms is not updated here for the created room yet.
            // This will be handled if the room becomes active (e.g., first user joins).
            // For now, the room exists in the DB.
            return res.json({ meetingCode: result.rows[0].meeting_code });
        } catch (dbError) {
            if (dbError.code === '23505') { // Unique violation error code for PostgreSQL
                console.warn(`Meeting code ${newMeetingCode} already exists in DB. Retrying... (Attempt ${attempts + 1}/${maxAttempts})`);
                attempts++;
            } else {
                console.error('Error creating meeting in DB:', dbError);
                return res.status(500).json({ error: 'Failed to create meeting due to database error.' });
            }
        }
    }
    // If loop finishes, all attempts failed
    console.error('Failed to generate a unique meeting code after several DB insertion attempts.');
    return res.status(500).json({ error: 'Failed to create meeting due to code collision. Please try again.' });
});

app.get('/api/validate-code', async (req, res) => { // Made async
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ error: 'Meeting code is required.', isValid: false });
    }

    try {
        const result = await pool.query("SELECT id FROM meetings WHERE meeting_code = $1", [code]);
        if (result.rows.length > 0) {
            // Update last_active_at to keep the room "active"
            await pool.query("UPDATE meetings SET last_active_at = CURRENT_TIMESTAMP WHERE meeting_code = $1", [code]);
            console.log(`Meeting code ${code} validated successfully via API (DB).`);
            res.json({ isValid: true });
        } else {
            console.log(`Meeting code ${code} not found via API (DB).`);
            res.json({ isValid: false });
        }
    } catch (dbError) {
        console.error('Database error during meeting code validation:', dbError);
        res.status(500).json({ error: 'Internal server error validating meeting code', isValid: false });
    }
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
  socket.on('join-room', async ({ roomId, userId }) => { // Made async
    if (userId !== socket.id) {
      console.error(`User ID ${userId} does not match socket ID ${socket.id} for join-room.`);
      // Optionally, emit an error back to the client
      socket.emit('join-error', { error: 'User ID mismatch.' });
      return;
    }

    let meeting_id;
    try {
        // Get meeting_id from DB
        const meetingResult = await pool.query("SELECT id FROM meetings WHERE meeting_code = $1", [roomId]);
        if (meetingResult.rows.length === 0) {
            console.log(`Room ${roomId} not found in DB for join-room request by ${socket.id}`);
            socket.emit('room-not-found', roomId);
            return;
        }
        meeting_id = meetingResult.rows[0].id;

        // Add participant to DB
        await pool.query(
            "INSERT INTO participants (meeting_id, socket_id) VALUES ($1, $2) ON CONFLICT (meeting_id, socket_id) DO NOTHING",
            [meeting_id, socket.id]
        );

        // Update meetings.last_active_at
        await pool.query("UPDATE meetings SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1", [meeting_id]);
        
        // Store room information on the socket object for later use (e.g., disconnect)
        socket._currentRoomId = roomId; // The meeting code (string)
        socket._currentMeetingDbId = meeting_id; // The database ID (integer)

        // Fetch other participants from DB
        const participantsResult = await pool.query(
            "SELECT socket_id FROM participants WHERE meeting_id = $1 AND socket_id != $2",
            [meeting_id, socket.id]
        );
        const otherUsers = participantsResult.rows.map(row => row.socket_id);

        // Join Socket.IO room
        socket.join(roomId);

        // Emit events
        socket.emit('room-joined', { roomId, otherUsers });
        socket.to(roomId).emit('user-joined', socket.id);
        
        console.log(`User ${socket.id} joined room ${roomId} (DB meeting_id: ${meeting_id}). Other users: ${otherUsers.length}`);

    } catch (dbError) {
        console.error(`Database error during join-room for ${socket.id} in room ${roomId}:`, dbError);
        socket.emit('join-error', { error: 'Failed to join room due to server error.' });
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
  socket.on('chat-message', async ({ roomId, message, userName }) => { // Made async for DB check
    // Basic validation
    if (!message || !userName) {
      console.log(`Invalid chat message data (missing message or userName) from ${socket.id}:`, { roomId, message, userName });
      return;
    }
    try {
        // Validate roomId (meeting_code) exists in DB
        const meetingResult = await pool.query("SELECT id FROM meetings WHERE meeting_code = $1", [roomId]);
        if (meetingResult.rows.length === 0) {
            console.log(`Chat attempt in non-existent room ${roomId} by ${socket.id}. Message: "${message}"`);
            // Optionally emit an error to the sender
            socket.emit('chat-error', { error: `Room ${roomId} does not exist.`});
            return;
        }
        // If room exists in DB, proceed
        console.log(`Chat message from ${userName} (${socket.id}) in room ${roomId}: ${message}`);
        io.to(roomId).emit('new-chat-message', { message, userName, senderId: socket.id });
    } catch (dbError) {
        console.error(`DB error checking room ${roomId} for chat message by ${socket.id}:`, dbError);
        socket.emit('chat-error', { error: 'Server error processing your message.'});
    }
  });

  // Handle raise hand
  socket.on('raise-hand', async ({ roomId, userId, isRaised }) => { // Made async for DB check
    // Basic validation
    if (userId !== socket.id) {
      console.log(`Invalid raise-hand data (userId mismatch) from ${socket.id}. User: ${userId}, Socket: ${socket.id}`);
      return; // Silently ignore or emit an error
    }
     try {
        // Validate roomId (meeting_code) exists in DB
        const meetingResult = await pool.query("SELECT id FROM meetings WHERE meeting_code = $1", [roomId]);
        if (meetingResult.rows.length === 0) {
            console.log(`Raise hand attempt in non-existent room ${roomId} by ${socket.id}`);
             // Optionally emit an error to the sender
            socket.emit('raise-hand-error', { error: `Room ${roomId} does not exist.`});
            return;
        }
        // If room exists in DB, proceed
        console.log(`User ${userId} in room ${roomId} ${isRaised ? 'raised' : 'lowered'} hand.`);
        io.to(roomId).emit('user-raised-hand', { userId, isRaised });
    } catch (dbError) {
        console.error(`DB error checking room ${roomId} for raise hand by ${socket.id}:`, dbError);
        socket.emit('raise-hand-error', { error: 'Server error processing your request.'});
    }
  });

  socket.on('disconnect', async () => { // Made async
    console.log(`User disconnected: ${socket.id}`);

    const meetingDbId = socket._currentMeetingDbId;
    const meetingCode = socket._currentRoomId; // The string meeting code

    if (meetingDbId && meetingCode) {
      try {
        // Remove participant from DB
        const deleteResult = await pool.query(
          "DELETE FROM participants WHERE meeting_id = $1 AND socket_id = $2 RETURNING id",
          [meetingDbId, socket.id]
        );

        if (deleteResult.rowCount > 0) {
          console.log(`User ${socket.id} removed from participants table for meeting_id ${meetingDbId}.`);

          // Notify other users in the room
          socket.to(meetingCode).emit('user-left', socket.id);
          console.log(`Emitted 'user-left' for ${socket.id} to room ${meetingCode}`);

          // Check if room is now empty (optional, could be left to periodic cleanup)
          // For immediate feedback or different expiration logic, we can check.
          const participantsResult = await pool.query(
            "SELECT COUNT(*) AS count FROM participants WHERE meeting_id = $1",
            [meetingDbId]
          );
          const participantCount = parseInt(participantsResult.rows[0].count, 10);

          if (participantCount === 0) {
            console.log(`Room ${meetingCode} (DB ID: ${meetingDbId}) is now empty. It will be cleaned up by the scheduler if it expires.`);
            // Optionally, update last_active_at here or delete if no longer needed and not expired.
            // For now, we rely on the cleanupInactiveRooms for actual deletion of the 'meetings' record.
          } else {
            console.log(`Room ${meetingCode} (DB ID: ${meetingDbId}) now has ${participantCount} participants.`);
          }
        } else {
            console.log(`User ${socket.id} not found in participants table for meeting_id ${meetingDbId} on disconnect, or already removed.`);
        }
      } catch (dbError) {
        console.error(`Database error during disconnect for user ${socket.id} in meeting_id ${meetingDbId}:`, dbError);
      }
    } else {
      console.log(`User ${socket.id} disconnected without being in a known room (no _currentMeetingDbId or _currentRoomId).`);
    }

    // Remove from in-memory activeRooms map (if it was used for participant tracking, which is now deprecated)
    // The old logic iterated activeRooms.forEach(...). This is replaced by DB operations.
    // If activeRooms is still used for other purposes, that needs separate review.
    // For now, assuming participant tracking is fully moved to DB.
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port https://localhost:${PORT}`);
  // Start the scheduled cleanup task
  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes
  setInterval(cleanupInactiveRooms, CLEANUP_INTERVAL_MS);
  console.log(`[Scheduler] Inactive room cleanup task scheduled to run every ${CLEANUP_INTERVAL_MS / (60 * 1000)} minutes.`);
  
  // Create database tables on startup
  createTables().catch(console.error);
});
