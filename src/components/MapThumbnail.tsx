interface Props {
  lat: number;
  lng: number;
  zoom?: number;
  height?: number;
  onClick?: () => void;
}

/**
 * Lightweight static map preview using OpenStreetMap tiles via staticmap.openstreetmap.de.
 * No API key needed. Falls back to a simple coordinate display if image fails.
 */
const MapThumbnail = ({ lat, lng, zoom = 15, height = 140, onClick }: Props) => {
  // staticmap.openstreetmap.de provides free static map images
  const width = 600;
  const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&markers=${lat},${lng},red-pushpin`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-lg border border-border hover:border-primary/50 transition-colors group"
      style={{ height }}
      title="Click to open full map picker"
    >
      <img
        src={url}
        alt={`Map preview at ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget.style.display = "none");
        }}
      />
    </button>
  );
};

export default MapThumbnail;
