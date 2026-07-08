import Image from 'next/image';

interface CloudinaryImageProps {
  publicId: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  quality?: number | 'auto';
  crop?: 'fill' | 'fit' | 'scale' | 'crop';
  gravity?: 'auto' | 'face' | 'center';
}

/**
 * Optimized image component using Cloudinary
 * Automatically applies f_auto (format) and q_auto (quality) transformations
 */
export default function CloudinaryImage({
  publicId,
  alt,
  width,
  height,
  className = '',
  quality = 'auto',
  crop = 'fit',
  gravity,
}: CloudinaryImageProps) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  // Build transformation string
  const transformations = [];
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (crop) transformations.push(`c_${crop}`);
  if (gravity) transformations.push(`g_${gravity}`);
  transformations.push('f_auto'); // Auto format (WebP, AVIF)
  transformations.push(`q_${quality}`); // Auto quality optimization
  
  const transformation = transformations.join(',');
  const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
  
  if (width && height) {
    return (
      <Image
        src={imageUrl}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading="lazy"
      />
    );
  }
  
  // Fallback to regular img tag if dimensions not specified
  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}
