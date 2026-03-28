import { useState, useRef, useEffect } from 'react';
import { Monitor, Wifi, Circle, StopCircle, Download, AlertCircle, Clock } from 'lucide-react';
import type { RecordedVideo, SportType } from '../App';

interface ComputerReceiverProps {
  sport: SportType;
  onVideoRecorded: (video: RecordedVideo) => void;
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

export function ComputerReceiver({ sport, onVideoRecorded }: ComputerReceiverProps) {
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thumbnailCount, setThumbnailCount] = useState(0);
  const [savedThumbnails, setSavedThumbnails] = useState<string[]>([]);
  const [savedChunks, setSavedChunks] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunkTimestampsRef = useRef<number[]>([]);
  const thumbnailsRef = useRef<string[]>([]);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (thumbnailIntervalRef.current) {
      clearInterval(thumbnailIntervalRef.current);
      thumbnailIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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
    setIsRecording(false);
  };

  const connectSignaling = () => {
    if (!roomId.trim()) {
      setError('연결 코드를 입력하세요');
      return;
    }

    if (wsRef.current) {
      setError('이미 연결 중입니다');
      return;
    }

    try {
      setError(null);
      const ws = new WebSocket(SIGNALING_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "register", role: "pc", roomId: roomId.trim() }));
        setStatus('시그널링 서버 연결됨');
        setIsConnected(true);
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
        setIsConnected(false);
      };
    } catch (err: any) {
      setError('연결 실패: ' + err.message);
      setIsConnected(false);
    }
  };

  const sendSignaling = (msg: SignalingMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(msg));
  };

  const handleSignalingMessage = async (msg: SignalingMessage) => {
    if (msg.type === "offer") {
      await ensurePeerConnection();
      const pc = peerConnectionRef.current!;
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        setStatus('Offer 수신됨');
      } catch (e) {
        console.error('setRemoteDescription error:', e);
        setError('Offer 처리 실패');
        return;
      }

      // Create answer
      try {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignaling({ type: "answer", sdp: answer, roomId: roomId.trim() });
        setStatus('Answer 전송 완료');
      } catch (e) {
        console.error('createAnswer error:', e);
        setError('Answer 생성 실패');
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

  const ensurePeerConnection = async () => {
    if (peerConnectionRef.current) return;
    
    const pc = new RTCPeerConnection(STUN_CONFIG);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignaling({ 
          type: "candidate", 
          candidate: ev.candidate.toJSON(), 
          roomId: roomId.trim() 
        });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream();
      
      if (!ev.streams || ev.streams.length === 0) {
        if (ev.track) stream.addTrack(ev.track);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      
      setStatus('영상 수신 중');
    };

    pc.onconnectionstatechange = () => {
      setStatus('연결 상태: ' + pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsConnected(false);
      }
    };
  };

  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      setError('영상이 없습니다');
      return;
    }

    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      chunksRef.current = [];
      chunkTimestampsRef.current = [];
      thumbnailsRef.current = [];
      setThumbnailCount(0);

      // 캔버스 생성 (썸네일 캡처용)
      if (!thumbnailCanvasRef.current) {
        thumbnailCanvasRef.current = document.createElement('canvas');
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          const currentTime = (Date.now() - startTimeRef.current) / 1000;
          chunkTimestampsRef.current.push(currentTime);
          
          // 실시간 업로드 진행률 시뮬레이션 (실제로는 청크가 저장되는 것)
          setUploadProgress(Math.round((chunksRef.current.length / (recordingTime + 1)) * 100));
          
          console.log(`✅ 청크 ${chunksRef.current.length} 저장됨 (${Math.round(event.data.size / 1024)}KB) - 시간: ${currentTime.toFixed(1)}초`);
        }
      };

      recorder.onstop = () => {
        // 썸네일 캡처 중지
        if (thumbnailIntervalRef.current) {
          clearInterval(thumbnailIntervalRef.current);
          thumbnailIntervalRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - startTimeRef.current) / 1000;

        console.log(`✅ 녹화 완료! 총 ${chunksRef.current.length}개 청크, ${thumbnailsRef.current.length}개 썸네일, ${Math.round(blob.size / 1024 / 1024)}MB`);

        onVideoRecorded({
          id: Date.now().toString(),
          url,
          blob,
          duration,
          timestamp: new Date(Date.now()),
          sport: sport,
          thumbnails: [...thumbnailsRef.current], // 복사본 전달
          thumbnailInterval: 0.1
        });

        setIsRecording(false);
        setRecordingTime(0);
        setThumbnailCount(0);
        setUploadProgress(100);
        
        // 저장된 썸네일과 청크 업데이트
        setSavedThumbnails(thumbnailsRef.current);
        setSavedChunks(chunksRef.current.length);
        
        // 업로드 완료 메시지 표시 후 초기화
        setTimeout(() => {
          setUploadProgress(0);
        }, 2000);
      };

      // 100ms마다 청크 생성 (실시간 스트리밍 업로드)
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // 0.1초(100ms)마다 프레임 캡처 (타임라인 썸네일용)
      const captureThumbnail = () => {
        const video = videoRef.current;
        const canvas = thumbnailCanvasRef.current;
        if (!video || !canvas || video.videoWidth === 0) return;

        // 썸네일 크기 설정 (작게 만들어 메모리 절약)
        const targetWidth = 120;
        const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        try {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6); // JPEG 압축 사용
          thumbnailsRef.current.push(thumbnailUrl);
          setThumbnailCount(thumbnailsRef.current.length);
          
          if (thumbnailsRef.current.length % 10 === 0) {
            console.log(`📸 썸네일 ${thumbnailsRef.current.length} 캡처됨`);
          }
        } catch (err) {
          console.warn('썸네일 캡처 실패:', err);
        }
      };

      // 즉시 첫 썸네일 캡처
      setTimeout(captureThumbnail, 50);
      
      // 0.1초(100ms)마다 캡처
      thumbnailIntervalRef.current = window.setInterval(captureThumbnail, 100);

      console.log('🎥 실시간 녹화 시작 - 0.1초마다 청크 & 썸네일 저장');

    } catch (err: any) {
      setError('녹화 시작 실패: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const disconnect = () => {
    cleanup();
    setStatus('연결 종료');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h2>컴퓨터 수신 모드</h2>
          <p className="text-sm text-gray-400">핸드폰 카메라 영상을 수신합니다</p>
        </div>
      </div>

      {/* Real-time Upload Progress */}
      {isRecording && uploadProgress > 0 && (
        <div className="bg-blue-900/20 border border-blue-600 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-blue-400 animate-spin" />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-blue-400">실시간 백그라운드 저장 중</span>
                <span className="text-xs text-blue-300">{chunksRef.current.length}개 청크 • {thumbnailCount}개 썸네일</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-gray-800/50 rounded px-3 py-2">
              <span className="text-gray-400">📦 영상 청크:</span> <span className="text-blue-300">{chunksRef.current.length}개 (0.1초마다)</span>
            </div>
            <div className="bg-gray-800/50 rounded px-3 py-2">
              <span className="text-gray-400">📸 타임라인:</span> <span className="text-green-300">{thumbnailCount}개 (0.1초마다)</span>
            </div>
          </div>
          
          {/* 실시간 썸네일 미리보기 */}
          {thumbnailsRef.current.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">📸 실시간 캡처된 타임라인 프레임</span>
                <span className="text-xs text-green-400">{thumbnailCount}개 저장됨</span>
              </div>
              <div className="flex gap-1 overflow-x-auto max-h-16 pb-1" style={{ scrollBehavior: 'smooth' }}>
                {thumbnailsRef.current.slice(-20).map((thumb, idx) => (
                  <img 
                    key={idx} 
                    src={thumb} 
                    alt={`Thumbnail ${idx}`}
                    className="h-12 rounded border border-green-500/30"
                    style={{ minWidth: '64px' }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">최근 20개 프레임 표시 중 (전체 {thumbnailCount}개 저장됨)</p>
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-2">
            ⚡ 녹화 종료 시 즉시 재생 및 타임라인 이동 가능합니다
          </p>
        </div>
      )}

      {/* Connection Input */}
      {!isConnected && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="mb-4">연결 코드 입력</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                핸드폰에서 생성한 연결 코드 (Room ID)
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="예: ROOM1"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-center tracking-wider"
                maxLength={10}
              />
            </div>
            <button
              onClick={connectSignaling}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Wifi className="w-5 h-5" />
              연결하기
            </button>
            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Status */}
      {isConnected && (
        <div className="bg-green-900/20 border-2 border-green-600 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
              <Wifi className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-green-400">핸드폰에 연결됨</h3>
              <p className="text-sm text-gray-400 mt-1">{status}</p>
            </div>
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              연결 종료
            </button>
          </div>
        </div>
      )}

      {/* Video Display */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          
          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
              <Circle className="w-3 h-3 fill-white animate-pulse" />
              <span className="text-sm">실시간 녹화 중 {formatTime(recordingTime)}</span>
            </div>
          )}

          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Monitor className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">핸드폰 카메라 대기 중...</p>
                <p className="text-sm text-gray-500 mt-2">연결 코드를 입력하세요</p>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Thumbnail Strip - Below Video (Recording) */}
        {isRecording && thumbnailsRef.current.length > 0 && (
          <div className="border-t border-gray-700 bg-gray-950 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">📸 최근 5초간 캡처된 프레임</span>
              <span className="text-xs text-blue-400">{thumbnailCount}개 저장 중</span>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-2" style={{ scrollBehavior: 'smooth' }}>
              {thumbnailsRef.current.slice(-50).map((thumb, idx) => {
                const actualIdx = Math.max(0, thumbnailsRef.current.length - 50) + idx;
                return (
                  <div key={actualIdx} className="relative flex-shrink-0 group">
                    <img 
                      src={thumb} 
                      alt={`Frame ${actualIdx}`}
                      className="h-16 rounded border-2 border-blue-500/50 hover:border-blue-400"
                      style={{ minWidth: '90px' }}
                    />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <span className="text-xs text-white font-bold">
                        {(actualIdx * 0.1).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>총 {thumbnailCount}개 프레임 저장됨</span>
              <span>0.1초 간격 실시간 캡처</span>
            </div>
          </div>
        )}

        {/* All Thumbnails Strip - Below Video (After Recording) */}
        {!isRecording && savedThumbnails.length > 0 && (
          <div className="border-t border-gray-700 bg-gray-950">
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-blue-400">✅ 저장된 타임라인 프레임 (마지막 녹화)</span>
                  <p className="text-xs text-gray-400 mt-1">
                    {savedThumbnails.length}개 프레임 | 0.1초 간격 | 총 {(savedThumbnails.length * 0.1).toFixed(1)}초
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {savedChunks}개 영상 청크
                </div>
              </div>
            </div>
            <div className="px-4 py-3 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-10 gap-2">
                {savedThumbnails.map((thumb, idx) => (
                  <div key={idx} className="relative group">
                    <img 
                      src={thumb} 
                      alt={`Frame ${idx}`}
                      className="w-full aspect-video object-cover rounded border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                    />
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-center">
                      <span className="text-xs text-white font-bold">
                        {(idx * 0.1).toFixed(1)}s
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        #{idx + 1}
                      </span>
                    </div>
                    {idx % 10 === 0 && (
                      <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded font-bold shadow-lg">
                        {Math.floor(idx / 10)}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-gray-400">총 프레임</div>
                  <div className="text-blue-400 font-bold">{savedThumbnails.length}개</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">영상 청크</div>
                  <div className="text-green-400 font-bold">{savedChunks}개</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">총 시간</div>
                  <div className="text-purple-400 font-bold">{(savedThumbnails.length * 0.1).toFixed(1)}초</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                💡 Review 탭에서 타임라인을 클릭하여 정확한 시점으로 이동할 수 있습니다
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        {isConnected && (
          <div className="px-6 py-4 border-t border-gray-800">
            <div className="flex items-center justify-center gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Circle className="w-5 h-5" />
                  녹화 시작
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <StopCircle className="w-5 h-5" />
                  녹화 중지 (즉시 재생 가능)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-6">
        <h3 className="text-blue-400 mb-3">⚡ 실시간 스트리밍 녹화</h3>
        <div className="text-sm text-gray-300 space-y-2">
          <p>✨ <strong>새로운 실시간 업로드 방식:</strong></p>
          <ul className="space-y-1 ml-4">
            <li>• 녹화하는 동안 0.1초마다 자동으로 청크가 저장됩니다</li>
            <li>• 백그라운드에서 실시간으로 처리되어 별도 업로드 시간이 없습니다</li>
            <li>• 녹화 중지 버튼을 누르면 <strong>즉시</strong> 타임라인에서 확인 가능합니다</li>
            <li>• 긴 영상도 빠르게 분석을 시작할 수 있습니다</li>
          </ul>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4 mt-4">
          <p className="text-xs text-gray-400 mb-2">🔧 시그널링 서버 설정:</p>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>Node.js가 설치되어 있어야 합니다</li>
            <li>프로젝트 루트에서 signaling-server.js 파일 확인</li>
            <li>터미널에서: <code className="bg-gray-800 px-2 py-1 rounded">npm install ws</code></li>
            <li>서버 실행: <code className="bg-gray-800 px-2 py-1 rounded">node signaling-server.js</code></li>
            <li>서버가 ws://localhost:3000 에서 실행됩니다</li>
          </ol>
        </div>
        <p className="text-xs text-yellow-400 mt-3">
          ⚠️ 현재 localhost 모드입니다. 실제 배포 시에는 SIGNALING_URL을 변경하세요.
        </p>
      </div>
    </div>
  );
}