# P2P Web Share

A modern, fast, and secure peer-to-peer file sharing application built with React, WebRTC, and Socket.io. It allows users to instantly transfer files directly between browsers across different networks without storing any data on an intermediate server.

## Features
- **True P2P File Transfer:** Files are streamed directly between clients via WebRTC Data Channels. No files are saved to the server.
- **Cross-Browser Compatible:** Extensive fallback mechanisms (including TURN servers and strict SCTP message fragmentation) ensure seamless transfers between Chromium browsers (Chrome, Edge) and Firefox.
- **Instant Auto-Send Flow:** Senders simply upload a file, share the generated link, and the file instantly begins streaming the moment the receiver connects. 
- **Modern UI:** Clean, responsive, and minimalist user interface built with TailwindCSS and shadcn/ui.

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
- **Frontend App:** [Insert your deployed frontend URL here]
- **Backend API:** [Insert your deployed backend URL here]

## Demonstration
Check out the video demonstration of the app transferring a file between two devices:
[Insert Demo Video Link Here]
