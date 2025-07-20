'use client';

import React from 'react';

interface IconProps {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export default function Icon({
  src,
  alt,
  size = 'md',
  className = '',
}: IconProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClasses[size]} object-contain ${className}`}
      loading="lazy"
    />
  );
}
