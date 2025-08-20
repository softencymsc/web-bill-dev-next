"use client";
import React from 'react';
import Image from 'next/image';

interface LoaderProps {
  logoSrc?: string; // Optional, defaults to /msc.png
  altText?: string;
  size?: number; // Size of the logo in pixels
}

const Loader: React.FC<LoaderProps> = ({ logoSrc = "/msc.png", altText = "Loading", size = 45 }) => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative flex items-center justify-center">
        {/* Rotating border */}
        <div
          className="absolute rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-transparent border-l-transparent"
          style={{
            width: size + 4,
            height: size + 4,
            animation: 'spin 1.5s linear infinite',
          }}
        ></div>
        {/* Centered logo with subtle pulse */}
        <Image
          src={logoSrc}
          alt={altText}
          width={size}
          height={size}
          className="rounded-full object-contain animate-pulse"
        />
      </div>
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Loader;