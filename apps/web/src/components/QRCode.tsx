'use client';

import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface Props {
  data: string;
  size?: number;
  color?: string;
}

export default function QRCode({ data, size = 160, color = '#ffffff' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCodeLib.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 1,
      color: {
        dark: color,
        light: '#00000000',
      },
    });
  }, [data, size, color]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}