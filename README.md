# P2P Web Share

A modern, fast, and secure peer-to-peer file sharing application built with React, WebRTC, and Socket.io. It allows users to instantly transfer files directly between browsers across different networks without storing any data on an intermediate server.

## Core MVP Requirements Met
- **Share Room Creation:** Native HTML5 drag-and-drop zone to upload files (with strict <50MB browser memory limit enforcement) and unique Room ID generation.
- **Signaling Handshake:** Lightweight Node.js & Socket.io backend to coordinate WebRTC offers and answers.
- **Direct P2P Transfer:** Uses the browser FileReader API and transfers data directly via WebRTC data channels.
- **Basic Chunk Verification:** Implements SHA-256 cryptographic hashing on every file chunk before and after transfer to guarantee zero data corruption.
- **Progress Indicators & Connection Status:** Real-time UI displaying transfer percentage, transfer speed (MB/s), and active connection states.
- **Graceful Disconnect Handling:** Robust state management ensures no crashes if a tab is closed, gracefully notifying the remaining user.
- **Auto-Download:** Reassembles incoming verified chunks in memory and automatically triggers a local download.
- **Cross-Browser Reliability:** Implements strict SCTP message fragmentation limits (8KB chunks) and utilizes free OpenRelay TURN servers to bypass restrictive NATs and guarantee connectivity between browsers like Firefox and Chrome.

## Technologies Used
- **Frontend:** React 18, Vite, TailwindCSS, shadcn/ui, WebRTC API
- **Backend (Signaling):** Node.js, Express, Socket.io
- **Networking:** STUN and TURN protocols (for NAT traversal)

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd p2p-web-share
```

### 2. Start the Backend Signaling Server
The signaling server establishes the initial peer-to-peer handshake via WebSockets.
```bash
cd server
npm install
npm run dev
```
The server will start on `http://localhost:4000`.

### 3. Start the Frontend Application
In a new terminal window, start the React application:
```bash
cd client
npm install
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## Deployment

The application is structured to be easily deployed to modern cloud hosting providers.

### Backend (Render / Railway)
1. Push the repository to GitHub.
2. Create a new Web Service on Render or Railway, pointing to the `server` directory.
3. The platform will automatically install dependencies and start the Node.js server.
4. Copy the deployed backend URL (e.g., `https://my-p2p-server.onrender.com`).

### Frontend (Vercel / Netlify)
1. Create a new project on Vercel or Netlify, pointing to the `client` directory.
2. In the deployment settings, add an Environment Variable:
   - Key: `VITE_SIGNALING_SERVER_URL`
   - Value: `<YOUR_DEPLOYED_BACKEND_URL>`
3. Deploy the application.

### Live Deployment Links
- **Frontend App:** https://p2p-transfer-mars-iitr.vercel.app/
- **Backend API:** https://p2p-transfer-mars-iitr.onrender.com

## Demonstration
Check out the video demonstration of the app transferring a file between two different browser windows:
https://drive.google.com/file/d/1TvWiolSh7KxwuPw-W7EUipTEptMjzu7K/view?usp=sharing
