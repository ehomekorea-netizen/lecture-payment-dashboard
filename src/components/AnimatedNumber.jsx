import React, { useState, useEffect, useRef, useMemo } from 'react';

const digitStyle = {
  display: 'inline-block',
  height: '1em',
  overflow: 'hidden',
  verticalAlign: 'bottom',
};

const columnStyle = {
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
};

const cellStyle = {
  height: '1em',
  lineHeight: '1em',
  textAlign: 'center',
};

function AnimatedNumber({ value, prefix = '', suffix = '원', className, style, duration = 800 }) {
  const ref = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setVisible(true);
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  const formatted = useMemo(() => {
    const num = Math.round(Math.abs(value));
    return num.toLocaleString('en-US');
  }, [value]);

  const chars = formatted.split('');

  const transitionDuration = `${duration}ms`;

  return (
    <span ref={ref} className={className} style={{ display: 'inline-flex', ...style }}>
      {prefix && <span>{prefix}</span>}
      {chars.map((char, i) => {
        if (char === ',') {
          return <span key={`sep-${i}`}>,</span>;
        }
        const digit = parseInt(char, 10);
        const offset = visible ? -digit : -10;
        return (
          <span key={`d-${i}`} style={digitStyle}>
            <span
              style={{
                ...columnStyle,
                transitionDuration,
                transitionDelay: `${i * 40}ms`,
                transform: `translateY(${offset}em)`,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <span key={n} style={cellStyle}>{n}</span>
              ))}
              {/* Hidden slot below 9 — starting position when not visible */}
              <span style={cellStyle}>&nbsp;</span>
            </span>
          </span>
        );
      })}
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

export default AnimatedNumber;
