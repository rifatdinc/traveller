
// Tarih formatlamak için yardımcı fonksiyon
export const formatTimestamp = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 60) {
    return `${diffMin} dakika önce`;
  } else if (diffMin < 1440) {
    const hours = Math.floor(diffMin / 60);
    return `${hours} saat önce`;
  } else {
    const days = Math.floor(diffMin / 1440);
    return `${days} gün önce`;
  }
};// İki nokta arasındaki mesafeyi km cinsinden hesaplar (Haversine formülü)

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Kilometre cinsinden mesafe
  return distance;
};

