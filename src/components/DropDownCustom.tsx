"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoChevronDownOutline } from "react-icons/io5";

type DropdownProps = {
  items: { value: string; label: string }[];
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  initial?: string;
  placeholder?: string;
};

const DropdownSelect: React.FC<DropdownProps> = ({
  items,
  name,
  value,
  onChange,
  initial,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    items.find((item) => item.value === value)?.label ||
    initial ||
    placeholder ||
    "";

  const handleSelect = (selectedValue: string) => {
    const syntheticEvent = {
      target: { name, value: selectedValue },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <div
        onClick={() => setOpen((prev) => !prev)}
        className={`cursor-pointer flex justify-between items-center bg-white border  ${open?"border-blue-700":"border-gray-200"} rounded-lg px-4 py-3 text-sm font-medium text-gray-800 shadow-sm hover:shadow-md transition-all duration-300 ease-out ${
          open ? "border-blue-500 shadow-md" : ""
        }`}
      >
        <span className="truncate">{selectedLabel}</span>
        <motion.span
          className="ml-2 pl-3 text-gray-500 flex items-center"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
            mass: 0.5,
          }}
        >
          <IoChevronDownOutline className={`${open?"rotate-180":"rotate-0"} duration-200 ease-in-out`} size={18} />
        </motion.span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="absolute w-full mt-2 bg-white border border-gray-100 rounded-lg shadow-lg z-10 h-fit overflow-hidden"
          >
            {items.map((item, index) => (
              <motion.div
                key={index}
                onClick={() => handleSelect(item.value)}
                whileHover={{ backgroundColor: "#f8fafc", x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="px-4 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:font-medium rounded transition-all duration-200 text-sm"
              >
                {item.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DropdownSelect;