import { useState, useEffect } from 'react';

export default function CoolLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          return 0;
        }
        return prev + Math.random() * 1.5 + 0.8;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-80">
        {/* Progress bar */}
        <div className="relative w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Percentage and loading text */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm font-medium text-gray-600">Loading...</span>
          <span className="text-sm font-medium text-gray-800">
            {Math.floor(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
}