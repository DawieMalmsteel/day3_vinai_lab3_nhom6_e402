export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface Flight {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  date: string;
  price: number;
  departureTime: string;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  pricePerNight: number;
  rating: number;
  amenities: string[];
}

export interface DistanceInfo {
  origin: string;
  destination: string;
  distanceKm: number;
  travelTimeMinutes: number;
}
