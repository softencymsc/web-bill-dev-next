'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import ScreenSaver from './ScreenSaver';

const ScreenSaverWrapper: React.FC = () => {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeout = 60000; // 60 seconds in milliseconds

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), idleTimeout);
    };

    // Add event listeners for user activity
    const events = ['click', 'touchstart', 'mousemove', 'keydown', "scroll", "mouseenter"];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));

    // Start the timer initially
    timer = setTimeout(() => setIsIdle(true), idleTimeout);

    // Cleanup
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer));
      clearTimeout(timer);
    };
  }, []);

  const handleScreenSaverHide = () => {
    setIsIdle(false);
  };

  return (
    <AnimatePresence>
      {isIdle && <ScreenSaver onHide={handleScreenSaverHide} />}
    </AnimatePresence>
  );
};

export default ScreenSaverWrapper;