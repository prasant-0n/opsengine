import * as React from "react";

export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="14" fill="#3B5BF5" />
      <circle cx="32" cy="32" r="13.5" fill="none" stroke="#FFFFFF" strokeWidth="5" />
      <g stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round">
        <line x1="48" y1="32" x2="54" y2="32" />
        <line x1="43.31" y1="43.31" x2="47.56" y2="47.56" />
        <line x1="32" y1="48" x2="32" y2="54" />
        <line x1="20.69" y1="43.31" x2="16.44" y2="47.56" />
        <line x1="16" y1="32" x2="10" y2="32" />
        <line x1="20.69" y1="20.69" x2="16.44" y2="16.44" />
        <line x1="32" y1="16" x2="32" y2="10" />
        <line x1="43.31" y1="20.69" x2="47.56" y2="16.44" />
      </g>
      <circle cx="32" cy="32" r="4.5" fill="#38BDF8" />
    </svg>
  );
}

export function BrandLockup({
  env,
  size = 32,
}: {
  env?: string;
  size?: number;
}) {
  return (
    <div className="brand-lockup">
      <BrandMark size={size} />
      <div className="brand-lockup-text">
        <span className="brand-name">
          Ops<span className="brand-name-accent">Engine</span>
        </span>
        {env ? <span className="brand-env">{env}</span> : null}
      </div>
    </div>
  );
}
