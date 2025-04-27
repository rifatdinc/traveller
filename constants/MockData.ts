// Mock data for the TravelPoints app
import { Colors } from './Colors';

// User profile mock data
export const currentUser = {
  id: 'user1',
  username: 'traveller123',
  email: 'user@example.com',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  totalPoints: 3450,
  level: 'Gezgin Ustası',
  rank: 24,
  visitedPlaces: 32,
  badges: [
    { id: 'b1', name: '10 Şehir Gezgini', icon: 'map' },
    { id: 'b2', name: 'Kültür Meraklısı', icon: 'building-columns' },
    { id: 'b3', name: 'Doğa Tutkunu', icon: 'tree' },
  ],
  friends: ['user2', 'user3', 'user4']
};

// Mock places data
export const places = [
  {
    id: 'place1',
    name: 'Ayasofya',
    type: 'Tarihi Yer',
    points: 200,
    location: { latitude: 41.008587, longitude: 28.980175 },
    city: 'İstanbul',
    description: 'Eski bir Ortodoks kilisesi, daha sonra cami, şimdi müze olan tarihi bir yapı.',
    image: 'https://images.unsplash.com/photo-1545809264-9e1b9a0c9267',
    visitedBy: 1243,
    rating: 4.8
  },
  {
    id: 'place2',
    name: 'Kapadokya',
    type: 'Doğa Rotası',
    points: 300,
    location: { latitude: 38.643056, longitude: 34.828889 },
    city: 'Nevşehir',
    description: 'Peribacaları ve sıcak hava balonlarıyla ünlü doğal güzellik.',
    image: 'https://images.unsplash.com/photo-1565874281049-1b984a50c314',
    visitedBy: 876,
    rating: 4.9
  },
  {
    id: 'place3',
    name: 'Kapalıçarşı',
    type: 'Turistik Merkez',
    points: 150,
    location: { latitude: 41.010700, longitude: 28.968020 },
    city: 'İstanbul',
    description: 'Dünyanın en büyük ve en eski kapalı çarşılarından biri.',
    image: 'https://images.unsplash.com/photo-1608835291093-394b4a3b8052',
    visitedBy: 2156,
    rating: 4.6
  },
  {
    id: 'place4',
    name: 'Pamukkale',
    type: 'Doğa Rotası',
    points: 250,
    location: { latitude: 37.9137, longitude: 29.1194 },
    city: 'Denizli',
    description: 'Travertenleriyle ünlü doğal ve tarihi bir merkez.',
    image: 'https://images.unsplash.com/photo-1589561253831-b8421dd58261',
    visitedBy: 945,
    rating: 4.7
  },
  {
    id: 'place5',
    name: 'Efes Antik Kenti',
    type: 'Tarihi Yer',
    points: 220,
    location: { latitude: 37.9396, longitude: 27.3415 },
    city: 'İzmir',
    description: 'Antik çağın en önemli şehirlerinden biri.',
    image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200',
    visitedBy: 1532,
    rating: 4.8
  },
  {
    id: 'place6',
    name: 'Hatay Gurme',
    type: 'Önerilen Restoran',
    points: 80,
    location: { latitude: 41.0451, longitude: 28.9862 },
    city: 'İstanbul',
    description: 'Otantik Hatay mutfağının en iyi temsilcilerinden.',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
    visitedBy: 567,
    rating: 4.4
  }
];

// Mock feed posts
export const feedPosts = [
  {
    id: 'post1',
    userId: 'user2',
    username: 'adventurer42',
    userAvatar: 'https://randomuser.me/api/portraits/women/42.jpg',
    placeId: 'place2',
    placeName: 'Kapadokya',
    image: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3',
    description: 'Hayatımın en güzel deneyimlerinden biri! Güneş doğarken balonda olmak inanılmazdı.',
    likes: 124,
    comments: 18,
    timestamp: '2 saat önce',
  },
  {
    id: 'post2',
    userId: 'user3',
    username: 'worldtraveler',
    userAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    placeId: 'place5',
    placeName: 'Efes Antik Kenti',
    image: 'https://images.unsplash.com/photo-1524414287218-3b423ece9f4a',
    description: 'Tarihin derinliklerine yolculuk. Burayı mutlaka ziyaret etmelisiniz!',
    likes: 98,
    comments: 7,
    timestamp: '1 gün önce',
  },
  {
    id: 'post3',
    userId: 'user4',
    username: 'naturelover',
    userAvatar: 'https://randomuser.me/api/portraits/women/22.jpg',
    placeId: 'place4',
    placeName: 'Pamukkale',
    image: 'https://images.unsplash.com/photo-1519451241324-20b4ea2c4220',
    description: 'Bu beyaz cennet gerçekten görülmeye değer. Su sıcaklığı harikaydı!',
    likes: 156,
    comments: 23,
    timestamp: '3 gün önce',
  }
];

// Mock leaderboard data
export const leaderboard = [
  { id: 'user5', username: 'explorer99', avatar: 'https://randomuser.me/api/portraits/men/22.jpg', points: 8750, level: 'Dünya Kaşifi' },
  { id: 'user6', username: 'travelqueen', avatar: 'https://randomuser.me/api/portraits/women/32.jpg', points: 7640, level: 'Gezgin Ustası' },
  { id: 'user7', username: 'wanderlust', avatar: 'https://randomuser.me/api/portraits/women/45.jpg', points: 6930, level: 'Gezgin Ustası' },
  { id: 'user8', username: 'roadrunner', avatar: 'https://randomuser.me/api/portraits/men/45.jpg', points: 5280, level: 'Turist Ustası' },
  { id: 'user9', username: 'globetrotter', avatar: 'https://randomuser.me/api/portraits/men/57.jpg', points: 4970, level: 'Turist Ustası' },
  { currentUser },
  { id: 'user10', username: 'nomad_life', avatar: 'https://randomuser.me/api/portraits/women/67.jpg', points: 3120, level: 'Turist' }
];

// Mock badges/achievements
export const allBadges = [
  { id: 'b1', name: '10 Şehir Gezgini', icon: 'map', description: '10 farklı şehir ziyaret edin', progress: 10, max: 10, earned: true },
  { id: 'b2', name: 'Kültür Meraklısı', icon: 'building-columns', description: '5 tarihi yer ziyaret edin', progress: 5, max: 5, earned: true },
  { id: 'b3', name: 'Doğa Tutkunu', icon: 'tree', description: '3 doğal park ziyaret edin', progress: 3, max: 3, earned: true },
  { id: 'b4', name: 'Gurme Keşifçi', icon: 'utensils', description: '10 yerel restoran ziyaret edin', progress: 6, max: 10, earned: false },
  { id: 'b5', name: 'Fotoğraf Ustası', icon: 'camera', description: '20 yer fotoğrafı paylaşın', progress: 12, max: 20, earned: false },
  { id: 'b6', name: 'Sosyal Kelebek', icon: 'user-friends', description: '10 arkadaş edinin', progress: 3, max: 10, earned: false },
  { id: 'b7', name: 'Macera Aşığı', icon: 'mountain', description: '3 ekstrem aktivite yapın', progress: 1, max: 3, earned: false },
  { id: 'b8', name: 'Dünya Vatandaşı', icon: 'globe', description: '3 farklı ülke ziyaret edin', progress: 1, max: 3, earned: false }
];

// Mock challenges/tasks
export const challenges = [
  { 
    id: 'c1', 
    title: 'Hafta Sonu Kaçamağı', 
    description: 'Bu hafta sonu bir doğa rotasını ziyaret edin ve fotoğraf paylaşın', 
    points: 500,
    type: 'Doğa',
    deadline: '2 gün kaldı',
    participants: 243,
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470'
  },
  { 
    id: 'c2', 
    title: 'Lezzet Avcısı', 
    description: 'Bu hafta 3 farklı yerel restoran ziyaret edin', 
    points: 450,
    type: 'Gastronomi',
    deadline: '5 gün kaldı',
    participants: 156,
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'
  },
  { 
    id: 'c3', 
    title: 'Kültür Turisti', 
    description: 'Bir müze ve tarihi yer ziyaret edin, bilgi paylaşımı yapın', 
    points: 600,
    type: 'Kültür',
    deadline: '1 hafta kaldı',
    participants: 329,
    image: 'https://images.unsplash.com/photo-1564419320461-6870880221ad'
  }
];

// Mock trip plans
export const tripPlans = [
  {
    id: 'trip1',
    title: '2 Günlük İstanbul Turu',
    description: 'Tarihi yarımadada kültür ve lezzet dolu bir gezi',
    places: ['place1', 'place3', 'place6'],
    totalPoints: 430,
    duration: '2 gün',
    budget: '1000 TL',
    category: 'Tarih ve Yemek',
    image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200'
  },
  {
    id: 'trip2',
    title: 'Kapadokya Hafta Sonu',
    description: 'Peribacaları, balon turu ve yerel lezzetler',
    places: ['place2'],
    totalPoints: 300,
    duration: '3 gün',
    budget: '2500 TL',
    category: 'Doğa ve Macera',
    image: 'https://images.unsplash.com/photo-1565874281049-1b984a50c314'
  },
  {
    id: 'trip3',
    title: 'Ege Kıyıları',
    description: 'Efes Antik Kenti ve Pamukkale turu',
    places: ['place4', 'place5'],
    totalPoints: 470,
    duration: '4 gün',
    budget: '3000 TL',
    category: 'Tarih ve Doğa',
    image: 'https://images.unsplash.com/photo-1589561253831-b8421dd58261'
  }
];

// Mock rewards
export const rewards = [
  {
    id: 'r1',
    title: 'Premium Sırt Çantası',
    points: 5000,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    provider: 'TravelGear',
    available: true
  },
  {
    id: 'r2',
    title: '%20 Otel İndirimi',
    points: 2500,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
    provider: 'HotelChain',
    available: true
  },
  {
    id: 'r3',
    title: 'Restoran Hediye Kartı',
    points: 1500,
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0',
    provider: 'FoodCo',
    available: true
  },
  {
    id: 'r4',
    title: 'Uçak Bileti İndirimi',
    points: 7500,
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05',
    provider: 'AirlinePartner',
    available: false
  }
];

// Import theme from separate file
import { THEME } from './Theme';
