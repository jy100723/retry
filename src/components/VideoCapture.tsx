import { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Circle, AlertCircle, Settings, RotateCcw, Play, Pause } from 'lucide-react';
import type { RecordedVideo, SportType } from '../App';

interface VideoCaptureProps {
  sport: SportType;
  onVideoRecorded: (video: RecordedVideo, isAutoMode?: boolean) => void;
}

export function VideoCapture({ sport, onVideoRecorded }: VideoCaptureProps) {
  const [stream1, setStream1] = useState<MediaStream | null>(null);
  const [stream2, setStream2] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId1, setSelectedDeviceId1] = useState<string>('');
  const [selectedDeviceId2, setSelectedDeviceId2] = useState<string>('');
  const [isStarted, setIsStarted] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isAutoRecording, setIsAutoRecording] = useState(false);
  const [isDualCamera, setIsDualCamera] = useState(false);
  
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordedVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoStopTimerRef = useRef<number | null>(null);
  const autoRecordingModeRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // Get available video devices
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId1) {
          setSelectedDeviceId1(videoDevices[0].deviceId);
        }
        if (videoDevices.length > 1 && !selectedDeviceId2) {
          setSelectedDeviceId2(videoDevices[1].deviceId);
        }
      } catch (err) {
        console.error('Error enumerating devices:', err);
      }
    }
    getDevices();
  }, [selectedDeviceId1, selectedDeviceId2]);

  // Update video elements when streams change
  useEffect(() => {
    if (stream1 && videoRef1.current && !recordedVideoUrl) {
      videoRef1.current.srcObject = stream1;
      videoRef1.current.play().catch(e => console.warn('Video 1 play failed:', e));
    }
  }, [stream1, recordedVideoUrl]);

  useEffect(() => {
    if (stream2 && videoRef2.current && !recordedVideoUrl) {
      videoRef2.current.srcObject = stream2;
      videoRef2.current.play().catch(e => console.warn('Video 2 play failed:', e));
    }
  }, [stream2, recordedVideoUrl]);

  // Canvas rendering for dual camera
  useEffect(() => {
    if (!isDualCamera || !stream1 || !stream2 || !canvasRef.current || recordedVideoUrl) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderFrame = () => {
      if (videoRef1.current && videoRef2.current) {
        // Draw both videos top and bottom (위아래 배치)
        ctx.drawImage(videoRef1.current, 0, 0, canvas.width, canvas.height / 2);
        ctx.drawImage(videoRef2.current, 0, canvas.height / 2, canvas.width, canvas.height / 2);
      }
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDualCamera, stream1, stream2, recordedVideoUrl]);

  const startCamera = async () => {
    try {
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('이 브라우저는 카메라 접근을 지원하지 않습니다. 최신 브라우저를 사용해주세요.');
        return;
      }

      const constraints1: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId1 ? { exact: selectedDeviceId1 } : undefined,
          width: { ideal: 1148 },
          height: { ideal: 451 }
        },
        audio: true
      };

      const mediaStream1 = await navigator.mediaDevices.getUserMedia(constraints1).catch(async (err) => {
        console.warn('Audio failed for camera 1, trying video only:', err);
        return navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDeviceId1 ? { exact: selectedDeviceId1 } : undefined,
            width: { ideal: 1148 },
            height: { ideal: 451 }
          },
          audio: false
        });
      });
      
      setStream1(mediaStream1);

      // If dual camera mode and second camera is selected
      if (isDualCamera && selectedDeviceId2 && selectedDeviceId2 !== selectedDeviceId1) {
        try {
          const constraints2: MediaStreamConstraints = {
            video: {
              deviceId: { exact: selectedDeviceId2 },
              width: { ideal: 1148 },
              height: { ideal: 451 }
            },
            audio: false // Only first camera has audio
          };

          const mediaStream2 = await navigator.mediaDevices.getUserMedia(constraints2);
          setStream2(mediaStream2);
        } catch (err) {
          console.error('Failed to start second camera:', err);
          setError('두 번째 카메라를 시작할 수 없습니다.');
        }
      }

    } catch (err: any) {
      console.error('Error accessing camera:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('카메라가 이미 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.');
      } else if (err.name === 'OverconstrainedError') {
        setError('요청한 카메라 설정을 지원하지 않습니다. 다른 카메라를 선택해보세요.');
      } else if (err.name === 'SecurityError') {
        setError('보안 문제로 카메라에 접근할 수 없습니다. HTTPS 연결이 필요할 수 있습니다.');
      } else {
        setError('카메라 접근 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
      }
    }
  };

  const stopCamera = () => {
    if (stream1) {
      stream1.getTracks().forEach(track => track.stop());
      setStream1(null);
    }
    if (stream2) {
      stream2.getTracks().forEach(track => track.stop());
      setStream2(null);
    }
  };

  const startRecording = () => {
    const recordingStream = isDualCamera && stream1 && stream2 ? getCanvasStream() : stream1;
    
    if (!recordingStream) return;

    try {
      setRecordedVideoUrl(null);
      chunksRef.current = [];
      
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      
      console.log('Using mimeType:', mimeType);
      
      const mediaRecorder = new MediaRecorder(recordingStream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          const currentTime = (Date.now() - startTimeRef.current) / 1000;
          console.log(`✅ 청크 ${chunksRef.current.length} 저장됨 (${Math.round(event.data.size / 1024)}KB) - 시간: ${currentTime.toFixed(1)}초`);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, total chunks:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        console.log('Blob created, size:', blob.size, 'bytes');
        const url = URL.createObjectURL(blob);
        console.log('Video URL created:', url);
        const duration = (Date.now() - startTimeRef.current) / 1000;

        console.log(`✅ 녹화 완료! 총 ${chunksRef.current.length}개 청크, ${Math.round(blob.size / 1024 / 1024)}MB, ${duration.toFixed(1)}초`);
        
        const video: RecordedVideo = {
          id: `video-${Date.now()}`,
          blob,
          url,
          timestamp: new Date(),
          duration,
          sport: sport
        };

        onVideoRecorded(video, autoRecordingModeRef.current);
        setRecordingTime(0);
        
        if (autoRecordingModeRef.current) {
          console.log('🔄 자동 녹화 모드 - 새로운 10초 녹화 시작');
          setTimeout(() => {
            if (autoRecordingModeRef.current && (stream1 || (isDualCamera && stream2))) {
              startRecording();
            }
          }, 100);
        } else {
          setRecordedVideoUrl(url);
          console.log('RecordedVideoUrl set to:', url);
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      console.log(autoRecordingModeRef.current ? '🎥 10초 자동 녹화 시작' : '🎥 수동 녹화 시작');

      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      if (autoRecordingModeRef.current) {
        console.log('⏱️ 10초 타이머 설정됨');
        autoStopTimerRef.current = window.setTimeout(() => {
          console.log('⏱️ 10초 경과 - 자동 녹화 중지 시작');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('⏱️ MediaRecorder 중지 호출');
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            if (autoStopTimerRef.current) {
              clearTimeout(autoStopTimerRef.current);
              autoStopTimerRef.current = null;
            }
          }
        }, 10000);
      }

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('녹화를 시작할 수 없습니다.');
    }
  };

  const getCanvasStream = (): MediaStream | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Get canvas stream
    const canvasStream = canvas.captureStream(30);
    
    // Add audio from first camera
    if (stream1) {
      const audioTracks = stream1.getAudioTracks();
      audioTracks.forEach(track => canvasStream.addTrack(track));
    }

    return canvasStream;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    }
  };

  const startAutoRecording = () => {
    autoRecordingModeRef.current = true;
    setIsAutoRecording(true);
    startRecording();
  };

  const stopAutoRecording = () => {
    autoRecordingModeRef.current = false;
    setIsAutoRecording(false);
    if (isRecording) {
      stopRecording();
    }
  };

  const startNewRecording = () => {
    setRecordedVideoUrl(null);
    setRecordingTime(0);
  };

  const handleStartCamera = () => {
    setIsStarted(true);
    startCamera();
  };

  const toggleDualCamera = () => {
    const newDualMode = !isDualCamera;
    setIsDualCamera(newDualMode);
    
    if (isStarted) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Start Camera Prompt */}
      {!isStarted && !stream1 && (
        <div className="bg-gradient-to-br from-green-900/40 to-blue-900/40 border-2 border-green-600/50 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl mb-3">로컬 카메라 시작</h3>
          <p className="text-gray-300 mb-6 max-w-md mx-auto">
            이 기기의 카메라를 사용합니다. "카메라 시작" 버튼을 클릭하면 
            브라우저에서 카메라 권한을 요청합니다.
          </p>
          
          {/* Dual Camera Toggle */}
          {availableDevices.length >= 2 && (
            <div className="mb-6 flex items-center justify-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDualCamera}
                  onChange={toggleDualCamera}
                  className="w-5 h-5"
                />
                <span className="text-sm">듀얼 카메라 모드 (2개 카메라 동시 사용)</span>
              </label>
            </div>
          )}

          <button
            onClick={handleStartCamera}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors inline-flex items-center gap-3"
          >
            <Camera className="w-6 h-6" />
            {isDualCamera ? '듀얼 카메라 시작' : '카메라 시작'}
          </button>
          
          <div className="mt-6 text-xs text-gray-400">
            💡 권한 요청 창에서 "허용"을 선택해주세요
          </div>
        </div>
      )}

      {/* Camera Settings */}
      {isStarted && !recordedVideoUrl && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-400" />
            <span className="text-sm">카메라 설정</span>
          </div>
          
          {/* Dual Camera Toggle */}
          {availableDevices.length >= 2 && (
            <div className="flex items-center gap-3 pl-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDualCamera}
                  onChange={toggleDualCamera}
                  disabled={isRecording}
                  className="w-4 h-4"
                />
                <span className="text-sm">듀얼 카메라 모드</span>
              </label>
            </div>
          )}

          {/* Camera 1 */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-20">카메라 1:</span>
            <select
              value={selectedDeviceId1}
              onChange={(e) => setSelectedDeviceId1(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              disabled={isRecording}
            >
              {availableDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Camera 2 */}
          {isDualCamera && availableDevices.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-20">카메라 2:</span>
              <select
                value={selectedDeviceId2}
                onChange={(e) => setSelectedDeviceId2(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                disabled={isRecording}
              >
                {availableDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Video Preview or Recorded Video */}
      {isStarted && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden max-w-7xl mx-auto">
          {/* 8초 자동 녹화 버튼 */}
          {!recordedVideoUrl && stream1 && (
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {isAutoRecording ? '🔴 10초 자동 녹화 진행 중' : '10초 자동 녹화 모드'}
                  {isDualCamera && ' (듀얼 카메라)'}
                </div>
                {!isAutoRecording ? (
                  <button
                    onClick={startAutoRecording}
                    disabled={!stream1 || isRecording || (isDualCamera && !stream2)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    <Play className="w-4 h-4" />
                    10초 자동 녹화 시작
                  </button>
                ) : (
                  <button
                    onClick={stopAutoRecording}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    <Pause className="w-4 h-4" />
                    자동 녹화 중지
                  </button>
                )}
              </div>
            </div>
          )}

          <div className={`relative bg-black ${
            isDualCamera && stream2 
              ? 'aspect-[1148/902]' // 듀얼 카메라: 위아래 배치 비율
              : 'aspect-[1148/451]' // 싱글 카메라: 와이드 비율
          }`}>
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-400 mb-4 text-sm">{error}</p>
                  <button
                    onClick={startCamera}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    다시 시도
                  </button>
                  <div className="mt-6 text-left bg-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-2">해결 방법:</p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• 브라우저 설정에서 카메라 권한 확인</li>
                      <li>• 주소창의 자물쇠 아이콘 클릭 → 권한 설정</li>
                      <li>• 페이지 새로고침 후 재시도</li>
                      <li>• HTTPS 연결 확인 (localhost는 허용)</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : !stream1 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">카메라 시작 중...</p>
                </div>
              </div>
            ) : recordedVideoUrl ? (
              /* Show Recorded Video */
              <div className="relative w-full h-full">
                <video
                  ref={recordedVideoRef}
                  src={recordedVideoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-4 left-4 bg-green-600 px-3 py-2 rounded-lg">
                  <span className="text-sm">✓ 녹화 완료</span>
                </div>
              </div>
            ) : isDualCamera && stream2 ? (
              /* Show Dual Camera Feed */
              <>
                {/* Hidden video elements for canvas */}
                <video
                  ref={videoRef1}
                  autoPlay
                  playsInline
                  muted
                  className="hidden"
                />
                <video
                  ref={videoRef2}
                  autoPlay
                  playsInline
                  muted
                  className="hidden"
                />
                
                {/* Canvas for dual camera */}
                <canvas
                  ref={canvasRef}
                  width={1148}
                  height={902}
                  className="w-full h-full object-contain"
                />
                
                {/* Recording Indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
                    <Circle className="w-3 h-3 fill-white animate-pulse" />
                    <span className="text-sm">REC {formatTime(recordingTime)}</span>
                    {isAutoRecording && (
                      <span className="text-xs ml-2 bg-red-700 px-2 py-0.5 rounded">
                        자동 {Math.max(0, 10 - recordingTime)}초
                      </span>
                    )}
                  </div>
                )}

                {/* Dual Camera Label */}
                <div className="absolute top-4 right-4 bg-blue-600 px-3 py-2 rounded-lg">
                  <span className="text-sm">📹 듀얼 카메라</span>
                </div>
              </>
            ) : (
              /* Show Single Camera Feed */
              <>
                <video
                  ref={videoRef1}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Recording Indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg">
                    <Circle className="w-3 h-3 fill-white animate-pulse" />
                    <span className="text-sm">REC {formatTime(recordingTime)}</span>
                    {isAutoRecording && (
                      <span className="text-xs ml-2 bg-red-700 px-2 py-0.5 rounded">
                        자동 {Math.max(0, 10 - recordingTime)}초
                      </span>
                    )}
                  </div>
                )}

                {/* Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="border border-white/10" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-t border-gray-800">
            <div className="flex items-center justify-center gap-4">
              {recordedVideoUrl ? (
                <button
                  onClick={startNewRecording}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  새로운 녹화하기
                </button>
              ) : !isRecording && !isAutoRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!stream1 || (isDualCamera && !stream2)}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Circle className="w-5 h-5" />
                  수동 녹화 시작
                </button>
              ) : !isAutoRecording ? (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <StopCircle className="w-5 h-5" />
                  녹화 중지
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {isStarted && !recordedVideoUrl && (
        <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
          <h3 className="text-sm text-blue-400 mb-2">💡 사용 방법</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>듀얼 카메라:</strong> 2개의 카메라를 동시에 녹화 (위아래 분할)</li>
            <li>• <strong>10초 자동 녹화:</strong> 버튼 클릭 시 10초마다 자동으로 녹화 및 저장</li>
            <li>• <strong>수동 녹화:</strong> \"수동 녹화 시작\" 버튼으로 원하는 시간만큼 녹화</li>
            <li>• 자동 녹화 모드에서는 10초마다 녹화가 반복되며 영상 목록에 자동 저장됩니다</li>
            <li>• \"Review\" 탭에서 저장된 영상을 분석할 수 있습니다</li>
          </ul>
        </div>
      )}

      {/* Recorded Video Info */}
      {recordedVideoUrl && (
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
          <h3 className="text-sm text-green-400 mb-2">✓ 녹화 완료</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• 위 영상을 재생하여 확인할 수 있습니다</li>
            <li>• \"Review\" 탭에서 상세 분석이 가능합니다</li>
            <li>• \"새로운 녹화하기\"로 추가 촬영을 할 수 있습니다</li>
            <li>• 녹화된 영상은 자동으로 저장됩니다</li>
          </ul>
        </div>
      )}
    </div>
  );
}