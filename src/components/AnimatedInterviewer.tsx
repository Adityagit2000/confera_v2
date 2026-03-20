import { useEffect, useRef, useState } from 'react';

interface Props {
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
}

const AnimatedInterviewer = ({ isSpeaking, isListening, isThinking }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const blinkTimerRef = useRef<number>(0);
  const blinkStateRef = useRef<'open' | 'closing' | 'closed' | 'opening'>('open');
  const blinkProgressRef = useRef<number>(0);
  const mouthOpenRef = useRef<number>(0);
  const mouthTargetRef = useRef<number>(0);
  const headTiltRef = useRef<number>(0);
  const headTiltTargetRef = useRef<number>(0);
  const browRaiseRef = useRef<number>(0);
  const browRaiseTargetRef = useRef<number>(0);
  const nodProgressRef = useRef<number>(0);
  const nodActiveRef = useRef<boolean>(false);
  const eyeGazeXRef = useRef<number>(0);
  const eyeGazeYRef = useRef<number>(0);
  const eyeGazeTargetXRef = useRef<number>(0);
  const eyeGazeTargetYRef = useRef<number>(0);
  const gazeTimerRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const draw = (timestamp: number) => {
      const dt = Math.min((timestamp - timeRef.current) / 1000, 0.05);
      timeRef.current = timestamp;

      ctx.clearRect(0, 0, W, H);

      // ── State targets ──
      if (isSpeaking) {
        mouthTargetRef.current = 0.3 + Math.abs(Math.sin(timestamp * 0.008)) * 0.5;
        headTiltTargetRef.current = Math.sin(timestamp * 0.0012) * 4;
        browRaiseTargetRef.current = 0.15;
        if (!nodActiveRef.current && Math.random() < 0.002) {
          nodActiveRef.current = true;
          nodProgressRef.current = 0;
        }
      } else if (isListening) {
        mouthTargetRef.current = 0.05;
        headTiltTargetRef.current = Math.sin(timestamp * 0.0008) * 6;
        browRaiseTargetRef.current = 0.25;
        if (!nodActiveRef.current && Math.random() < 0.003) {
          nodActiveRef.current = true;
          nodProgressRef.current = 0;
        }
      } else if (isThinking) {
        mouthTargetRef.current = 0.02;
        headTiltTargetRef.current = -8;
        browRaiseTargetRef.current = 0.4;
      } else {
        mouthTargetRef.current = 0;
        headTiltTargetRef.current = 0;
        browRaiseTargetRef.current = 0;
      }

      // ── Smooth lerps ──
      mouthOpenRef.current = lerp(mouthOpenRef.current, mouthTargetRef.current, dt * 12);
      headTiltRef.current = lerp(headTiltRef.current, headTiltTargetRef.current, dt * 3);
      browRaiseRef.current = lerp(browRaiseRef.current, browRaiseTargetRef.current, dt * 5);

      // ── Nod animation ──
      let nodOffset = 0;
      if (nodActiveRef.current) {
        nodProgressRef.current += dt * 3;
        nodOffset = Math.sin(nodProgressRef.current * Math.PI) * 8;
        if (nodProgressRef.current >= 1) nodActiveRef.current = false;
      }

      // ── Eye gaze ──
      gazeTimerRef.current -= dt;
      if (gazeTimerRef.current <= 0) {
        eyeGazeTargetXRef.current = (Math.random() - 0.5) * 4;
        eyeGazeTargetYRef.current = (Math.random() - 0.5) * 3;
        gazeTimerRef.current = 1.5 + Math.random() * 2;
      }
      eyeGazeXRef.current = lerp(eyeGazeXRef.current, eyeGazeTargetXRef.current, dt * 3);
      eyeGazeYRef.current = lerp(eyeGazeYRef.current, eyeGazeTargetYRef.current, dt * 3);

      // ── Blink ──
      blinkTimerRef.current -= dt;
      if (blinkTimerRef.current <= 0 && blinkStateRef.current === 'open') {
        blinkStateRef.current = 'closing';
        blinkTimerRef.current = 2.5 + Math.random() * 3;
      }
      if (blinkStateRef.current === 'closing') {
        blinkProgressRef.current = Math.min(blinkProgressRef.current + dt * 18, 1);
        if (blinkProgressRef.current >= 1) { blinkStateRef.current = 'closed'; }
      } else if (blinkStateRef.current === 'closed') {
        blinkProgressRef.current = Math.max(blinkProgressRef.current - dt * 14, 0);
        if (blinkProgressRef.current <= 0) { blinkStateRef.current = 'open'; }
      }

      // ── Transform for head tilt + nod ──
      ctx.save();
      ctx.translate(W / 2, H / 2 + nodOffset);
      ctx.rotate((headTiltRef.current * Math.PI) / 180);
      ctx.translate(-W / 2, -H / 2 - nodOffset);

      const cx = W / 2;
      const cy = H / 2 + nodOffset;

      // ── Suit / body ──
      const bodyGrad = ctx.createLinearGradient(cx - 60, cy + 95, cx + 60, cy + 180);
      bodyGrad.addColorStop(0, '#1e293b');
      bodyGrad.addColorStop(1, '#0f172a');
      ctx.beginPath();
      ctx.moveTo(cx - 65, H);
      ctx.lineTo(cx - 55, cy + 95);
      ctx.quadraticCurveTo(cx, cy + 115, cx + 55, cy + 95);
      ctx.lineTo(cx + 65, H);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Shirt
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy + 95);
      ctx.lineTo(cx - 10, H);
      ctx.lineTo(cx + 10, H);
      ctx.lineTo(cx + 18, cy + 95);
      ctx.closePath();
      ctx.fillStyle = '#f8fafc';
      ctx.fill();

      // Tie
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 98);
      ctx.lineTo(cx + 5, cy + 98);
      ctx.lineTo(cx + 8, cy + 140);
      ctx.lineTo(cx, cy + 155);
      ctx.lineTo(cx - 8, cy + 140);
      ctx.closePath();
      ctx.fillStyle = isSpeaking ? '#3b82f6' : '#1d4ed8';
      ctx.fill();

      // ── Neck ──
      ctx.beginPath();
      ctx.ellipse(cx, cy + 82, 16, 20, 0, 0, Math.PI * 2);
      const skinGrad = ctx.createRadialGradient(cx - 5, cy + 75, 2, cx, cy + 82, 20);
      skinGrad.addColorStop(0, '#fcd9b0');
      skinGrad.addColorStop(1, '#e8a870');
      ctx.fillStyle = skinGrad;
      ctx.fill();

      // ── Head ──
      const headGrad = ctx.createRadialGradient(cx - 15, cy - 25, 10, cx, cy - 10, 75);
      headGrad.addColorStop(0, '#fde8c8');
      headGrad.addColorStop(0.7, '#f5c492');
      headGrad.addColorStop(1, '#e0a060');
      ctx.beginPath();
      ctx.ellipse(cx, cy - 10, 68, 78, 0, 0, Math.PI * 2);
      ctx.fillStyle = headGrad;
      ctx.fill();

      // ── Hair ──
      ctx.beginPath();
      ctx.ellipse(cx, cy - 68, 68, 28, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 62, cy - 32, 12, 28, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 62, cy - 32, 12, 28, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();

      // ── Ears ──
      ctx.beginPath();
      ctx.ellipse(cx - 67, cy - 8, 9, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f0b07a';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 67, cy - 8, 9, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f0b07a';
      ctx.fill();

      // ── Eyebrows ──
      const browY = cy - 38 - browRaiseRef.current * 8;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      // Left brow
      ctx.beginPath();
      ctx.moveTo(cx - 42, browY + (isThinking ? -4 : 0));
      ctx.quadraticCurveTo(cx - 28, browY - 5, cx - 14, browY);
      ctx.strokeStyle = '#2d1a0e';
      ctx.stroke();
      // Right brow
      ctx.beginPath();
      ctx.moveTo(cx + 14, browY);
      ctx.quadraticCurveTo(cx + 28, browY - 5, cx + 42, browY + (isThinking ? -4 : 0));
      ctx.stroke();

      // ── Eyes ──
      const eyeLY = cy - 20;
      const eyeRY = cy - 20;
      const eyeLX = cx - 26;
      const eyeRX = cx + 26;
      const eyelidClose = blinkProgressRef.current;

      // Eye whites
      ctx.beginPath();
      ctx.ellipse(eyeLX, eyeLY, 16, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(eyeRX, eyeRY, 16, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Irises
      const gazeX = eyeGazeXRef.current;
      const gazeY = eyeGazeYRef.current;
      ctx.beginPath();
      ctx.ellipse(eyeLX + gazeX, eyeLY + gazeY, 8, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3b5bdb';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(eyeRX + gazeX, eyeRY + gazeY, 8, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3b5bdb';
      ctx.fill();

      // Pupils
      ctx.beginPath();
      ctx.ellipse(eyeLX + gazeX, eyeLY + gazeY, 4, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(eyeRX + gazeX, eyeRY + gazeY, 4, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();

      // Eye shine
      ctx.beginPath();
      ctx.ellipse(eyeLX + gazeX + 3, eyeLY + gazeY - 3, 2, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(eyeRX + gazeX + 3, eyeRY + gazeY - 3, 2, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();

      // Eyelids (blink)
      if (eyelidClose > 0) {
        ctx.beginPath();
        ctx.ellipse(eyeLX, eyeLY, 16, 12 * eyelidClose, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = '#f5c492';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(eyeRX, eyeRY, 16, 12 * eyelidClose, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = '#f5c492';
        ctx.fill();
      }

      // ── Nose ──
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.quadraticCurveTo(cx + 6, cy + 12, cx + 10, cy + 18);
      ctx.quadraticCurveTo(cx, cy + 22, cx - 10, cy + 18);
      ctx.quadraticCurveTo(cx - 6, cy + 12, cx, cy - 5);
      ctx.strokeStyle = 'rgba(180,100,50,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Mouth ──
      const mouthY = cy + 42;
      const mouthOpen = mouthOpenRef.current;
      const mouthW = 28;

      // Lips
      ctx.beginPath();
      ctx.moveTo(cx - mouthW, mouthY);
      ctx.quadraticCurveTo(cx, mouthY - 5 + mouthOpen * 8, cx + mouthW, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + 10 + mouthOpen * 22, cx - mouthW, mouthY);
      ctx.closePath();
      ctx.fillStyle = '#c0705a';
      ctx.fill();

      // Mouth interior when open
      if (mouthOpen > 0.1) {
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + mouthOpen * 8, mouthW * 0.7, mouthOpen * 12, 0, 0, Math.PI);
        ctx.fillStyle = '#4a1010';
        ctx.fill();
        // Teeth
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + mouthOpen * 4, mouthW * 0.6, mouthOpen * 5, 0, 0, Math.PI);
        ctx.fillStyle = '#f8f8f8';
        ctx.fill();
      }

      // Upper lip line
      ctx.beginPath();
      ctx.moveTo(cx - mouthW, mouthY);
      ctx.quadraticCurveTo(cx - 8, mouthY - 8, cx, mouthY - 6);
      ctx.quadraticCurveTo(cx + 8, mouthY - 8, cx + mouthW, mouthY);
      ctx.strokeStyle = '#a05a48';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Smile lines
      ctx.beginPath();
      ctx.arc(cx - mouthW + 4, mouthY + 2, 6, -0.5, 0.8);
      ctx.strokeStyle = 'rgba(180,100,50,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + mouthW - 4, mouthY + 2, 6, Math.PI - 0.8, Math.PI + 0.5);
      ctx.stroke();

      ctx.restore();

      // ── Ambient glow based on state ──
      if (isSpeaking) {
        const glow = ctx.createRadialGradient(cx, cy, 60, cx, cy, 160);
        glow.addColorStop(0, 'rgba(59,130,246,0.08)');
        glow.addColorStop(1, 'rgba(59,130,246,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
      } else if (isListening) {
        const glow = ctx.createRadialGradient(cx, cy, 60, cx, cy, 160);
        glow.addColorStop(0, 'rgba(34,197,94,0.06)');
        glow.addColorStop(1, 'rgba(34,197,94,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
      }

      // ── Speaking audio waveform bars below face ──
      if (isSpeaking) {
        const barCount = 12;
        const barW = 4;
        const barGap = 7;
        const totalW = barCount * (barW + barGap);
        const startX = cx - totalW / 2;
        const baseY = cy + 135;
        for (let i = 0; i < barCount; i++) {
          const barH = 4 + Math.abs(Math.sin(timestamp * 0.006 + i * 0.7)) * 18;
          const barGrad = ctx.createLinearGradient(0, baseY - barH, 0, baseY);
          barGrad.addColorStop(0, '#3b82f6');
          barGrad.addColorStop(1, 'rgba(59,130,246,0.2)');
          ctx.beginPath();
          ctx.roundRect(startX + i * (barW + barGap), baseY - barH, barW, barH, 2);
          ctx.fillStyle = barGrad;
          ctx.fill();
        }
      }

      // ── Listening pulse ring ──
      if (isListening) {
        const pulseScale = 1 + Math.sin(timestamp * 0.004) * 0.06;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 78 * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34,197,94,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Thinking dots ──
      if (isThinking) {
        const dotCount = 3;
        for (let i = 0; i < dotCount; i++) {
          const dotX = cx - 20 + i * 20;
          const dotY = cy + 138 + Math.sin(timestamp * 0.005 + i * 1.2) * 5;
          const alpha = 0.4 + Math.sin(timestamp * 0.005 + i * 1.2) * 0.6;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167,139,250,${alpha})`;
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isSpeaking, isListening, isThinking]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={340}
      className="drop-shadow-2xl"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
};

export default AnimatedInterviewer;
