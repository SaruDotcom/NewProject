import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

type BusinessLogoProps = {
  src?: string;
  name: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export default function BusinessLogo({
  src,
  name,
  className = '',
  imageClassName = '',
  fallbackClassName = '',
}: BusinessLogoProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <span role="img" aria-label={`${name} logo`} className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className={`h-full w-full object-contain ${imageClassName}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2 className={`h-1/2 w-1/2 ${fallbackClassName}`} />
      )}
    </span>
  );
}
