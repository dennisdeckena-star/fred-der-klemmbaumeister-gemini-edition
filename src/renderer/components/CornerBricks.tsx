import React from 'react';

/**
 * Dezente, lizenzfreie Vektor-Klemmbausteine in den Ecken (inspiriert von ui-vorlage.png).
 */
export function CornerBricks(): React.ReactElement {
  return (
    <div className="corner-bricks-layer" aria-hidden="true">
      {/* Top-right yellow & green bricks */}
      <svg className="corner-brick cb-top-right-1" viewBox="0 0 80 56">
        <polygon points="8,24 40,8 72,24 40,40" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
        <polygon points="8,24 40,40 40,52 8,36" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
        <polygon points="72,24 40,40 40,52 72,36" fill="#ca8a04" stroke="#a16207" strokeWidth="2" />
        <ellipse cx="32" cy="22" rx="7" ry="4" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
        <ellipse cx="48" cy="22" rx="7" ry="4" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
      </svg>

      <svg className="corner-brick cb-top-right-2" viewBox="0 0 80 56">
        <polygon points="8,24 40,8 72,24 40,40" fill="#65a30d" stroke="#3f6212" strokeWidth="2" />
        <polygon points="8,24 40,40 40,52 8,36" fill="#4d7c0f" stroke="#3f6212" strokeWidth="2" />
        <polygon points="72,24 40,40 40,52 72,36" fill="#3f6212" stroke="#365314" strokeWidth="2" />
        <ellipse cx="32" cy="22" rx="7" ry="4" fill="#84cc16" stroke="#3f6212" strokeWidth="1.5" />
        <ellipse cx="48" cy="22" rx="7" ry="4" fill="#84cc16" stroke="#3f6212" strokeWidth="1.5" />
      </svg>

      {/* Bottom-left yellow & red bricks */}
      <svg className="corner-brick cb-bottom-left-1" viewBox="0 0 80 56">
        <polygon points="8,24 40,8 72,24 40,40" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
        <polygon points="8,24 40,40 40,52 8,36" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
        <polygon points="72,24 40,40 40,52 72,36" fill="#ca8a04" stroke="#a16207" strokeWidth="2" />
        <ellipse cx="40" cy="24" rx="7" ry="4" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
      </svg>

      <svg className="corner-brick cb-bottom-left-2" viewBox="0 0 80 56">
        <polygon points="8,24 40,8 72,24 40,40" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
        <polygon points="8,24 40,40 40,52 8,36" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
        <polygon points="72,24 40,40 40,52 72,36" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2" />
        <ellipse cx="32" cy="22" rx="7" ry="4" fill="#f87171" stroke="#991b1b" strokeWidth="1.5" />
        <ellipse cx="48" cy="22" rx="7" ry="4" fill="#f87171" stroke="#991b1b" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
