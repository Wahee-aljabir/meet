document.addEventListener('DOMContentLoaded', () => {
    // Control Toolbar Buttons
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    const toggleCameraBtn = document.getElementById('toggleCameraBtn');
    const screenShareBtn = document.getElementById('screenShareBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const toggleChatBtn = document.getElementById('toggleChatBtn');
    const closeChatBtn = document.getElementById('closeChatBtn'); // New
    const toggleParticipantsBtn = document.getElementById('toggleParticipantsBtn');
    const closeParticipantsBtn = document.getElementById('closeParticipantsBtn'); // New
    const raiseHandBtn = document.getElementById('raiseHandBtn');
    const toggleAdvancedFeaturesBtn = document.getElementById('toggleAdvancedFeaturesBtn'); // New

    // Panels
    const chatPanel = document.getElementById('chatPanel');
    const participantsPanel = document.getElementById('participantsPanel');
    const advancedFeaturesPanel = document.getElementById('advancedFeaturesPanel'); // New

    // Chat Elements
    const chatMessages = document.getElementById('chatMessages'); // Remains the same ID
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    // Participants Elements
    const participantsList = document.getElementById('participantsList');

    // Advanced Feature Buttons
    const backgroundBlurBtn = document.getElementById('backgroundBlurBtn');
    const noiseSuppressionBtn = document.getElementById('noiseSuppressionBtn');
    const autoMuteBtn = document.getElementById('autoMuteOnJoinBtn');

    // Critical Error Display
    const criticalErrorDisplay = document.getElementById('criticalErrorDisplay');
    const criticalErrorText = document.getElementById('criticalErrorText');
    const reloadPageBtn = document.getElementById('reloadPageBtn');


    // State variables
    let isChatPanelVisible = false; // Updated name for clarity
    let isParticipantsPanelVisible = false; // Updated name for clarity
    let isAdvancedFeaturesPanelVisible = false; // New
    let isMicMuted = false; // Tracks actual state from webrtc.js
    let isCameraOff = false; // Tracks actual state from webrtc.js
    let isScreenSharing = false; // Tracks actual state from webrtc.js
    let isHandRaised = false;

    // --- Utility to show critical errors ---
    function showCriticalError(message) {
        if (criticalErrorText) criticalErrorText.textContent = message;
        if (criticalErrorDisplay) criticalErrorDisplay.classList.remove('hidden');
        // Hide panels if they are open, to make error visible
        if (isChatPanelVisible && chatPanel) {
            chatPanel.classList.add(chatPanel.classList.contains('md:translate-x-0') ? 'translate-x-full' : '-translate-y-full'); // adapt based on actual hidden class
            chatPanel.classList.remove('translate-x-0', 'translate-y-0');
            isChatPanelVisible = false;
        }
        if (isParticipantsPanelVisible && participantsPanel) {
            participantsPanel.classList.add('-translate-x-full');
            participantsPanel.classList.remove('translate-x-0');
            isParticipantsPanelVisible = false;
        }
    }

    if (reloadPageBtn) {
        reloadPageBtn.addEventListener('click', () => window.location.reload());
    }

    // --- Panel Toggles ---
    // Chat Panel Toggle
    if (toggleChatBtn && chatPanel) {
        toggleChatBtn.addEventListener('click', () => {
            isChatPanelVisible = !isChatPanelVisible;
            if (isChatPanelVisible) {
                // Show chat panel (slide in from right on small, or from bottom if that's the new design)
                chatPanel.classList.remove('translate-x-full', '-translate-y-full', 'md:translate-x-0');
                chatPanel.classList.add('translate-x-0', 'translate-y-0'); // Ensure it's visible
            } else {
                // Hide chat panel
                chatPanel.classList.add(chatPanel.classList.contains('md:w-80') ? 'translate-x-full' : '-translate-y-full');
                chatPanel.classList.remove('translate-x-0', 'translate-y-0');
            }
             // On md+ screens, the panel might be controlled by different classes if it's always 'visible' but overlaying content
            if (window.innerWidth >= 768) { // md breakpoint
                chatPanel.classList.toggle('md:translate-x-0'); // if it slides from right
                chatPanel.classList.toggle('md:hidden'); // Or simply hide/show if it's not a slide
            }
        });
    }
    if (closeChatBtn && chatPanel) { 
        closeChatBtn.addEventListener('click', () => {
            isChatPanelVisible = false;
            chatPanel.classList.add(chatPanel.classList.contains('md:w-80') ? 'translate-x-full' : '-translate-y-full');
            chatPanel.classList.remove('translate-x-0', 'translate-y-0');
             if (window.innerWidth >= 768) { // md breakpoint
                chatPanel.classList.add('md:hidden'); 
                chatPanel.classList.remove('md:translate-x-0');
            }
        });
    }

    // Participants Panel Toggle
    if (toggleParticipantsBtn && participantsPanel) {
        toggleParticipantsBtn.addEventListener('click', () => {
            isParticipantsPanelVisible = !isParticipantsPanelVisible;
            if (isParticipantsPanelVisible) {
                participantsPanel.classList.remove('-translate-x-full');
                participantsPanel.classList.add('translate-x-0');
            } else {
                participantsPanel.classList.remove('translate-x-0');
                participantsPanel.classList.add('-translate-x-full');
            }
        });
    }
    if (closeParticipantsBtn && participantsPanel) { 
        closeParticipantsBtn.addEventListener('click', () => {
            isParticipantsPanelVisible = false;
            participantsPanel.classList.remove('translate-x-0');
            participantsPanel.classList.add('-translate-x-full');
        });
    }

    // Advanced Features Panel Toggle
    if (toggleAdvancedFeaturesBtn && advancedFeaturesPanel) {
        toggleAdvancedFeaturesBtn.addEventListener('click', () => {
            isAdvancedFeaturesPanelVisible = !isAdvancedFeaturesPanelVisible;
            advancedFeaturesPanel.classList.toggle('hidden', !isAdvancedFeaturesPanelVisible);
        });
    }
    
    // --- Advanced Feature Buttons (Placeholders) ---
    if (backgroundBlurBtn) {
        backgroundBlurBtn.addEventListener('click', () => {
            console.log("Background blur toggled");
            // Example: backgroundBlurBtn.classList.toggle('active-feature');
        });
    }

    if (noiseSuppressionBtn) {
        noiseSuppressionBtn.addEventListener('click', () => {
            console.log("Noise suppression toggled");
        });
    }

    if (autoMuteBtn) {
        autoMuteBtn.addEventListener('click', () => {
            console.log("Auto-mute on join toggled");
        });
    }


    // --- Media Controls & Other Features ---
    if (toggleMicBtn) {
        toggleMicBtn.addEventListener('click', () => {
            if (typeof window.webrtcFunctions !== 'undefined' && typeof window.webrtcFunctions.toggleMic === 'function') {
                isMicMuted = window.webrtcFunctions.toggleMic(); 
                toggleMicBtn.innerHTML = isMicMuted ? 
                    '<i class="fas fa-microphone-slash"></i> <span class="hidden sm:inline">Unmute</span>' : 
                    '<i class="fas fa-microphone"></i> <span class="hidden sm:inline">Mute</span>';
                toggleMicBtn.classList.toggle('bg-red-500', isMicMuted);
                toggleMicBtn.classList.toggle('hover:bg-red-600', isMicMuted);
                toggleMicBtn.classList.toggle('bg-gray-700', !isMicMuted); // Default style
                toggleMicBtn.classList.toggle('hover:bg-gray-600', !isMicMuted);
            } else {
                console.error('toggleMic function not found.');
                showCriticalError('Microphone control is unavailable.');
            }
        });
    }

    if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', () => {
            if (typeof window.webrtcFunctions !== 'undefined' && typeof window.webrtcFunctions.toggleCamera === 'function') {
                isCameraOff = window.webrtcFunctions.toggleCamera();
                toggleCameraBtn.innerHTML = isCameraOff ? 
                    '<i class="fas fa-video-slash"></i> <span class="hidden sm:inline">Show Cam</span>' : 
                    '<i class="fas fa-video"></i> <span class="hidden sm:inline">Hide Cam</span>';
                toggleCameraBtn.classList.toggle('bg-red-500', isCameraOff);
                toggleCameraBtn.classList.toggle('hover:bg-red-600', isCameraOff);
                toggleCameraBtn.classList.toggle('bg-gray-700', !isCameraOff);
                toggleCameraBtn.classList.toggle('hover:bg-gray-600', !isCameraOff);
            } else {
                console.error('toggleCamera function not found.');
                showCriticalError('Camera control is unavailable.');
            }
        });
    }

    if (screenShareBtn) {
        screenShareBtn.addEventListener('click', () => {
            if (typeof window.webrtcFunctions !== 'undefined' && typeof window.webrtcFunctions.startScreenShare === 'function') {
                window.webrtcFunctions.startScreenShare().then(sharingState => {
                    // Assuming startScreenShare now correctly returns a boolean promise or is synchronous
                    // and that updateScreenShareButton is globally available or part of meetingUI
                    if(typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.updateScreenShareButton === 'function') {
                        window.meetingUI.updateScreenShareButton(sharingState);
                    } else {
                         // Fallback if direct call from webrtc.js to meetingUI.updateScreenShareButton is preferred
                        console.log("Screen share state:", sharingState);
                    }
                }).catch(err => {
                     console.error("Error during screen share operation:", err);
                     if(typeof window.meetingUI !== 'undefined' && typeof window.meetingUI.updateScreenShareButton === 'function') {
                        window.meetingUI.updateScreenShareButton(false); // Reset button on error
                     }
                });
            } else {
                console.error('startScreenShare function not found.');
                showCriticalError('Screen sharing is unavailable.');
            }
        });
    }
        
    if (endCallBtn) {
        endCallBtn.addEventListener('click', () => {
            if (typeof window.webrtcFunctions !== 'undefined' && typeof window.webrtcFunctions.endCall === 'function') {
                window.webrtcFunctions.endCall();
            } else {
                console.error('endCall function not found. Attempting fallback redirect.');
                window.location.href = '/index.html'; // Fallback
            }
        });
    }

    if (raiseHandBtn) {
        raiseHandBtn.addEventListener('click', () => {
            if (typeof toggleRaiseHand === 'function') {  // This is the function defined below
                isHandRaised = !isHandRaised; 
                toggleRaiseHand(isHandRaised); 
                raiseHandBtn.innerHTML = isHandRaised ? 
                    '<i class="fas fa-hand-rock"></i> <span class="hidden sm:inline">Lower Hand</span>' : 
                    '<i class="fas fa-hand-paper"></i> <span class="hidden sm:inline">Raise Hand</span>';
                raiseHandBtn.classList.toggle('bg-yellow-500', isHandRaised);
                raiseHandBtn.classList.toggle('hover:bg-yellow-600', isHandRaised);
                raiseHandBtn.classList.toggle('text-gray-800', isHandRaised); // Darker text for yellow bg
                raiseHandBtn.classList.toggle('bg-gray-700', !isHandRaised);
                raiseHandBtn.classList.toggle('hover:bg-gray-600', !isHandRaised);
                raiseHandBtn.classList.toggle('text-white', !isHandRaised);
            } else {
                console.error('toggleRaiseHand function (for UI) not found.');
            }
        });
    }

    // --- Chat Functionality ---
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', () => {
            const message = chatInput.value.trim();
            if (message) {
                sendChatMessage(message); // This will be defined to call socketClient.sendChatMessage
                chatInput.value = '';
            }
        });

        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                sendChatBtn.click();
            }
        });
    }
});

// --- Global functions for UI interaction called by event listeners ---

function sendChatMessage(message) {
    if (typeof socketClient !== 'undefined' && socketClient.sendChatMessage) {
        // Assuming socketClient is exposed from socket-client.js
        // userName could be prompted or stored, using localUserId for simplicity now
        socketClient.sendChatMessage(message, socketClient.getLocalUserId ? socketClient.getLocalUserId() : 'User');
        // Display local message immediately
        displayChatMessage(message, 'You', socketClient.getLocalUserId ? socketClient.getLocalUserId() : 'local', true);
    } else {
        console.error('socketClient.sendChatMessage is not available.');
    }
}

function toggleRaiseHand(isRaised) {
    if (typeof socketClient !== 'undefined' && socketClient.sendRaiseHand) {
        socketClient.sendRaiseHand(isRaised);
    } else {
        console.error('socketClient.sendRaiseHand is not available.');
    }
}


// Function to display incoming chat messages (called by socket-client.js or directly)
function displayChatMessage(message, userName, senderId, isLocal = false) {
    const chatMessagesDiv = document.getElementById('chatMessages'); // Renamed for clarity
    if (!chatMessagesDiv) return;

    const messageElement = document.createElement('div');
    // Tailwind classes for individual messages:
    messageElement.classList.add('p-2', 'rounded-lg', 'max-w-xs', 'break-words', 'text-sm', 'leading-tight'); 
    
    let senderPrefix = '';
    if (isLocal) {
        // Local user's messages: blue background, white text, aligned to the right
        messageElement.classList.add('bg-blue-600', 'text-white', 'self-end', 'text-right', 'ml-auto');
        // senderPrefix = 'You: '; // Optional: if you want to explicitly state "You"
    } else {
        // Remote users' messages: gray background, lighter text, aligned to the left
        messageElement.classList.add('bg-gray-600', 'text-gray-200', 'self-start', 'text-left', 'mr-auto');
        senderPrefix = `<strong class="font-semibold text-gray-300">${userName || (senderId ? senderId.substring(0,6) : 'User')}:</strong> `;
    }
    
    messageElement.innerHTML = senderPrefix + message; // Use innerHTML for senderPrefix strong tag
    chatMessagesDiv.appendChild(messageElement);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
}

// Function to update UI for raised hand (called by socket-client.js or directly)
function updateUserHandStatus(userId, isRaised) {
    console.log(`User ${userId} ${isRaised ? 'raised' : 'lowered'} hand.`);
    const userVideoContainer = document.getElementById(`video-container-${userId}`); // video-container- is defined in webrtc.js
    let handIndicator = document.getElementById(`hand-indicator-${userId}`);

    if (isRaised) {
        if (userVideoContainer && !handIndicator) {
            handIndicator = document.createElement('div'); 
            handIndicator.id = `hand-indicator-${userId}`;
            handIndicator.innerHTML = '<i class="fas fa-hand-paper text-yellow-400 text-2xl"></i>';
            // Style the indicator (Tailwind):
            handIndicator.className = 'absolute top-2 right-2 bg-gray-900 bg-opacity-75 p-2 rounded-full shadow-lg z-10';
            userVideoContainer.appendChild(handIndicator);
        }
    } else {
        if (handIndicator) {
            handIndicator.remove();
        }
    }
}

// Expose functions that need to be called from other scripts (like socket-client.js or webrtc.js)
window.meetingUI = {
    displayChatMessage,
    updateUserHandStatus,
    showCriticalError, // Expose to webrtc.js for media errors
    updateScreenShareButton: (isSharing) => { // Make sure this is defined in the global scope or on meetingUI
        isScreenSharing = isSharing;
        if (screenShareBtn) {
            screenShareBtn.innerHTML = isSharing ?
                '<i class="fas fa-stop-circle"></i> <span class="hidden sm:inline">Stop Share</span>' :
                '<i class="fas fa-desktop"></i> <span class="hidden sm:inline">Share</span>';
            screenShareBtn.classList.toggle('bg-green-500', isSharing);
            screenShareBtn.classList.toggle('hover:bg-green-600', isSharing);
            screenShareBtn.classList.toggle('text-white', isSharing);
            screenShareBtn.classList.toggle('bg-gray-700', !isSharing);
            screenShareBtn.classList.toggle('hover:bg-gray-600', !isSharing);
        }
    }
};

// Initial button states with icons
if (toggleMicBtn) toggleMicBtn.innerHTML = '<i class="fas fa-microphone"></i> <span class="hidden sm:inline">Mute</span>';
if (toggleCameraBtn) toggleCameraBtn.innerHTML = '<i class="fas fa-video"></i> <span class="hidden sm:inline">Hide Cam</span>';
if (screenShareBtn) screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i> <span class="hidden sm:inline">Share</span>';
if (raiseHandBtn) raiseHandBtn.innerHTML = '<i class="fas fa-hand-paper"></i> <span class="hidden sm:inline">Raise Hand</span>';
if (toggleChatBtn && window.innerWidth < 768) toggleChatBtn.classList.remove('md:hidden'); // Ensure chat toggle is visible on small screens
// Participants button is always visible based on HTML
// End call button is always visible
// More button is always visible
