import React from 'react';

const BrandMark = ({ light = false, compact = false }) => (
  <div className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`}>
    <div className="brand-mark__icon" aria-hidden="true">D</div>
    {!compact && (
      <div className="brand-mark__text">
        <span className="brand-mark__name" style={light ? { color: 'var(--ink-on-brand)' } : undefined}>
          DocNet
        </span>
        <span
          className="brand-mark__tagline"
          style={light ? { color: 'rgba(244, 251, 249, 0.82)' } : undefined}
        >
          Care, Connected
        </span>
      </div>
    )}
  </div>
);

export default BrandMark;
