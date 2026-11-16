"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * ShimmerButton - Aceternity / Magic UI inspired rotating rainbow border button
 */
export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    shimmerColor?: string;
    shimmerSize?: string;
    borderRadius?: string;
    shimmerDuration?: string;
    background?: string;
    className?: string;
    children?: React.ReactNode;
  }
>(
  (
    {
      shimmerColor = "#22d3ee",
      shimmerSize = "0.08em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(17, 19, 24, 0.95)",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
          } as React.CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-4 py-2.5 text-white [background:var(--bg)] [border-radius:var(--radius)] active:scale-95 transition-all duration-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
          className
        )}
        {...props}
      >
        {/* Spark container */}
        <div
          className={cn(
            "-z-30 blur-[2px]",
            "absolute inset-0 overflow-visible [container-type:size]"
          )}
        >
          {/* Spark element */}
          <div className="absolute inset-0 h-[100cqh] animate-spin-slow [aspect-ratio:1] [border-radius:0] [mask:none]">
            <div className="animate-spin-slow [background:conic-gradient(from_0deg_at_50%_50%,transparent_0,transparent_50deg,var(--shimmer-color)_110deg,transparent_160deg)] absolute -inset-[100%] w-auto rotate-0" />
          </div>
        </div>

        {/* Glow backdrop */}
        <div className="absolute [border-radius:var(--radius)] inset-[1px] -z-10 [background:var(--bg)] transition-colors duration-300 group-hover:bg-[#1a1e29]" />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </div>
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
