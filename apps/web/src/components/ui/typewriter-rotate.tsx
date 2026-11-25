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
 * High-performance, clean rotating focal word display.
 */
export function TypewriterRotate({
  words,
  typingSpeed = 100,
  deletingSpeed = 140,
  pauseDuration = 3500,
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
    <span className={`inline-flex items-center tracking-tight select-none text-primary font-bold ${className}`}>
      <span>{currentText}</span>
      <span
        className={`inline-block w-[2px] h-[0.85em] ml-1 bg-primary align-middle ${cursorClassName}`}
        aria-hidden="true"
      />
    </span>
  );
}
