import { useEffect, useState, useRef } from 'react'
import { WebRTCManager } from './lib/webrtc'
import type { PeerConnectionState, TransferProgress } from './lib/webrtc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Progress } from './components/ui/progress'
import { useToast } from './hooks/use-toast'
import { Copy, UploadCloud, DownloadCloud, File, CheckCircle2 } from 'lucide-react'

function App() {
  const [roomId, setRoomId] = useState<string>('')
  const [isReceiver, setIsReceiver] = useState(false)
  const [connectionState, setConnectionState] = useState<PeerConnectionState>('disconnected')
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [fileToTransfer, setFileToTransfer] = useState<File | null>(null)
  
  const webrtcManager = useRef<WebRTCManager | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Initialize WebRTC
    webrtcManager.current = new WebRTCManager()

    webrtcManager.current.onConnectionStateChange = (state) => {
      setConnectionState(state)
      if (state === 'connected') {
        toast({ title: 'Connected!', description: 'P2P connection established successfully.' })
      } else if (state === 'disconnected' || state === 'failed') {
        toast({ title: 'Disconnected', description: 'Peer disconnected.', variant: 'destructive' })
      }
    }

    webrtcManager.current.onProgress = (prog) => setProgress(prog)

    webrtcManager.current.onFileReceived = (url, name) => {
      toast({ title: 'Transfer Complete', description: `Received ${name}` })
      
      // Auto download
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
    }

    webrtcManager.current.onError = (err) => {
      toast({ title: 'Error', description: err, variant: 'destructive' })
    }

    // Check URL Hash for room
    const hash = window.location.hash.replace('#', '')
    if (hash && hash.length > 5) {
      setIsReceiver(true)
      setRoomId(hash)
      webrtcManager.current.joinRoom(hash)
    }

    return () => {
      webrtcManager.current?.disconnect()
    }
  }, [])

  useEffect(() => {
    // Auto-start transfer when connection is established
    if (connectionState === 'connected' && !isReceiver && fileToTransfer && webrtcManager.current && !progress) {
      webrtcManager.current.sendFile(fileToTransfer)
    }
  }, [connectionState, isReceiver, fileToTransfer, progress])

  const handleCopyLink = () => {
    const link = `${window.location.origin}/#${roomId}`
    navigator.clipboard.writeText(link)
    toast({ title: 'Link copied', description: 'Share this link with the receiver.' })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToTransfer(e.target.files[0])
      
      // Generate the room only after a file is selected
      if (!roomId && !isReceiver) {
        const newRoom = Math.random().toString(36).substring(2, 9)
        setRoomId(newRoom)
        webrtcManager.current?.createRoom(newRoom)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            P2P Web Share
          </CardTitle>
          <CardDescription>
            Direct browser-to-browser file transfer
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Connection Status Panel */}
          {roomId && (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Status</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {connectionState === 'connected' && (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  )}
                  {(connectionState === 'disconnected' || connectionState === 'failed') && (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  )}
                  {connectionState === 'connecting' && (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                  )}
                </span>
                <span className="text-sm capitalize text-muted-foreground">
                  {connectionState === 'disconnected' ? 'Waiting for peer...' : connectionState}
                </span>
              </div>
            </div>
          )}

          {/* SENDER FLOW */}
          {!isReceiver && (
            <div className="space-y-4">
              {/* File Selection Box */}
              {!progress && !roomId && (
                <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors hover:bg-muted/50">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-3"
                  >
                    <div className="p-3 bg-muted rounded-full">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Click or drag file to select</p>
                      <p className="text-xs text-muted-foreground">Maximum file size: 50MB</p>
                    </div>
                  </label>
                </div>
              )}
              
              {/* Selected File Info */}
              {fileToTransfer && !progress && (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3 truncate">
                    <File className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium truncate">{fileToTransfer.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(fileToTransfer.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}

              {/* Share Link (Only visible after room is created but before peer connects) */}
              {roomId && connectionState !== 'connected' && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Share this link to connect with a peer:
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm truncate font-mono border">
                      {`${window.location.origin}/#${roomId}`}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECEIVER FLOW */}
          {isReceiver && !progress && (
            <div className="text-center py-8 space-y-3 border-2 border-dashed rounded-xl bg-muted/10">
              <DownloadCloud className="h-8 w-8 mx-auto text-muted-foreground" />
              {connectionState === 'connected' ? (
                <>
                  <p className="text-sm font-medium">Receiving Transfer...</p>
                  <p className="text-xs text-muted-foreground">The file transfer will begin in a moment.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Connecting to sender...</p>
                  <p className="text-xs text-muted-foreground">Please wait while the P2P connection is established.</p>
                </>
              )}
            </div>
          )}

          {/* Progress Area (Both) */}
          {progress && (
            <div className="space-y-4 p-4 border rounded-xl bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  {isReceiver ? <DownloadCloud className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                  <span className="text-sm font-medium truncate">{progress.fileName}</span>
                </div>
                {progress.progress >= 100 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
              
              <Progress value={progress.progress} className="h-2" />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.progress.toFixed(1)}%</span>
                <span className="font-mono">{progress.speed ? `${progress.speed.toFixed(2)} MB/s` : 'Calculating...'}</span>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}

export default App
