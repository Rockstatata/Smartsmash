import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook that manages the protocol canvas micro-animations.
 * Canvas 1: Rotating shuttlecock, Canvas 2: Scanning grid, Canvas 3: Waveform.
 */
export default function useProtocolCanvases(canvas1Ref, canvas2Ref, canvas3Ref) {
  const animFrames = useRef([]);

  const syncCanvasSize = useCallback((canvas, ctx) => {
    const rect = canvas.getBoundingClientRect();
    const displayW = Math.max(1, Math.round(rect.width));
    const displayH = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.max(1, Math.round(displayW * dpr));
    const pixelH = Math.max(1, Math.round(displayH * dpr));

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    return { w: displayW, h: displayH };
  }, []);

  const startCanvas1 = useCallback(() => {
    const canvas = canvas1Ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let angle = 0;

    function draw() {
      const { w, h } = syncCanvasSize(canvas, ctx);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);

      // Shuttlecock body (cone shape)
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(-12, 15);
      ctx.lineTo(12, 15);
      ctx.closePath();
      ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Feather lines
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.strokeStyle = 'rgba(201, 168, 76, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Cork
      ctx.beginPath();
      ctx.arc(0, 18, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 168, 76, 0.5)';
      ctx.fill();

      ctx.restore();

      // Orbit ring
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      angle += 0.015;
      animFrames.current[0] = requestAnimationFrame(draw);
    }

    draw();
  }, [canvas1Ref, syncCanvasSize]);

  const startCanvas2 = useCallback(() => {
    const canvas = canvas2Ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let scanY = 0;
    let time = 0;

    function draw() {
      const { w, h } = syncCanvasSize(canvas, ctx);
      ctx.clearRect(0, 0, w, h);

      // Draw court grid
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.1)';
      ctx.lineWidth = 0.5;
      for (let x = 20; x < w; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, h - 10); ctx.stroke();
      }
      for (let y = 20; y < h; y += 20) {
        ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 10, y); ctx.stroke();
      }

      // Scan line
      const scanLineY = 10 + (scanY % (h - 20));
      ctx.beginPath(); ctx.moveTo(10, scanLineY); ctx.lineTo(w - 10, scanLineY);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Scan glow
      const gradient = ctx.createLinearGradient(0, scanLineY - 15, 0, scanLineY + 5);
      gradient.addColorStop(0, 'rgba(201, 168, 76, 0)');
      gradient.addColorStop(0.8, 'rgba(201, 168, 76, 0.05)');
      gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(10, scanLineY - 15, w - 20, 20);

      // Pulsing node
      const nodeX = 20 + Math.floor(Math.sin(time * 0.02) * 2 + 2) * 20;
      const nodeY = 20 + Math.floor(Math.cos(time * 0.015) * 2 + 2) * 20;
      const pulseAlpha = 0.3 + Math.sin(time * 0.05) * 0.2;
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 168, 76, ${pulseAlpha})`;
      ctx.fill();

      scanY += 0.5;
      time++;
      animFrames.current[1] = requestAnimationFrame(draw);
    }

    draw();
  }, [canvas2Ref, syncCanvasSize]);

  const startCanvas3 = useCallback(() => {
    const canvas = canvas3Ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let time = 0;

    function draw() {
      const { w, h } = syncCanvasSize(canvas, ctx);
      ctx.clearRect(0, 0, w, h);

      // Waveform
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 +
          Math.sin((x + time) * 0.05) * 15 +
          Math.sin((x + time * 1.5) * 0.08) * 8 +
          Math.sin((x + time * 0.7) * 0.12) * 5;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Fill below
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, h / 2, 0, h);
      gradient.addColorStop(0, 'rgba(201, 168, 76, 0.08)');
      gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Center line
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Pulse dot
      const pulseX = w / 2;
      const pulseY = h / 2 +
        Math.sin((pulseX + time) * 0.05) * 15 +
        Math.sin((pulseX + time * 1.5) * 0.08) * 8 +
        Math.sin((pulseX + time * 0.7) * 0.12) * 5;

      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 168, 76, 0.8)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 168, 76, 0.1)';
      ctx.fill();

      time += 1;
      animFrames.current[2] = requestAnimationFrame(draw);
    }

    draw();
  }, [canvas3Ref, syncCanvasSize]);

  useEffect(() => {
    startCanvas1();
    startCanvas2();
    startCanvas3();

    const frames = animFrames.current;
    return () => {
      frames.forEach((id) => cancelAnimationFrame(id));
    };
  }, [startCanvas1, startCanvas2, startCanvas3]);
}
