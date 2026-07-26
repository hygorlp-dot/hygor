// Imagem responsiva com suporte a AVIF/WebP + fallback, srcset/sizes e
// dimensões declaradas (evita layout shift). Usada quando `localSource`
// já existe em landingMedia.js; enquanto não existir, as seções usam
// MediaPlaceholder no lugar.
//
// `src` aceita uma string (fallback único) ou um objeto:
// { avif, webp, fallback, srcSet, sizes }
export default function ResponsiveImage({ src, alt, width, height, sizes, className = "", loading = "lazy" }) {
  const sources = typeof src === "string" ? { fallback: src } : src || {};
  return (
    <picture>
      {sources.avif && <source type="image/avif" srcSet={sources.avif} sizes={sizes}/>}
      {sources.webp && <source type="image/webp" srcSet={sources.webp} sizes={sizes}/>}
      <img
        src={sources.fallback}
        srcSet={sources.srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
