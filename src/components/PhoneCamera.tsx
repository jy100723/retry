import { useState, useRef, useEffect } from 'react';
import { Camera, Wifi, AlertCircle, Copy, Check } from 'lucide-react';
import type { SportType } from '../App';

interface PhoneCameraProps {
  sport: SportType;
}

type SignalingMessage =
  | { type: "register"; role: "phone" | "pc"; roomId: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit; roomId: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; roomId: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit; roomId: string }
  | { type: "info"; message: string };

// WebSocket 시그널링 서버 URL (로컬 테스트용 - 실제 배포 시 변경 필요)
const SIGNALING_URL = "ws://localhost:3000";

const STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ],
};

export function PhoneCamera({ sport }: PhoneCameraProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Generate unique room ID
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  };

  const startCamera = async () => {
    try {
      setError(null);
      setIsStarted(true);
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('이 브라우저는 카메라 접근을 지원하지 않습니다. 최신 브라우저를 사용해주세요.');
        return;
      }

      let mediaStream: MediaStream;
      
      try {
        // Try with video and audio first
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true
        });
      } catch (err: any) {
        console.warn('Audio failed, trying video only:', err);
        
        // If permission was denied, throw the error
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw err;
        }
        
        // Otherwise, try video only
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
        } catch (videoErr: any) {
          throw videoErr;
        }
      }
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Connect to signaling server
      await connectSignaling(mediaStream);

    } catch (err: any) {
      console.error('Error starting camera:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('카메라가 이미 다른 앱에서 사용 중입니다.');
      } else {
        setError('카메라 시작 실패: ' + err.message);
      }
    }
  };

  const connectSignaling = async (mediaStream: MediaStream) => {
    try {
      const ws = new WebSocket(SIGNALING_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "register", role: "phone", roomId }));
        setStatus('시그널링 서버 연결됨');
        initializePeerConnection(mediaStream);
      };

      ws.onmessage = async (ev) => {
        try {
          const msg: SignalingMessage = JSON.parse(ev.data);
          await handleSignalingMessage(msg);
        } catch (e) {
          console.warn('Invalid message:', e);
        }
      };

      ws.onclose = () => {
        setStatus('시그널링 서버 연결 종료');
        setIsConnected(false);
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setError('시그널링 서버 연결 실패. 서버가 실행 중인지 확인하세요.');
        setStatus('연결 오류');
      };
    } catch (err: any) {
      setError('연결 실패: ' + err.message);
    }
  };

  const sendSignaling = (msg: SignalingMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(msg));
  };

  const handleSignalingMessage = async (msg: SignalingMessage) => {
    if (msg.type === "answer") {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        setStatus('Answer 수신됨 - 연결 완료');
        setIsConnected(true);
      } catch (e) {
        console.error('setRemoteDescription error:', e);
        setError('Answer 처리 실패');
      }
    } else if (msg.type === "candidate") {
      if (peerConnectionRef.current) {
        peerConnectionRef.current
          .addIceCandidate(new RTCIceCandidate(msg.candidate))
          .catch((e) => console.warn('addIceCandidate failed:', e));
      }
    } else if (msg.type === "info") {
      console.info('Server info:', msg.message);
    }
  };

  const initializePeerConnection = async (mediaStream: MediaStream) => {
    try {
      const pc = new RTCPeerConnection(STUN_CONFIG);
      peerConnectionRef.current = pc;

      // Add media tracks
      mediaStream.getTracks().forEach(track => {
        pc.addTrack(track, mediaStream);
      });

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignaling({ 
            type: "candidate", 
            candidate: ev.candidate.toJSON(), 
            roomId 
          });
        }
      };

      pc.onconnectionstatechange = () => {
        setStatus('연결 상태: ' + pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsConnected(false);
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignaling({ type: "offer", sdp: offer, roomId });
      setStatus('Offer 전송 완료');

    } catch (err: any) {
      console.error('Error initializing peer connection:', err);
      setError('연결 초기화 실패: ' + err.message);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
          <Camera className="w-6 h-6" />
        </div>
        <div>
          <h2>핸드폰 카메라</h2>
          <p className="text-sm text-gray-400">배구 경기를 실시간으로 촬영합니다</p>
        </div>
      </div>

      {/* Start Button */}
      {!isStarted && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="text-center space-y-4">
            <Camera className="w-16 h-16 text-blue-500 mx-auto" />
            <div>
              <h3 className="mb-2">카메라를 시작하세요</h3>
              <p className="text-sm text-gray-400">
                배구 경기를 촬영하고 컴퓨터로 실시간 전송합니다
              </p>
            </div>
            <button
              onClick={startCamera}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              카메라 시작
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {isStarted && (
        <div className={`rounded-xl p-6 border-2 ${
          isConnected
            ? 'bg-green-900/20 border-green-600'
            : 'bg-blue-900/20 border-blue-600'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isConnected ? 'bg-green-600' : 'bg-blue-600'
            }`}>
              <Wifi className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className={isConnected ? 'text-green-400' : 'text-blue-400'}>
                {isConnected ? '컴퓨터에 연결됨' : '연결 대기 중'}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {status}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Code */}
      {isStarted && !isConnected && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-center mb-4">연결 코드</h3>
          <div className="bg-gray-800 rounded-xl p-6 mb-4">
            <div className="text-center tracking-[0.5em] text-3xl mb-4">
              {roomId}
            </div>
            <button
              onClick={copyToClipboard}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  복사됨!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  코드 복사
                </>
              )}
            </button>
          </div>

          <div className="text-sm text-gray-400 text-center">
            컴퓨터에서 "컴퓨터 수신" 모드를 선택하고<br />
            위 코드를 입력하여 연결하세요
          </div>
        </div>
      )}

      {/* Camera Preview */}
      {isStarted && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="relative aspect-video bg-black">
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      startCamera();
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    다시 시도
                  </button>
                  <div className="mt-6 text-left bg-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-2">✅ 권한 허용 방법:</p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>1. 브라우저 주소창 왼쪽의 자물쇠 🔒 아이콘 클릭</li>
                      <li>2. "권한" 또는 "사이트 설정" 선택</li>
                      <li>3. 카메라 권한을 "허용"으로 변경</li>
                      <li>4. 페이지를 새로고침하고 "카메라 시작" 버튼 클릭</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Streaming Indicator */}
                {isConnected && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="text-sm">실시간 전송 중</span>
                  </div>
                )}

                {/* Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-30">
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="border border-white/20" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-400">핸드폰 카메라 송신 모드</span>
              </div>
              {isConnected && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400">연결됨</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {isStarted && (
        <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-6">
          <h3 className="text-blue-400 mb-3">💡 팁</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>• 핸드폰을 삼각대나 거치대에 고정하면 안정적인 촬영이 가능합니다</li>
            <li>• 후면 카메라를 사용하여 더 선명한 영상을 얻을 수 있습니다</li>
            <li>• 같은 Wi-Fi 네트워크에 연결되어 있으면 더 안정적입니다</li>
            <li>• 배구 코트 전체가 보이도록 각도를 조정하세요</li>
          </ul>
        </div>
      )}
    </div>
  );
}