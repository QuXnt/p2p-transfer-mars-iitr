import { io, type Socket } from 'socket.io-client';

// Use environment variable for production signaling server, fallback to localhost for development
const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:4000'; 
const CHUNK_SIZE = 8 * 1024; // 8KB for absolute maximum cross-browser SCTP compatibility

export type PeerConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface TransferProgress {
  progress: number;
  speed: number;
  fileName: string;
  fileSize: number;
}

export class WebRTCManager {
  private socket: Socket;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private roomId: string | null = null;
  private isInitiator = false;

  // Callbacks
  public onConnectionStateChange?: (state: PeerConnectionState) => void;
  public onProgress?: (progress: TransferProgress) => void;
  public onFileReceived?: (fileUrl: string, fileName: string) => void;
  public onError?: (error: string) => void;
  public onPeerDisconnected?: () => void;

  // Receiving state
  private receivedBuffers: ArrayBuffer[] = [];
  private receivedBytes = 0;
  private receivingFileMeta: { name: string; size: number; type: string } | null = null;
  
  // Speed calc
  private lastUpdateBytes = 0;
  private lastUpdateTime = 0;

  private pendingCandidates: any[] = [];
  private isSending = false;

  constructor() {
    this.socket = io(SIGNALING_SERVER_URL);

    this.socket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    this.socket.on('peer-joined', (peerId: string) => {
      console.log('Peer joined:', peerId);
      if (this.isInitiator) {
        this.initiateConnection();
      }
    });

    this.socket.on('signal', async (data: { signal: any; from: string }) => {
      await this.handleSignal(data.signal);
    });

    this.socket.on('room-full', () => {
      this.onError?.('Room is full.');
    });

    this.socket.on('room-not-found', () => {
      this.onError?.('Room not found.');
    });

    this.socket.on('peer-disconnected', () => {
      this.onPeerDisconnected?.();
      this.cleanupConnection();
    });
  }

  public createRoom(roomId: string) {
    this.isInitiator = true;
    this.roomId = roomId;
    this.socket.emit('create-room', roomId);
  }

  public joinRoom(roomId: string) {
    this.isInitiator = false;
    this.roomId = roomId;
    this.socket.emit('join-room', roomId);
  }

  private setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      // Send candidate (even if null to signal end of candidates)
      this.socket.emit('signal', { roomId: this.roomId, signal: { type: 'candidate', candidate: event.candidate } });
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState as PeerConnectionState;
      // Do not emit 'connected' here, let dataChannel.onopen handle it
      if (state && state !== 'connected') {
        this.onConnectionStateChange?.(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection?.iceConnectionState === 'failed') {
        this.onError?.('ICE Connection Failed. Firewall or NAT issue.');
        this.onConnectionStateChange?.('failed');
      } else if (this.peerConnection?.iceConnectionState === 'disconnected') {
        this.onConnectionStateChange?.('disconnected');
      }
    };

    if (this.isInitiator) {
      this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
      });
      this.setupDataChannel();
    } else {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = 64 * 1024; // 64KB
    
    const handleOpen = () => {
      console.log('Data channel opened');
      this.onConnectionStateChange?.('connected');
    };

    this.dataChannel.onopen = handleOpen;
    
    // Firefox often fires ondatachannel when the channel is already open
    if (this.dataChannel.readyState === 'open') {
      handleOpen();
    }

    this.dataChannel.onclose = () => {
      this.onConnectionStateChange?.('disconnected');
    };

    this.dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-meta') {
          this.receivingFileMeta = msg.meta;
          this.receivedBuffers = [];
          this.receivedBytes = 0;
          this.lastUpdateTime = performance.now();
          this.lastUpdateBytes = 0;
        } else if (msg.type === 'transfer-complete') {
          this.finishFileReceive();
        }
      } else if (event.data instanceof ArrayBuffer) {
        const received = new Uint8Array(event.data);
        const receivedHash = received.slice(0, 32);
        const chunk = received.slice(32);
        
        const calculatedHash = await crypto.subtle.digest('SHA-256', chunk);
        const calcHashArray = new Uint8Array(calculatedHash);
        
        let isValid = true;
        for (let i = 0; i < 32; i++) {
          if (receivedHash[i] !== calcHashArray[i]) {
            isValid = false;
            break;
          }
        }
        
        if (!isValid) {
          this.onError?.('Chunk verification failed! Data corruption detected.');
          return; // Drop corrupted chunk
        }

        this.receivedBuffers.push(chunk.buffer);
        this.receivedBytes += chunk.byteLength;
        this.updateProgress(this.receivedBytes);
      }
    };
  }

  private async initiateConnection() {
    this.setupPeerConnection();
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('signal', { roomId: this.roomId, signal: offer });
    } catch (e) {
      console.error(e);
    }
  }

  private async handleSignal(signal: any) {
    if (!this.peerConnection) {
      this.setupPeerConnection();
    }

    try {
      if (signal.type === 'offer') {
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(signal));
        
        for (const candidate of this.pendingCandidates) {
          try {
             await this.peerConnection?.addIceCandidate(candidate ? new RTCIceCandidate(candidate) : null);
          } catch (e) {}
        }
        this.pendingCandidates = [];

        const answer = await this.peerConnection?.createAnswer();
        await this.peerConnection?.setLocalDescription(answer);
        this.socket.emit('signal', { roomId: this.roomId, signal: answer });
      } else if (signal.type === 'answer') {
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(signal));
        
        for (const candidate of this.pendingCandidates) {
          try {
             await this.peerConnection?.addIceCandidate(candidate ? new RTCIceCandidate(candidate) : null);
          } catch (e) {}
        }
        this.pendingCandidates = [];
      } else if (signal.type === 'candidate') {
        if (this.peerConnection?.remoteDescription) {
          try {
             await this.peerConnection?.addIceCandidate(signal.candidate ? new RTCIceCandidate(signal.candidate) : null);
          } catch (e) {}
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  public async sendFile(file: File) {
    if (this.isSending) return;
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.onError?.('Data channel not open');
      return;
    }

    this.isSending = true;
    const meta = { name: file.name, size: file.size, type: file.type };
    this.dataChannel.send(JSON.stringify({ type: 'file-meta', meta }));

    this.lastUpdateTime = performance.now();
    this.lastUpdateBytes = 0;

    let offset = 0;

    const readSlice = (o: number): Promise<ArrayBuffer> => {
      return new Promise((resolve, reject) => {
        const slice = file.slice(offset, o + CHUNK_SIZE);
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(slice);
      });
    };

    const sendChunks = async () => {
      while (offset < file.size) {
        if (this.dataChannel!.bufferedAmount > 256 * 1024) { // 256KB max buffer to prevent Firefox crash
          await new Promise(resolve => {
            if (this.dataChannel) {
              this.dataChannel.onbufferedamountlow = () => {
                this.dataChannel!.onbufferedamountlow = null;
                resolve(null);
              };
            }
          });
        }

        const chunk = await readSlice(offset);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', chunk);
        
        const combined = new Uint8Array(hashBuffer.byteLength + chunk.byteLength);
        combined.set(new Uint8Array(hashBuffer), 0);
        combined.set(new Uint8Array(chunk), hashBuffer.byteLength);
        
        try {
          this.dataChannel!.send(combined.buffer);
        } catch (e) {
          console.error('DataChannel send failed', e);
          this.onError?.('Transfer interrupted. Channel closed.');
          this.isSending = false;
          return;
        }
        offset += chunk.byteLength;
        this.updateProgress(offset, file.size, file.name);
      }
      
      try {
        this.dataChannel!.send(JSON.stringify({ type: 'transfer-complete' }));
      } catch (e) {
         console.error('Transfer complete signal failed', e);
      }
      this.isSending = false;
    };

    sendChunks();
  }

  private updateProgress(currentBytes: number, totalSize?: number, name?: string) {
    const size = totalSize || this.receivingFileMeta?.size || 0;
    const fileName = name || this.receivingFileMeta?.name || 'Unknown';
    
    const now = performance.now();
    const timeDiff = (now - this.lastUpdateTime) / 1000;
    
    let speed = 0; // MB/s
    if (timeDiff > 0.5) {
      speed = ((currentBytes - this.lastUpdateBytes) / 1024 / 1024) / timeDiff;
      this.lastUpdateTime = now;
      this.lastUpdateBytes = currentBytes;
    }

    this.onProgress?.({
      progress: size ? (currentBytes / size) * 100 : 0,
      speed,
      fileName,
      fileSize: size,
    });
  }

  private finishFileReceive() {
    if (!this.receivingFileMeta) return;
    
    const blob = new Blob(this.receivedBuffers, { type: this.receivingFileMeta.type });
    const url = URL.createObjectURL(blob);
    this.onFileReceived?.(url, this.receivingFileMeta.name);
    
    this.receivedBuffers = [];
    this.receivingFileMeta = null;
  }

  public cleanupConnection() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.roomId = null;
    this.isInitiator = false;
  }

  public disconnect() {
    this.cleanupConnection();
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
