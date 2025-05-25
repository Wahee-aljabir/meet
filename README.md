# Real-Time Video Conferencing Web Application

## Description
This is a real-time video conferencing web application that allows users to create and join meetings, share video, audio, and their screen, and communicate via chat. It is built from scratch using Node.js for the backend and plain HTML, Tailwind CSS, and Vanilla JavaScript for the frontend.

## Features
*   **Meeting Creation:** Generate unique, shareable alphanumeric meeting codes.
*   **Join Meeting:** Join existing meetings using a valid code.
*   **Real-time Video/Audio:** High-quality video and audio streaming using WebRTC.
*   **Microphone Control:** Mute and unmute your microphone.
*   **Camera Control:** Turn your camera on and off.
*   **Screen Sharing:** Share your entire screen or specific application windows with other participants.
*   **Live Chat:** Send and receive text messages in real-time during the meeting.
*   **Raise Hand:** Notify other participants that you wish to speak.
*   **Participant Indicators:** Basic visual cues for user actions (e.g., hand raised).
*   **Responsive Design:** The user interface is designed to adapt to different screen sizes for usability on desktops, tablets, and mobile devices.
*   **User-Friendly Error Handling:** Clear messages for common issues like invalid meeting codes or media permission denials.
*   **Toolbar Controls:** Easy access to all essential meeting functions via a bottom toolbar.

## Technologies Used
*   **Backend:**
    *   Node.js
    *   Express.js
    *   Socket.IO (for WebRTC signaling and real-time messaging)
*   **Frontend:**
    *   HTML5
    *   Tailwind CSS (via CDN)
    *   Vanilla JavaScript (ES6+)
    *   WebRTC (for peer-to-peer media streaming)
*   **Signaling:** WebSockets (managed by Socket.IO)

## Prerequisites
*   Node.js (v14.x or later recommended) and npm (Node Package Manager). You can download them from [https://nodejs.org/](https://nodejs.org/).
*   A modern web browser that supports WebRTC (e.g., Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
*   Working camera and microphone for full participation.

## Setup and Installation
1.  **Clone the repository (or download the source code):**
    ```bash
    git clone <repository_url>
    ```
    (Replace `<repository_url>` with the actual URL if applicable, otherwise download and extract the files.)

2.  **Navigate to the project directory:**
    ```bash
    cd video-conference-app 
    ```
    (Or the name of the directory where the files are located.)

3.  **Install dependencies:**
    This command will install all the necessary backend packages defined in `package.json`.
    ```bash
    npm install
    ```

## Running the Application
1.  **Start the server:**
    This command will start the Node.js server.
    ```bash
    npm start
    ```
2.  By default, the application will be accessible at `http://localhost:3000`. You will see output in your console indicating that the server is running:
    ```
    Server is running on port 3000
    ```
3.  Open your web browser and navigate to `http://localhost:3000`.

## How to Use

### Creating a Meeting
1.  On the landing page, click the "Create Meeting" button.
2.  A unique meeting code will be generated and displayed (e.g., `W7X9JK`).
3.  A "Copy Code" button will appear, allowing you to easily copy the code to your clipboard.
4.  Share this code with anyone you want to invite to the meeting.
5.  Click the "Start Meeting" button to enter the meeting room.

### Joining a Meeting
1.  On the landing page, click the "Join Meeting" button.
2.  A prompt will appear asking you to enter a meeting code.
3.  Enter the valid meeting code you received and click "OK" or press Enter.
4.  If the code is valid, you will be taken to the meeting room. If not, an error message will be displayed.

### Meeting Room Controls
Once in the meeting room, you will have access to the following controls, typically located in a toolbar at the bottom of the screen:
*   **Mute/Unmute Mic:** Toggle your microphone.
*   **Show/Hide Camera:** Toggle your camera.
*   **Share Screen/Stop Sharing:** Start or stop sharing your screen.
*   **Chat:** Toggle the chat panel to send and receive messages.
*   **Raise/Lower Hand:** Signal that you want to speak or lower your hand.
*   **Participants:** Toggle the participants list (currently a placeholder panel).
*   **More:** Access additional (placeholder) features like Background Blur, Noise Suppression, and Auto-Mute.
*   **End Call:** Leave the meeting and return to the landing page.

## Known Issues
*   The participant list is a placeholder and does not dynamically list participants yet.
*   Advanced features (Background Blur, Noise Suppression, Auto-Mute on Join) are placeholders and not functionally implemented.
*   Screen sharing UI might vary slightly based on browser implementation.
*   No persistent storage; meetings are lost when the server restarts.

## Future Enhancements
*   Fully functional participant list with status indicators (mic, camera, speaking).
*   Implementation of advanced features like background blur and noise suppression.
*   User authentication and named users.
*   Persistent meeting rooms or scheduled meetings.
*   Recording functionality.
*   Improved UI/UX for mobile devices.
*   Direct messaging between participants.
```
