import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Camera,
  Trash2,
  ZoomIn,
  ZoomOut,
  Wind,
  Zap,
  Shield,
  Target,
  Activity,
  Circle,
  Slash,
  Move,
  HandMetal
} from 'lucide-react';
import type { RecordedVideo, VideoMarker } from '../App';
import { VolleyballScoreboard } from './VolleyballScoreboard';
import { BaseballScoreboard } from './BaseballScoreboard';

interface VideoPlayerProps {
  video: RecordedVideo;
}

const VOLLEYBALL_EVENTS = [
  { type: 'serve' as const, label: '서브', icon: Wind, color: '#3b82f6' },
  { type: 'spike' as const, label: '스파이크', icon: Zap, color: '#ef4444' },
  { type: 'block' as const, label: '블록킹', icon: Shield, color: '#8b5cf6' },
  { type: 'dig' as const, label: '디그', icon: Target, color: '#10b981' },
  { type: 'set' as const, label: '세터', icon: Activity, color: '#f59e0b' },
  { type: 'other' as const, label: '기타', icon: Camera, color: '#6b7280' }
];

const BASEBALL_EVENTS = [
  { type: 'pitch' as const, label: '투구', icon: Circle, color: '#3b82f6' },
  { type: 'hit' as const, label: '타격', icon: Slash, color: '#ef4444' },
  { type: 'steal' as const, label: '도루', icon: Move, color: '#10b981' },
  { type: 'out' as const, label: '아웃', icon: Zap, color: '#f59e0b' },
  { type: 'defense' as const, label: '수비', icon: HandMetal, color: '#8b5cf6' },
  { type: 'other' as const, label: '기타', icon: Camera, color: '#6b7280' }
];

export function VideoPlayer({ video }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [markers, setMarkers] = useState<VideoMarker[]>(video.markers || []);
  const [zoom, setZoom] = useState(1);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [team1Score, setTeam1Score] = useState(video.score?.team1 || 0);
  const [team2Score, setTeam2Score] = useState(video.score?.team2 || 0);
  const [currentSet, setCurrentSet] = useState(video.score?.set || 1);
  const [currentInning, setCurrentInning] = useState(video.score?.inning || 1);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded, duration:', video.duration);
      setDuration(video.duration);
    };

    const handleDurationChange = () => {
      console.log('Video duration changed:', video.duration);
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setLoadingProgress((bufferedEnd / video.duration) * 100);
      }
    };

    const handleCanPlay = () => {
      setIsVideoLoaded(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('canplay', handleCanPlay);

    // Force duration update if already loaded
    if (video.duration && !isNaN(video.duration)) {
      console.log('Video already loaded, duration:', video.duration);
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, duration));
  };

  const skipFrames = (direction: 'forward' | 'backward') => {
    const frameTime = 1 / 30; // Assuming 30fps
    const newTime = currentTime + (direction === 'forward' ? frameTime : -frameTime);
    seekTo(newTime);
  };

  const skipSeconds = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const addMarker = (eventType: VideoMarker['type'], label: string, color: string) => {
    const newMarker: VideoMarker = {
      id: `marker-${Date.now()}`,
      time: currentTime,
      label,
      color,
      type: eventType
    };
    setMarkers([...markers, newMarker]);
    setShowEventMenu(false);
  };

  const removeMarker = (id: string) => {
    setMarkers(markers.filter(m => m.id !== id));
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageUrl = canvas.toDataURL('image/png');
    setCapturedFrames([imageUrl, ...capturedFrames]);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    const videoEl = videoRef.current;
    if (!timeline || !videoEl) return;

    const rect = timeline.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    // Use stored duration instead of video element duration
    if (!duration || duration === 0) {
      console.log('Duration not available:', duration);
      return;
    }
    
    const newTime = pos * duration;
    console.log('Timeline clicked - Moving to:', { pos, newTime, duration, currentTime: videoEl.currentTime });
    
    videoEl.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    console.log('Mouse down on timeline');
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    const videoEl = videoRef.current;
    if (!timeline || !videoEl) return;

    const rect = timeline.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    // Use stored duration instead of video element duration
    if (!duration || duration === 0) return;
    
    const time = pos * duration;
    
    setHoverTime(time);
    setHoverPosition(pos * 100);

    if (isDragging) {
      console.log('Dragging to:', { pos, time, duration });
      videoEl.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTimelineMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleTimelineClick(e);
    }
    setIsDragging(false);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const changeZoom = (delta: number) => {
    setZoom(Math.max(1, Math.min(3, zoom + delta)));
  };

  //  Determine which events to use based on sport
  const EVENTS = video.sport === 'volleyball' ? VOLLEYBALL_EVENTS : BASEBALL_EVENTS;

  // Group markers by type for statistics
  const markerStats = EVENTS.map(event => ({
    ...event,
    count: markers.filter(m => m.type === event.type).length
  }));

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      {video.sport === 'volleyball' ? (
        <VolleyballScoreboard
          team1Score={team1Score}
          team2Score={team2Score}
          currentSet={currentSet}
          onScoreChange={(t1, t2) => {
            setTeam1Score(t1);
            setTeam2Score(t2);
          }}
          onSetChange={setCurrentSet}
        />
      ) : (
        <BaseballScoreboard
          team1Score={team1Score}
          team2Score={team2Score}
          currentInning={currentInning}
          onScoreChange={(t1, t2) => {
            setTeam1Score(t1);
            setTeam2Score(t2);
          }}
          onInningChange={setCurrentInning}
        />
      )}

      {/* Video Display */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
          {/* Loading Overlay */}
          {!isVideoLoaded && (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">영상 로딩 중...</p>
                {loadingProgress > 0 && loadingProgress < 100 && (
                  <div className="mt-3 w-64 mx-auto">
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{Math.round(loadingProgress)}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            style={{
              transform: `scale(${zoom})`,
              transition: 'transform 0.2s'
            }}
            className="w-full h-full"
          >
            <video
              ref={videoRef}
              src={video.url}
              className="w-full h-full object-contain"
              preload="auto"
            />
          </div>
          
          {/* Time Display */}
          <div className="absolute top-4 left-4 bg-black/70 px-3 py-2 rounded-lg backdrop-blur-sm">
            <div className="text-lg tabular-nums">{formatTime(currentTime)}</div>
            <div className="text-xs text-gray-400">{formatTime(duration)}</div>
          </div>

          {/* Playback Rate */}
          <div className="absolute top-4 right-4 bg-black/70 px-3 py-2 rounded-lg backdrop-blur-sm">
            <div className="text-sm">{playbackRate}x</div>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => changeZoom(-0.25)}
              disabled={zoom <= 1}
              className="w-10 h-10 bg-black/70 hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm flex items-center justify-center transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => changeZoom(0.25)}
              disabled={zoom >= 3}
              className="w-10 h-10 bg-black/70 hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg backdrop-blur-sm flex items-center justify-center transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-6 py-4 border-t border-gray-800 space-y-3">
          {/* Thumbnail Timeline */}
          {video.thumbnails && video.thumbnails.length > 0 && (
            <div className="relative h-20 bg-gray-800 rounded-lg overflow-hidden">
              {/* Thumbnails as background */}
              <div className="absolute inset-0 flex">
                {video.thumbnails.map((thumbnail, index) => (
                  <div
                    key={index}
                    className="flex-1 min-w-0 bg-cover bg-center opacity-60"
                    style={{
                      backgroundImage: `url(${thumbnail})`,
                      backgroundSize: 'cover'
                    }}
                  />
                ))}
              </div>
              
              {/* Clickable overlay */}
              <div
                ref={timelineRef}
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseUp={handleTimelineMouseUp}
                onMouseLeave={handleTimelineMouseLeave}
                className="absolute inset-0 cursor-pointer z-10"
              />
              
              {/* Progress overlay */}
              <div
                className="absolute inset-y-0 left-0 bg-blue-600/30 pointer-events-none"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              
              {/* Markers */}
              {markers.map((marker) => {
                const event = EVENTS.find(e => e.type === marker.type);
                const Icon = event?.icon || Camera;
                
                return (
                  <div
                    key={marker.id}
                    className="absolute top-0 bottom-0 w-1 group z-20"
                    style={{
                      left: `${duration > 0 ? (marker.time / duration) * 100 : 0}%`,
                      backgroundColor: marker.color
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(marker.time);
                    }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap pointer-events-none">
                      <div className="bg-black px-3 py-2 rounded-lg text-xs shadow-lg border border-gray-700">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-3 h-3" />
                          <span>{marker.label}</span>
                        </div>
                        <div className="text-gray-400">{formatTime(marker.time)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Current Time Indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-30"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full" />
              </div>

              {/* Hover Time Indicator */}
              {hoverTime !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400 pointer-events-none z-20"
                  style={{ left: `${hoverPosition}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gray-400 rounded-full" />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded text-xs whitespace-nowrap">
                    {formatTime(hoverTime)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback timeline without thumbnails */}
          {(!video.thumbnails || video.thumbnails.length === 0) && (
            <div className="relative h-12 bg-gray-800 rounded-lg overflow-hidden">
              {/* Clickable Background Layer */}
              <div
                ref={timelineRef}
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseUp={handleTimelineMouseUp}
                onMouseLeave={handleTimelineMouseLeave}
                className="absolute inset-0 cursor-pointer z-10"
              />
              
              {/* Progress */}
              <div
                className="absolute inset-y-0 left-0 bg-blue-600/30 pointer-events-none"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              
              {/* Markers */}
              {markers.map((marker) => {
                const event = EVENTS.find(e => e.type === marker.type);
                const Icon = event?.icon || Camera;
                
                return (
                  <div
                    key={marker.id}
                    className="absolute top-0 bottom-0 w-1 group z-20"
                    style={{
                      left: `${duration > 0 ? (marker.time / duration) * 100 : 0}%`,
                      backgroundColor: marker.color
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(marker.time);
                    }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap pointer-events-none">
                      <div className="bg-black px-3 py-2 rounded-lg text-xs shadow-lg border border-gray-700">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-3 h-3" />
                          <span>{marker.label}</span>
                        </div>
                        <div className="text-gray-400">{formatTime(marker.time)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Current Time Indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-30"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full" />
              </div>

              {/* Hover Time Indicator */}
              {hoverTime !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400 pointer-events-none z-20"
                  style={{ left: `${hoverPosition}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gray-400 rounded-full" />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded text-xs whitespace-nowrap">
                    {formatTime(hoverTime)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time Display Below Timeline */}
          <div className="flex items-center justify-between px-1 text-xs text-gray-400 tabular-nums">
            <div>{formatTime(currentTime)}</div>
            <div className="flex items-center gap-2">
              {duration > 0 && (
                <span>{formatTime(duration)}</span>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Frame by Frame */}
              <button
                onClick={() => skipFrames('backward')}
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
                title="이전 프레임"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Skip Backward */}
              <button
                onClick={() => skipSeconds(-5)}
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
                title="5초 뒤로"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => skipSeconds(5)}
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
                title="5초 앞으로"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Frame by Frame */}
              <button
                onClick={() => skipFrames('forward')}
                className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
                title="다음 프레임"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-2">
              {[0.25, 0.5, 1, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => changePlaybackRate(rate)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    playbackRate === rate
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowEventMenu(!showEventMenu)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  이벤트 마킹
                </button>
                
                {showEventMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 min-w-[200px] z-20">
                    {EVENTS.map((event) => {
                      const Icon = event.icon;
                      return (
                        <button
                          key={event.type}
                          onClick={() => addMarker(event.type, event.label, event.color)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 rounded-lg transition-colors text-left"
                        >
                          <Icon className="w-4 h-4" style={{ color: event.color }} />
                          <span className="text-sm">{event.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <button
                onClick={captureFrame}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
              >
                <Camera className="w-4 h-4" />
                캡처
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Statistics */}
      {markers.length > 0 && (
        <div className="grid grid-cols-6 gap-3">
          {markerStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.type}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center"
              >
                <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: stat.color }} />
                <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                <div className="text-2xl">{stat.count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Markers List */}
      {markers.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm mb-3">이벤트 마커 ({markers.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {markers.map((marker) => {
              const event = EVENTS.find(e => e.type === marker.type);
              const Icon = event?.icon || Camera;
              
              return (
                <div
                  key={marker.id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                >
                  <button
                    onClick={() => seekTo(marker.time)}
                    className="flex items-center gap-3 flex-1 text-left px-2 py-1 rounded"
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: marker.color }}
                    />
                    <div className="flex-1">
                      <div className="text-sm">{marker.label}</div>
                      <div className="text-xs text-gray-400">{formatTime(marker.time)}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => removeMarker(marker.id)}
                    className="w-8 h-8 hover:bg-gray-700 rounded flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Captured Frames */}
      {capturedFrames.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm mb-3">캡처한 프레임 ({capturedFrames.length})</h3>
          <div className="grid grid-cols-4 gap-3">
            {capturedFrames.map((frame, index) => (
              <a
                key={index}
                href={frame}
                download={`frame-${index + 1}.png`}
                className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden group"
              >
                <img
                  src={frame}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs">다운로드</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}