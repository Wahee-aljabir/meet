const socket = io();
let localUserId;
let roomId;

// Object to expose signaling functions to webrtc.js
const socketClient = {
    sendOffer: (targetUserId, sdp) => {
        socket.emit('offer', { targetUserId, sdp, roomId });
    },
    sendAnswer: (targetUserId, sdp) => {
        socket.emit('answer', { targetUserId, sdp, roomId });
    },
    sendIceCandidate: (targetUserId, candidate) => {
        socket.emit('ice-candidate', { targetUserId, candidate, roomId });
    },
    // --- Chat and Raise Hand Emitters ---
    sendChatMessage: (message, userName) => { // userName is passed from meeting-ui.js
        if (roomId && localUserId) {
            socket.emit('chat-message', { roomId, message, userName: userName || localUserId });
        } else {
            console.error("Cannot send chat message, room or user ID missing.");
        }
    },
    sendRaiseHand: (isRaised) => {
        if (roomId && localUserId) {
            socket.emit('raise-hand', { roomId, userId: localUserId, isRaised });
        } else {
            console.error("Cannot send raise hand status, room or user ID missing.");
        }
    },
    getLocalUserId: () => localUserId,
    getRoomId: () => roomId
};

socket.on('connect', () => {
    localUserId = socket.id;
    console.log('Connected to server with local ID:', localUserId);

    roomId = new URLSearchParams(window.location.search).get('room');
    if (roomId) {
        console.log('Joining room:', roomId);
        socket.emit('join-room', { roomId, userId: localUserId });
    } else {
        console.error('Room ID not found in URL.');
        alert('Error: Room ID is missing. Please go back and try creating or joining a meeting again.');
        // Potentially redirect back to the landing page
        // window.location.href = '/';
    }
});

socket.on('room-joined', ({ roomId: joinedRoomId, otherUsers }) => {
    console.log(`Successfully joined room: ${joinedRoomId}. Other users:`, otherUsers);
    // Initialize WebRTC connections to other users in the room
    if (typeof initWebRTC === 'function') { // Check if webrtc.js is loaded and initWebRTC is available
        otherUsers.forEach(userId => {
            if (userId !== localUserId) {
                console.log('Creating peer connection to existing user:', userId);
                // true indicates this client is the initiator for existing users
                if (typeof createNewPeerConnection === 'function') {
                    createNewPeerConnection(userId, true); 
                } else {
                    console.error('createNewPeerConnection is not defined in webrtc.js');
                }
            }
        });
    } else {
        console.error('initWebRTC or core WebRTC functions are not available.');
    }
});

socket.on('user-joined', (newUserId) => {
    console.log('New user joined the room:', newUserId);
    // New user will initiate the connection, so this client just logs and waits for an offer.
    // WebRTC connection will be established when 'offer-received' is handled.
    // No need to call createNewPeerConnection here with isInitiator = false,
    // as the offer will trigger the peer connection creation.
});

socket.on('offer-received', ({ sdp, offererUserId }) => {
    console.log(`Offer received from ${offererUserId}`, sdp);
    if (typeof handleOffer === 'function') {
        handleOffer(sdp, offererUserId);
    } else {
        console.error('handleOffer is not defined in webrtc.js');
    }
});

socket.on('answer-received', ({ sdp, answererUserId }) => {
    console.log(`Answer received from ${answererUserId}`, sdp);
    if (typeof handleAnswer === 'function') {
        handleAnswer(sdp, answererUserId);
    } else {
        console.error('handleAnswer is not defined in webrtc.js');
    }
});

socket.on('ice-candidate-received', ({ candidate, candidateUserId }) => {
    console.log(`ICE candidate received from ${candidateUserId}`, candidate);
    if (typeof addIceCandidate === 'function') {
        addIceCandidate(candidate, candidateUserId);
    } else {
        console.error('addIceCandidate is not defined in webrtc.js');
    }
});

socket.on('user-left', (userId) => {
    console.log('User left the room:', userId);
    if (typeof handleUserLeft === 'function') {
        handleUserLeft(userId);
    } else {
        console.error('handleUserLeft is not defined in webrtc.js');
    }
});

// Error handling for socket connection
socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    // Handle disconnection, e.g., show a message to the user
    alert("Disconnected from the server: " + reason + ". Please try rejoining.");
    if (typeof endCall === 'function' && reason !== 'io client disconnect') { // endCall from webrtc.js
        // Avoid calling endCall if it was a deliberate disconnect (e.g., by endCall itself)
        // endCall(); // This might cause a loop if endCall also disconnects socket
    } else if (reason === 'io client disconnect') {
        // This means socket.disconnect() was called, likely by endCall.
        // No further action needed other than UI cleanup if any.
    } else {
         window.location.href = '/index.html'; // Fallback redirect
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert("Failed to connect to the server. Please check your connection and try again.");
    window.location.href = '/index.html'; // Redirect on critical connection error
});

// --- Chat and Raise Hand Listeners ---
socket.on('new-chat-message', ({ message, userName, senderId }) => {
    console.log(`New chat message from ${userName} (${senderId}): ${message}`);
    if (typeof displayChatMessage === 'function') { // displayChatMessage from meeting-ui.js
        // Check if it's the local user's message. 
        // The local message is already displayed optimistically in meeting-ui.js
        if (senderId !== localUserId) {
            displayChatMessage(message, userName, senderId, false);
        }
    } else {
        console.error('displayChatMessage function not found in meeting-ui.js');
    }
});

socket.on('user-raised-hand', ({ userId, isRaised }) => {
    console.log(`User ${userId} ${isRaised ? 'raised' : 'lowered'} hand.`);
    if (typeof updateUserHandStatus === 'function') { // updateUserHandStatus from meeting-ui.js
        updateUserHandStatus(userId, isRaised);
    } else {
        console.error('updateUserHandStatus function not found in meeting-ui.js');
    }
});
