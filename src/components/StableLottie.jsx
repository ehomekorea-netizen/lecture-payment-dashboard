import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';

const StableLottie = React.memo(({ path, className, speed = 1, loop = true, autoplay = true }) => {
  const [animationData, setAnimationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const lottieRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchLottie = async () => {
      try {
        setLoading(true);
        const response = await fetch(path);
        const json = await response.json();
        if (isMounted) {
          setAnimationData(json);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load lottie animation:', error);
        if (isMounted) setLoading(false);
      }
    };

    fetchLottie();

    return () => {
      isMounted = false;
    };
  }, [path]);

  const handleLoaded = () => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(speed);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse bg-slate-200 rounded-full ${className}`} style={{ minHeight: '24px', minWidth: '24px' }}></div>
    );
  }

  if (!animationData) {
    return null;
  }

  return (
    <Lottie 
      lottieRef={lottieRef}
      animationData={animationData} 
      className={className}
      loop={loop}
      autoplay={autoplay}
      onDOMLoaded={handleLoaded}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.path === nextProps.path && prevProps.className === nextProps.className;
});

export default StableLottie;
