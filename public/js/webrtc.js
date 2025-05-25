const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

let localStream;
const peerConnections = {}; // Stores RTCPeerConnection objects, keyed by targetUserId
const localVideo = document.getElementById('localVideo');
const videoGrid = document.getElementById('videoGrid');

// Promise for local stream readiness
let _resolveLocalStreamReady;
let _rejectLocalStreamReady;
window.localStreamReady = new Promise((resolve, reject) => {
    _resolveLocalStreamReady = resolve;
    _rejectLocalStreamReady = reject;
});

// Function to initialize WebRTC: get local media
function initWebRTC() { 
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            if (localVideo) {
                localVideo.srcObject = stream;
                // Add controls overlay to local video
                const localVideoContainer = document.getElementById('localVideoContainer');
                if (localVideoContainer) {
                    addVideoControlsOverlay(localVideoContainer, 'localVideoContainer', true); // true for isLocal
                }
            } else {
                console.warn("localVideo element not found during initWebRTC.");
            }
            console.log("Local stream obtained successfully.");
            _resolveLocalStreamReady(stream); 
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
            if (window.meetingUI && typeof window.meetingUI.showCriticalError === 'function') {
                let errorMessage = `Error accessing media devices: ${error.name}. Check permissions & ensure camera/mic are available.`;
                 if (error.name === 'NotFoundError') {
                    errorMessage = 'No camera or microphone found. Please connect a device and try again.';
                } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    errorMessage = 'Permission to use camera and microphone was denied. Please enable permissions in your browser settings and reload the page.';
                }
                window.meetingUI.showCriticalError(errorMessage);
            } else {
                alert('Critical Error: Could not access camera/microphone. Please check permissions.');
            }
            _rejectLocalStreamReady(error); // Reject the global promise
        });
    // Note: This function itself doesn't return the promise directly, 
    // but window.localStreamReady is the promise to await.
}

// Function to create and configure a new PeerConnection
function createNewPeerConnection(targetUserId, isInitiator = false) {
    if (!localStream) {
        console.error('Local stream is not available. Cannot create peer connection for', targetUserId);
        // Optionally, notify the user or queue, but for now, just return.
        // This situation should be less likely if calls are correctly awaiting window.localStreamReady.
        return null; 
    }
    if (peerConnections[targetUserId]) {
        console.log(`Peer connection with ${targetUserId} already exists.`);
        return peerConnections[targetUserId];
    }

    console.log(`Creating new peer connection to ${targetUserId}, initiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(iceServers);
    peerConnections[targetUserId] = pc;

    // Add local stream tracks to the peer connection
    // This part assumes localStream is ready. The guard is above.
    localStream.getTracks().forEach(track => {
        try {
            pc.addTrack(track, localStream);
        } catch (error) {
            console.error(`Error adding track ${track.kind} for ${targetUserId}:`, error);
            // Depending on the error, might need to handle this more gracefully
        }
    });
    console.log(`Added local stream tracks for ${targetUserId}`);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            // Ensure socketClient is available (from socket-client.js)
            if (typeof socketClient !== 'undefined' && socketClient.sendIceCandidate) {
                socketClient.sendIceCandidate(targetUserId, event.candidate);
            } else {
                console.error('socketClient or sendIceCandidate is not available.');
            }
        }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
        handleRemoteTrack(event, targetUserId);
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${targetUserId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
            // Handle connection failure/closure
            console.log(`Connection with ${targetUserId} failed or closed.`);
            // cleanupPeerConnection(targetUserId); // Implement cleanup
        }
    };

    if (isInitiator) {
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                if (typeof socketClient !== 'undefined' && socketClient.sendOffer) {
                    socketClient.sendOffer(targetUserId, pc.localDescription);
                    console.log(`Offer sent to ${targetUserId}`);
                } else {
                    console.error('socketClient or sendOffer is not available.');
                }
            })
            .catch(error => console.error('Error creating offer:', error));
    }
    return pc;
}


// Placeholder for handling incoming offers
async function handleOffer(sdp, offererUserId) {
    console.log(`Handling offer from ${offererUserId}`);
    const pc = createNewPeerConnection(offererUserId, false); // Not initiator
    if (!pc) return;

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`Remote description set for offer from ${offererUserId}`);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (typeof socketClient !== 'undefined' && socketClient.sendAnswer) {
            socketClient.sendAnswer(offererUserId, pc.localDescription);
            console.log(`Answer sent to ${offererUserId}`);
        } else {
            console.error('socketClient or sendAnswer is not available.');
        }
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Placeholder for handling incoming answers
async function handleAnswer(sdp, answererUserId) {
    console.log(`Handling answer from ${answererUserId}`);
    const pc = peerConnections[answererUserId];
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log(`Remote description set for answer from ${answererUserId}`);
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    } else {
        console.error(`PeerConnection not found for ${answererUserId} when handling answer.`);
    }
}

// Placeholder for adding ICE candidates
async function addIceCandidate(candidate, candidateUserId) {
    console.log(`Adding ICE candidate from ${candidateUserId}`);
    const pc = peerConnections[candidateUserId];
    if (pc && candidate) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`ICE candidate added for ${candidateUserId}`);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    } else if (!candidate) {
        console.log(`Null ICE candidate received for ${candidateUserId}, usually means end of candidates.`);
    } else {
        console.error(`PeerConnection not found for ${candidateUserId} when adding ICE candidate.`);
    }
}

// Function to toggle fullscreen for a video container
function toggleFullScreen(videoContainerElement) {
    if (!document.fullscreenElement) {
        if (videoContainerElement.requestFullscreen) {
            videoContainerElement.requestFullscreen();
        } else if (videoContainerElement.mozRequestFullScreen) { /* Firefox */
            videoContainerElement.mozRequestFullScreen();
        } else if (videoContainerElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
            videoContainerElement.webkitRequestFullscreen();
        } else if (videoContainerElement.msRequestFullscreen) { /* IE/Edge */
            videoContainerElement.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Function to add controls overlay to a video container
function addVideoControlsOverlay(videoContainer, userId, isLocal = false) {
    let overlay = videoContainer.querySelector('.video-controls-overlay');
    if (overlay) overlay.remove(); // Remove existing if any, to prevent duplicates

    overlay = document.createElement('div');
    overlay.className = 'video-controls-overlay absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-2 p-1';
    videoContainer.classList.add('group'); // Needed for group-hover

    // 1. Pin Button
    const pinButton = document.createElement('button');
    pinButton.innerHTML = '<i class="fas fa-thumbtack"></i>';
    pinButton.className = 'pin-button control-button-sm bg-gray-700 hover:bg-gray-600 text-white'; // General styling
    pinButton.dataset.userId = userId; // Store userId for identification
    pinButton.title = `Pin ${isLocal ? 'You' : userId.substring(0,6)}`;
    pinButton.onclick = (e) => {
        e.stopPropagation(); // Prevent event bubbling if container has own click events
        if (window.meetingUI && typeof window.meetingUI.setSpotlightedUser === 'function') {
            window.meetingUI.setSpotlightedUser(userId); // Let meeting-ui handle toggle logic
        }
    };
    overlay.appendChild(pinButton);

    // 2. Fullscreen Button
    const fullscreenButton = document.createElement('button');
    fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
    fullscreenButton.className = 'control-button-sm bg-gray-700 hover:bg-gray-600 text-white';
    fullscreenButton.title = 'Toggle Fullscreen';
    fullscreenButton.onclick = (e) => {
        e.stopPropagation();
        toggleFullScreen(videoContainer);
    };
    overlay.appendChild(fullscreenButton);
    
    // 3. Mute Indicator (Placeholder for remote users, actual icon added based on signaling)
    if (!isLocal) {
        const muteIndicator = document.createElement('div');
        muteIndicator.id = `mute-indicator-${userId}`;
        muteIndicator.className = 'absolute top-2 left-2 text-red-500 text-lg hidden'; // Hidden by default
        muteIndicator.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        videoContainer.appendChild(muteIndicator); // Add to container, not overlay, for persistent visibility if muted
    }
    
    videoContainer.appendChild(overlay);

    // Update pin button state after adding it
    if (window.meetingUI && typeof window.meetingUI.updatePinButtonStates === 'function'){
        window.meetingUI.updatePinButtonStates();
    }
}


// Placeholder for handling remote tracks
function handleRemoteTrack(event, targetUserId) {
    console.log(`Remote track received from ${targetUserId}`, event.streams[0]);
    let videoElement = document.getElementById(`video-${targetUserId}`);
    let videoContainer = document.getElementById(`video-container-${targetUserId}`);

    if (!videoElement) {
        videoContainer = document.createElement('div');
        videoContainer.id = `video-container-${targetUserId}`;
        // Base classes, layout functions will add/remove specific ones
        videoContainer.className = 'video-container bg-black rounded-lg shadow-lg overflow-hidden relative flex items-center justify-center'; 
        
        videoElement = document.createElement('video');
        videoElement.id = `video-${targetUserId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'w-full h-full object-cover';
        
        const nameTag = document.createElement('p');
        nameTag.className = 'video-name-tag';
        nameTag.textContent = `User: ${targetUserId.substring(0, 6)}`;

        videoContainer.appendChild(videoElement);
        videoContainer.appendChild(nameTag);
        addVideoControlsOverlay(videoContainer, targetUserId, false); // Add controls for remote user
        videoGrid.appendChild(videoContainer);
    }
    videoElement.srcObject = event.streams[0];

    // Re-apply current layout after adding a new video
    if (window.meetingUI && typeof window.meetingUI.applyLayout === 'function' && typeof window.meetingUI.getCurrentLayout === 'function') {
        window.meetingUI.applyLayout(window.meetingUI.getCurrentLayout());
    }
}

// Placeholder for handling user leaving
function handleUserLeft(userId) {
    console.log(`User ${userId} left. Cleaning up.`);
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    const videoElementContainer = document.getElementById(`video-container-${userId}`);
    if (videoElementContainer) {
        videoElementContainer.remove();
        // Re-apply current layout after removing a video
        if (window.meetingUI && typeof window.meetingUI.applyLayout === 'function' && typeof window.meetingUI.getCurrentLayout === 'function') {
            window.meetingUI.applyLayout(window.meetingUI.getCurrentLayout());
        }
    }
    console.log(`Cleaned up resources for user ${userId}`);

    // If the user who left was spotlighted, clear the spotlight
    if (window.meetingUI && typeof window.meetingUI.getCurrentSpotlightId === 'function' && window.meetingUI.getCurrentSpotlightId() === userId) {
        if (typeof window.meetingUI.setSpotlightedUser === 'function') {
            window.meetingUI.setSpotlightedUser(null);
        }
    }
}

// Call initWebRTC when the script loads
initWebRTC();

// --- Media Control Functions ---
function toggleMic() {
    if (!localStream) return false;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        console.log(`Microphone ${isMuted ? 'muted' : 'unmuted'}`);
        
        // Emit mic status change
        if (window.socketClient && typeof window.socketClient.sendMicStatus === 'function') {
            window.socketClient.sendMicStatus(isMuted);
        }
        return isMuted; // Return true if muted, false if unmuted
    }
    return false; // Should ideally return current state or throw error if no track
}

function toggleCamera() {
    if (!localStream) return false;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log(`Camera ${videoTrack.enabled ? 'on' : 'off'}`);
        // Optional: Send camera status to others via socketClient.sendCameraStatus(videoTrack.enabled);
        return !videoTrack.enabled; // Return true if camera is off, false if on
    }
    return false;
}

let currentScreenShareStream = null;
let originalVideoTrack = null;

async function startScreenShare() {
    const screenShareBtn = document.getElementById('screenShareBtn'); // For UI updates

    if (currentScreenShareStream) { // Already sharing, so stop it
        await stopScreenShare(); // Ensure stopScreenShare is async if it involves async operations
        return;
    }

    try {
        currentScreenShareStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
        if (!localStream || localStream.getVideoTracks().length === 0) {
            console.warn("Local camera stream not available when starting screen share. Attempting to re-init.");
            // This case should ideally not happen if initWebRTC succeeded.
            // If it does, it implies localStream was stopped or never started.
            // We might not want to re-init here as it could be disruptive.
            // For now, we'll rely on originalVideoTrack being from a valid localStream.
            if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.showCriticalError === 'function') {
                window.meetingUI.showCriticalError("Cannot start screen share: Camera stream is not available.");
            } else {
                alert("Cannot start screen share: Camera stream is not available.");
            }
            currentScreenShareStream.getTracks().forEach(track => track.stop()); // Stop the obtained screen stream
            currentScreenShareStream = null;
            return false; // Indicate failure
        }
        
        originalVideoTrack = localStream.getVideoTracks()[0]; 
        if (!originalVideoTrack) {
             console.error("Original video track (camera) is missing. Cannot start screen share.");
             if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.showCriticalError === 'function') {
                window.meetingUI.showCriticalError("Camera track is missing. Cannot start screen share.");
            } else {
                alert("Camera track is missing. Cannot start screen share.");
            }
             currentScreenShareStream.getTracks().forEach(track => track.stop());
             currentScreenShareStream = null;
             return false; // Indicate failure
        }
        
        const screenTrack = currentScreenShareStream.getVideoTracks()[0];

        // Replace track for all peer connections
        for (const userId in peerConnections) {
            const pc = peerConnections[userId];
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender && screenTrack) { // Ensure screenTrack is valid
                await sender.replaceTrack(screenTrack);
                console.log(`Screen share track sent to ${userId}`);
            } else if (!screenTrack) {
                console.error("Screen track became invalid before sending to peers.");
            }
        }

        // Display screen share locally
        if (localVideo && currentScreenShareStream) { // Check currentScreenShareStream again
            localVideo.srcObject = currentScreenShareStream;
            localVideo.classList.add('screen-sharing-active'); 
            if(localVideo.classList.contains('object-cover')) localVideo.classList.replace('object-cover', 'object-contain');
        }
        
        // Update button via meetingUI
        if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.updateScreenShareButton === 'function') {
            window.meetingUI.updateScreenShareButton(true);
        }

        // Handle when the user stops sharing via the browser's native UI
        screenTrack.onended = () => {
            console.log('Screen share ended by browser UI.');
            // stopScreenShare is already designed to be callable and will update UI
            // Ensure it's async if it performs async operations
            stopScreenShare(); 
        };
        console.log('Screen sharing started.');
        return true; // Indicate success

    } catch (error) {
        console.error('Error starting screen share:', error);
        if (error.name === 'NotAllowedError') {
             if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.showCriticalError === 'function') {
                window.meetingUI.showCriticalError("Screen sharing permission denied. Please allow screen sharing in your browser.");
            } else {
                alert("Screen sharing permission denied.");
            }
        }
        // Clean up any obtained screen track if error occurred after getDisplayMedia
        if (currentScreenShareStream) {
            currentScreenShareStream.getTracks().forEach(track => track.stop());
        }
        currentScreenShareStream = null;
        originalVideoTrack = null; // Should be nullified if screen share fails
        // Update button via meetingUI
        if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.updateScreenShareButton === 'function') {
            window.meetingUI.updateScreenShareButton(false);
        }
        return false; // Indicate failure
    }
}

async function stopScreenShare() {
    if (!currentScreenShareStream && !originalVideoTrack) { // If neither exists, nothing to stop.
        console.log("Not currently screen sharing or original track missing to restore.");
        if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.updateScreenShareButton === 'function') {
            window.meetingUI.updateScreenShareButton(false); // Ensure button is in non-sharing state
        }
        if (localVideo) {
             localVideo.classList.remove('screen-sharing-active');
             if(localVideo.classList.contains('object-contain')) localVideo.classList.replace('object-contain', 'object-cover');
        }
        return;
    }
    
    // Stop the screen sharing track(s)
    if (currentScreenShareStream) {
        currentScreenShareStream.getTracks().forEach(track => track.stop());
        console.log("Screen share stream tracks stopped.");
        currentScreenShareStream = null;
    }

    // Restore original video track for all peer connections
    if (originalVideoTrack && localStream) { // Ensure localStream is still valid
        for (const userId in peerConnections) {
            const pc = peerConnections[userId];
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                try {
                    await sender.replaceTrack(originalVideoTrack);
                    console.log(`Camera track restored for ${userId}`);
                } catch (e) {
                    console.error(`Error replacing track back to camera for ${userId}:`, e);
                }
            }
        }
        // Restore local video display to camera stream
        if (localVideo) {
            localVideo.srcObject = localStream; // originalVideoTrack is part of localStream
            localVideo.classList.remove('screen-sharing-active');
            if(localVideo.classList.contains('object-contain')) localVideo.classList.replace('object-contain', 'object-cover');
            console.log("Local video restored to camera stream.");
        }
        originalVideoTrack = null; // Clear the stored original track
    } else {
        console.warn("Original video track or localStream was not available to restore. Local video may not show camera.");
        // If originalVideoTrack is somehow lost, but localStream exists, try to use its video track
        if (localStream && localStream.getVideoTracks().length > 0 && localVideo) {
            localVideo.srcObject = localStream;
            originalVideoTrack = null; // Still clear it as it was not the one we started with for screen share
            console.log("Fallback: Local video restored to available localStream video track.");
        } else if (localVideo) {
            localVideo.srcObject = null; // No stream to show
            console.log("No local stream available to restore video.");
        }
    }
    
    // Update button via meetingUI
    if (typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.updateScreenShareButton === 'function') {
        window.meetingUI.updateScreenShareButton(false);
    }
    console.log('Screen sharing stopped.');
}

function endCall() {
    console.log('Ending call and cleaning up resources...');
    // Close all peer connections
    for (const userId in peerConnections) {
        try {
            if (peerConnections[userId]) {
                peerConnections[userId].close();
                console.log(`Closed peer connection with ${userId}`);
            }
        } catch (e) {
            console.error(`Error closing peer connection with ${userId}:`, e);
        }
        delete peerConnections[userId]; // Remove from object
    }
    // At this point, peerConnections should be empty.

    // Stop local media tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            console.log(`Stopped local track: ${track.kind} - ID: ${track.id}`);
        });
        localStream = null;
    }
    if (currentScreenShareStream) { // Ensure screen share stream (if active) is also stopped
        currentScreenShareStream.getTracks().forEach(track => {
            track.stop();
            console.log(`Stopped screen share track: ${track.kind} - ID: ${track.id}`);
        });
        currentScreenShareStream = null;
    }
    originalVideoTrack = null; // Clear any stored original track

    // Clean up local video display
    if (localVideo) {
        localVideo.srcObject = null;
        console.log("Cleared local video display.");
    }

    // Disconnect Socket.IO
    // `socket` should be the global Socket.IO client instance from socket-client.js
    if (typeof socket !== 'undefined' && socket.connected) {
        socket.disconnect();
        console.log('Socket.IO client disconnected.');
    } else {
        console.log('Socket.IO client was not connected or not found.');
    }

    // Redirect to home page after a short delay to allow cleanup
    console.log('Redirecting to home page...');
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 100); // 100ms delay
}

// Make functions accessible to meeting-ui.js
window.webrtcFunctions = {
    toggleMic,
    toggleCamera,
    startScreenShare, // meeting-ui.js will call this
    // stopScreenShare is primarily called internally (by screenTrack.onended or startScreenShare for toggle)
    // but can be exposed if a manual stop button is ever added outside of the toggle.
    endCall,
    // No need to expose initWebRTC, createNewPeerConnection etc. directly to meeting-ui.js
    // as those are handled by socket-client.js logic.
};

// Ensure initWebRTC is called (it's at the end of the file)
// initWebRTC(); // This is already present at the end of the file in previous versions.
