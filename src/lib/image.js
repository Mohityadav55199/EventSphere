// Adds Cloudinary delivery transforms (auto format, auto quality, resized width) to an image URL.
// Non-Cloudinary URLs and already-transformed URLs are returned unchanged.
export function optimizeImage(url, width = 600) {
  if (!url || typeof url !== "string") return url;
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return url;
  const [head, tail] = url.split(marker);
  if (/^(f_|q_|w_|c_)/.test(tail)) return url;
  return `${head}${marker}f_auto,q_auto,w_${width},c_limit/${tail}`;
}
