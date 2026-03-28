import React from "react";
// ... 기존에 있던 다른 import 문들
import { useState, useEffect } from 'react';
import { VideoCapture } from './components/VideoCapture';
import { VideoPlayer } from './components/VideoPlayer';
import { PhoneCamera } from './components/PhoneCamera';
import { ComputerReceiver } from './components/ComputerReceiver';
import { Camera, Video, Smartphone, Monitor, Volleyball, Trophy } from 'lucide-react';

export type SportType = 'volleyball' | 'baseball';

export interface RecordedVideo {
  id: string;
  blob: Blob;
  url: string;
  timestamp: Date;
  duration: number;
  sport: SportType;
  markers?: VideoMarker[];
  score?: ScoreData;
  thumbnails?: string[]; // Pre-captured thumbnails for timeline
  thumbnailInterval?: number; // Interval between thumbnails in seconds
}

export interface VideoMarker {
  id: string;
  time: number;
  label: string;
  color: string;
  type: 'serve' | 'spike' | 'block' | 'dig' | 'set' | 'pitch' | 'hit' | 'steal' | 'out' | 'defense' | 'other';
}

export interface ScoreData {
  team1: number;
  team2: number;
  set?: number; // For volleyball
  inning?: number; // For baseball
}

type AppMode = 'sport-select' | 'select' | 'phone' | 'computer' | 'local' | 'review';

export default function App() {
  const [mode, setMode] = useState<AppMode>('sport-select');
  const [sport, setSport] = useState<SportType | null>(null);
  const [recordings, setRecordings] = useState<RecordedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<RecordedVideo | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobile);
      // Auto-select phone mode on mobile devices
      if (mobile && mode === 'select') {
        setMode('phone');
      }
    };
    checkMobile();
  }, [mode]);

  const handleVideoRecorded = (video: RecordedVideo) => {
    setRecordings(prev => [video, ...prev]);
    // 자동 녹화 모드가 아닐 때만 review 모드로 전환
    // 로컬 모드에서 자동 녹화 중에는 모드 전환하지 않음
  };

  const handleVideoRecordedAndReview = (video: RecordedVideo, isAutoMode?: boolean) => {
    setRecordings(prev => {
      const newRecordings = [video, ...prev];
      
      // 100개 이상이 되면 모두 삭제하고 새 영상만 저장
      if (newRecordings.length >= 100) {
        console.log('⚠️ 녹화 영상이 100개에 도달하여 모든 영상을 삭제합니다.');
        // Cleanup old blob URLs to prevent memory leaks
        prev.forEach(v => {
          if (v.url) {
            URL.revokeObjectURL(v.url);
          }
        });
        return [video];
      }
      
      return newRecordings;
    });
    // 자동 녹화 모드가 아닐 때만 review 모드로 전환
    if (!isAutoMode) {
      setSelectedVideo(video);
      setMode('review');
    }
  };

  const handleSelectVideo = (video: RecordedVideo) => {
    setSelectedVideo(video);
    setMode('review');
  };

  const handleBackToSelect = () => {
    setMode('select');
  };

  const handleBackToSportSelect = () => {
    setMode('sport-select');
    setSport(null);
  };

  // Filter recordings by current sport
  const filteredRecordings = sport 
    ? recordings.filter(r => r.sport === sport)
    : recordings;

  // Sport Selection Screen
  if (mode === 'sport-select') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10" />
            </div>
            <h1 className="text-3xl mb-3">스포츠 비디오 판독 시스템</h1>
            <p className="text-gray-400">Sports Video Review System</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Volleyball */}
            <button
              onClick={() => {
                setSport('volleyball');
                setMode('select');
              }}
              className="bg-gray-900 border-2 border-gray-800 hover:border-blue-600 rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
                <Volleyball className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl mb-2">배구</h2>
              <p className="text-sm text-gray-400 mb-4">
                서브, 스파이크, 블록킹, 디그, 세터 등 배구 전문 이벤트 마킹
              </p>
              <div className="text-xs text-blue-400">
                {recordings.filter(r => r.sport === 'volleyball').length}개 영상 저장됨
              </div>
            </button>

            {/* Baseball */}
            <button
              onClick={() => {
                setSport('baseball');
                setMode('select');
              }}
              className="bg-gray-900 border-2 border-gray-800 hover:border-orange-600 rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-16 h-16 bg-orange-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-600/30 transition-colors">
                <Trophy className="w-8 h-8 text-orange-400" />
              </div>
              <h2 className="text-2xl mb-2">야구</h2>
              <p className="text-sm text-gray-400 mb-4">
                투구, 타격, 도루, 아웃, 수비 등 야구 전문 이벤트 마킹
              </p>
              <div className="text-xs text-orange-400">
                {recordings.filter(r => r.sport === 'baseball').length}개 영상 저장됨
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mode Selection Screen
  if (mode === 'select') {
    const sportName = sport === 'volleyball' ? '배구' : '야구';
    const sportEmoji = sport === 'volleyball' ? '🏐' : '⚾';
    
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              {sport === 'volleyball' ? <Volleyball className="w-10 h-10" /> : <Trophy className="w-10 h-10" />}
            </div>
            <h1 className="text-3xl mb-3">{sportName} 비디오 판독 시스템</h1>
            <p className="text-gray-400">{sport === 'volleyball' ? 'Volleyball' : 'Baseball'} Video Review System</p>
            <button
              onClick={handleBackToSportSelect}
              className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
            >
              ← 스포츠 변경
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Phone Camera Mode */}
            <button
              onClick={() => setMode('phone')}
              className="bg-gray-900 border-2 border-gray-800 hover:border-blue-600 rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
                <Smartphone className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-xl mb-2">핸드폰 카메라</h2>
              <p className="text-sm text-gray-400 mb-4">
                핸드폰을 카메라로 사용하여 실시간 영상을 컴퓨터로 전송합니다
              </p>
              <div className="text-xs text-blue-400">→ 스트리밍 송신 모드</div>
            </button>

            {/* Computer Receiver Mode */}
            <button
              onClick={() => setMode('computer')}
              className="bg-gray-900 border-2 border-gray-800 hover:border-purple-600 rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-14 h-14 bg-purple-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600/30 transition-colors">
                <Monitor className="w-7 h-7 text-purple-400" />
              </div>
              <h2 className="text-xl mb-2">컴퓨터 수신</h2>
              <p className="text-sm text-gray-400 mb-4">
                핸드폰 카메라 영상을 받아서 녹화하고 판독합니다
              </p>
              <div className="text-xs text-purple-400">→ 수신 및 판독 모드</div>
            </button>

            {/* Local Camera Mode */}
            <button
              onClick={() => setMode('local')}
              className="bg-gray-900 border-2 border-gray-800 hover:border-green-600 rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-14 h-14 bg-green-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-600/30 transition-colors">
                <Camera className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-xl mb-2">로컬 카메라</h2>
              <p className="text-sm text-gray-400 mb-4">
                이 기기의 카메라를 직접 사용하여 녹화합니다
              </p>
              <div className="text-xs text-green-400">→ 로컬 녹화 모드</div>
            </button>

            {/* Review Mode */}
            <button
              onClick={() => filteredRecordings.length > 0 && setMode('review')}
              disabled={filteredRecordings.length === 0}
              className="bg-gray-900 border-2 border-gray-800 hover:border-orange-600 disabled:border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-14 h-14 bg-orange-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-600/30 transition-colors">
                <Video className="w-7 h-7 text-orange-400" />
              </div>
              <h2 className="text-xl mb-2">녹화 영상 판독</h2>
              <p className="text-sm text-gray-400 mb-4">
                저장된 영상을 프레임 단위로 분석합니다
              </p>
              <div className="text-xs text-orange-400">
                {filteredRecordings.length > 0 ? `${filteredRecordings.length}개 영상 저장됨` : '녹화된 영상 없음'}
              </div>
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-6">
            <h3 className="text-blue-400 mb-3">{sportEmoji} 사용 방법</h3>
            <ol className="text-sm text-gray-300 space-y-2">
              <li className="flex gap-3">
                <span className="text-blue-400 flex-shrink-0">1.</span>
                <span>핸드폰에서 이 웹앱을 열고 "핸드폰 카메라" 모드를 선택합니다</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 flex-shrink-0">2.</span>
                <span>컴퓨터에서 이 웹앱을 열고 "컴퓨터 수신" 모드를 선택합니다</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 flex-shrink-0">3.</span>
                <span>핸드폰에 표시된 연결 코드를 컴퓨터에 입력하여 연결합니다</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-400 flex-shrink-0">4.</span>
                <span>실시간으로 영상을 확인하며 녹화하고, 나중에 판독할 수 있습니다</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const sportName = sport === 'volleyball' ? '배구' : '야구';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              {sport === 'volleyball' ? <Volleyball className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
            </div>
            <div>
              <h1>{sportName} 비디오 판독</h1>
              <p className="text-sm text-gray-400">
                {mode === 'phone' && '핸드폰 카메라 모드'}
                {mode === 'computer' && '컴퓨터 수신 모드'}
                {mode === 'local' && '로컬 녹화 모드'}
                {mode === 'review' && '영상 판독 모드'}
              </p>
            </div>
          </div>
          <button
            onClick={handleBackToSelect}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            ← 모드 변경
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {mode === 'phone' && <PhoneCamera sport={sport!} />}
        
        {mode === 'computer' && (
          <ComputerReceiver sport={sport!} onVideoRecorded={handleVideoRecorded} />
        )}
        
        {mode === 'local' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h2 className="text-sm">녹화 영상</h2>
                  <p className="text-xs text-gray-400 mt-1">{filteredRecordings.length}개</p>
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {filteredRecordings.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">녹화된 영상 없음</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {filteredRecordings.map((video) => (
                        <button
                          key={video.id}
                          onClick={() => handleSelectVideo(video)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedVideo?.id === video.id
                              ? 'bg-blue-600/20 border border-blue-600'
                              : 'bg-gray-800 border border-gray-700 hover:bg-gray-750'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-12 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <Video className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {video.timestamp.toLocaleTimeString()}
                              </p>
                              <p className="text-xs text-gray-400">
                                {video.timestamp.toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {Math.round(video.duration)}초
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-9">
              <VideoCapture sport={sport!} onVideoRecorded={handleVideoRecordedAndReview} />
            </div>
          </div>
        )}
        
        {mode === 'review' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h2 className="text-sm">녹화 영상</h2>
                  <p className="text-xs text-gray-400 mt-1">{filteredRecordings.length}개</p>
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {filteredRecordings.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">녹화된 영상 없음</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {filteredRecordings.map((video) => (
                        <button
                          key={video.id}
                          onClick={() => handleSelectVideo(video)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedVideo?.id === video.id
                              ? 'bg-blue-600/20 border border-blue-600'
                              : 'bg-gray-800 border border-gray-700 hover:bg-gray-750'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-12 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <Video className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {video.timestamp.toLocaleTimeString()}
                              </p>
                              <p className="text-xs text-gray-400">
                                {video.timestamp.toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {Math.round(video.duration)}초
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-9">
              {selectedVideo ? (
                <VideoPlayer video={selectedVideo} />
              ) : (
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
                  <Video className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3>영상을 선택하세요</h3>
                  <p className="text-gray-400 mt-2">
                    왼쪽에서 판독할 영상을 선택하세요
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}