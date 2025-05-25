// Connect to Socket.IO server (REMOVED - No longer used on this page)
// const socket = io();

// UI Elements
const initialActions = document.getElementById('initialActions');
const createMeetingBtn = document.getElementById('createMeetingBtn');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');

const createMeetingSection = document.getElementById('createMeetingSection');
const meetingCodeText = document.getElementById('meetingCodeText');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const startMeetingBtn = document.getElementById('startMeetingBtn');
const backToHomeFromCreateBtn = document.getElementById('backToHomeFromCreateBtn');

const joinMeetingSection = document.getElementById('joinMeetingSection');
const meetingCodeInput = document.getElementById('meetingCodeInput');
const proceedJoinBtn = document.getElementById('proceedJoinBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');

const errorMessageDiv = document.getElementById('errorMessage');
const errorMessageText = document.getElementById('errorMessageText');

let currentMeetingCode = null;

// --- Utility Functions ---
function showErrorMessage(message, section = 'global') {
    // For now, all errors go to the global error message div.
    // This could be enhanced to show errors within specific modals/sections.
    if (errorMessageText && errorMessageDiv) {
        errorMessageText.textContent = message;
        errorMessageDiv.classList.remove('hidden');
    } else {
        alert(message); // Fallback
    }
}

function hideErrorMessage() {
    if (errorMessageDiv) {
        errorMessageDiv.classList.add('hidden');
    }
}

function showSection(sectionElement) {
    hideErrorMessage();
    initialActions.classList.add('hidden');
    createMeetingSection.classList.add('hidden');
    joinMeetingSection.classList.add('hidden');
    
    if (sectionElement) {
        sectionElement.classList.remove('hidden');
        // Add focus to the first interactive element if applicable
        const firstInput = sectionElement.querySelector('input, button');
        if (firstInput) firstInput.focus();
    }
}

function showInitialActions() {
    showSection(initialActions);
}

// --- Event Listeners ---

// Create Meeting Button
createMeetingBtn.addEventListener('click', () => {
    hideErrorMessage();
    createMeetingBtn.disabled = true;
    createMeetingBtn.textContent = 'Creating...';

    fetch('/api/create-meeting', { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                // Try to parse error from backend if available
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => { // Fallback if response is not JSON
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.meetingCode) {
                currentMeetingCode = data.meetingCode;
                meetingCodeText.textContent = currentMeetingCode;
                showSection(createMeetingSection);
            } else {
                showErrorMessage(data.error || 'Could not create meeting. Please try again.');
                showInitialActions(); // Show initial buttons again on error
            }
        })
        .catch(error => {
            console.error('Error creating meeting:', error);
            showErrorMessage(error.message || 'Error creating meeting. Please try again.');
            showInitialActions(); // Show initial buttons again on error
        })
        .finally(() => {
            createMeetingBtn.disabled = false;
            createMeetingBtn.textContent = 'Create New Meeting';
        });
});

// Start Meeting Button (in Create Meeting Success Section)
startMeetingBtn.addEventListener('click', () => {
    if (currentMeetingCode) {
        window.location.href = `meeting.html?room=${encodeURIComponent(currentMeetingCode)}`;
    }
});

// Copy Code Button
copyCodeBtn.addEventListener('click', () => {
    if (currentMeetingCode) {
        navigator.clipboard.writeText(currentMeetingCode)
            .then(() => {
                copyCodeBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyCodeBtn.textContent = 'Copy Code';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy meeting code: ', err);
                showErrorMessage("Failed to copy code. Please try manually.");
            });
    }
});

// Back to Home from Create Meeting Section
backToHomeFromCreateBtn.addEventListener('click', () => {
    showInitialActions();
});


// Join Meeting Button (initial)
joinMeetingBtn.addEventListener('click', () => {
    meetingCodeInput.value = ''; // Clear previous input
    showSection(joinMeetingSection);
});

// Cancel Join Button (in Join Meeting Section)
cancelJoinBtn.addEventListener('click', () => {
    showInitialActions();
});

// Proceed Join Button (in Join Meeting Section)
proceedJoinBtn.addEventListener('click', () => {
    hideErrorMessage();
    const enteredCode = meetingCodeInput.value.trim();

    // Client-side validation
    if (!enteredCode) {
        showErrorMessage("Meeting code cannot be empty.", 'join');
        meetingCodeInput.focus();
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(enteredCode)) {
        showErrorMessage("Meeting code must be alphanumeric (letters and numbers only).", 'join');
        meetingCodeInput.focus();
        return;
    }
    if (enteredCode.length < 5 || enteredCode.length > 10) {
        showErrorMessage("Meeting code must be between 5 and 10 characters long.", 'join');
        meetingCodeInput.focus();
        return;
    }

    proceedJoinBtn.disabled = true;
    proceedJoinBtn.textContent = 'Validating...';

    fetch(`/api/validate-code?code=${encodeURIComponent(enteredCode)}`)
        .then(response => {
            if (!response.ok) {
                 return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => {
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.isValid) {
                window.location.href = `meeting.html?room=${encodeURIComponent(enteredCode)}`;
            } else {
                showErrorMessage(`Invalid meeting code: "${enteredCode}". Please check and try again.`, 'join');
                meetingCodeInput.focus();
            }
        })
        .catch(error => {
            console.error('Error validating meeting code:', error);
            showErrorMessage(error.message || 'Error validating meeting code. Please try again.', 'join');
            meetingCodeInput.focus();
        })
        .finally(() => {
            proceedJoinBtn.disabled = false;
            proceedJoinBtn.textContent = 'Join Now';
        });
});

// Initialize by showing the initial action buttons
document.addEventListener('DOMContentLoaded', () => {
    showInitialActions();
});
