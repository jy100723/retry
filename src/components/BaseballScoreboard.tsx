import { Plus, Minus } from 'lucide-react';

interface BaseballScoreboardProps {
  team1Score: number;
  team2Score: number;
  currentInning: number;
  onScoreChange: (team1: number, team2: number) => void;
  onInningChange: (inning: number) => void;
}

export function BaseballScoreboard({
  team1Score,
  team2Score,
  currentInning,
  onScoreChange,
  onInningChange
}: BaseballScoreboardProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Team 1 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-center mb-3">
            <div className="text-sm text-gray-400 mb-2">홈팀</div>
            <div className="text-4xl tabular-nums">{team1Score}</div>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onScoreChange(team1Score - 1, team2Score)}
              className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onScoreChange(team1Score + 1, team2Score)}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inning */}
        <div className="bg-orange-900/20 border border-orange-800/30 rounded-lg p-4">
          <div className="text-center mb-3">
            <div className="text-sm text-orange-400 mb-2">이닝</div>
            <div className="text-4xl tabular-nums">{currentInning}</div>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => currentInning > 1 && onInningChange(currentInning - 1)}
              disabled={currentInning <= 1}
              className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onInningChange(currentInning + 1)}
              className="w-8 h-8 bg-orange-600 hover:bg-orange-700 rounded flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Team 2 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-center mb-3">
            <div className="text-sm text-gray-400 mb-2">원정팀</div>
            <div className="text-4xl tabular-nums">{team2Score}</div>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onScoreChange(team1Score, team2Score - 1)}
              className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onScoreChange(team1Score, team2Score + 1)}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
