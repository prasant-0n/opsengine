"use client";

import React, { useEffect, useState } from "react";

interface TypewriterRotateProps {
  words: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
  cursorClassName?: string;
}

/**
 * High-performance, silky-smooth Typewriter with frame-optimized interval management.
 */
export function TypewriterRotate({
  words,
  typingSpeed = 120,
  deletingSpeed = 180,
  pauseDuration = 4200,
  className = "",
  cursorClassName = "",
}: TypewriterRotateProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const targetWord = words[currentWordIndex];

    const timer = setTimeout(
      () => {
        if (!isDeleting) {
          if (currentText.length < targetWord.length) {
            setCurrentText(targetWord.slice(0, currentText.length + 1));
          } else {
            setTimeout(() => setIsDeleting(true), pauseDuration);
          }
        } else {
          if (currentText.length > 0) {
            setCurrentText(targetWord.slice(0, currentText.length - 1));
          } else {
            setIsDeleting(false);
            setCurrentWordIndex((prev) => (prev + 1) % words.length);
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentWordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={`inline-flex items-center tracking-tight select-none ${className}`}>
      <span className="drop-shadow-[0_0_24px_rgba(56,189,248,0.3)]">
        {currentText}
      </span>
      <span
        className={`inline-block w-[3.5px] h-[0.88em] ml-1.5 bg-[#38bdf8] rounded-full align-middle animate-pulse shadow-[0_0_12px_#38bdf8] ${cursorClassName}`}
      />
    </span>
  );
}
