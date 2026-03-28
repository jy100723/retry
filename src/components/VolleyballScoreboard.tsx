import { Plus, Minus, RotateCcw } from 'lucide-react';

interface VolleyballScoreboardProps {
  team1Score: number;
  team2Score: number;
  currentSet: number;
  onScoreChange: (team1: number, team2: number) => void;
  onSetChange: (set: number) => void;
}

export function VolleyballScoreboard({
  team1Score,
  team2Score,
  currentSet,
  onScoreChange,
  onSetChange
}: VolleyballScoreboardProps) {
  const incrementScore = (team: 1 | 2) => {
    if (team === 1) {
      onScoreChange(team1Score + 1, team2Score);
    } else {
      onScoreChange(team1Score, team2Score + 1);
    }
  };

  const decrementScore = (team: 1 | 2) => {
    if (team === 1) {
      onScoreChange(Math.max(0, team1Score - 1), team2Score);
    } else {
      onScoreChange(team1Score, Math.max(0, team2Score - 1));
    }
  };

  const resetScores = () => {
    onScoreChange(0, 0);
  };

  const nextSet = () => {
    onSetChange(currentSet + 1);
    onScoreChange(0, 0);
  };

  const previousSet = () => {
    onSetChange(Math.max(1, currentSet - 1));
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/30 rounded-xl p-6">
      <div className="grid grid-cols-3 gap-6 items-center">
        {/* Team 1 */}
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">Team 1</div>
          <div className="text-6xl mb-4 tabular-nums">{team1Score}</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => decrementScore(1)}
              className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={() => incrementScore(1)}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Set Info */}
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">세트</div>
          <div className="text-4xl mb-4 tabular-nums">{currentSet}</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={previousSet}
              disabled={currentSet <= 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
            >
              ← 이전
            </button>
            <button
              onClick={resetScores}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-1 text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              초기화
            </button>
            <button
              onClick={nextSet}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              다음 →
            </button>
          </div>
        </div>

        {/* Team 2 */}
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">Team 2</div>
          <div className="text-6xl mb-4 tabular-nums">{team2Score}</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => decrementScore(2)}
              className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={() => incrementScore(2)}
              className="w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Match Info */}
      <div className="mt-6 pt-6 border-t border-gray-700/50 text-center">
        <div className="text-xs text-gray-400">
          🏐 세트 점수를 실시간으로 기록하고 영상과 함께 분석하세요
        </div>
      </div>
    </div>
  );
}
