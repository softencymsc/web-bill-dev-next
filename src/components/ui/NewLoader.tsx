import React from "react";
import { motion } from "framer-motion";

const NewLoader = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-100">
      <motion.div
        className="relative w-24 h-24"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: "linear", duration: 2 }}
      >
        <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 border-solid animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-t-4 border-purple-500 border-solid animate-spin-reverse"></div>
      </motion.div>
    </div>
  );
};

export default NewLoader;

// Tailwind additional utilities required:
// .animate-spin-reverse {
//   animation: spinReverse 1s linear infinite;
// }
// @keyframes spinReverse {
//   0% { transform: rotate(0deg); }
//   100% { transform: rotate(-360deg);