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

export interface BookingOption {
  provider: string;
  url: string;
  price?: string;
  duration?: string;
  departureTime?: string;
}

export type BookingStep = 'idle' | 'route_detected' | 'asking_transport' | 'asking_date' | 'asking_passengers' | 'searching';

export interface TravelBookingState {
  step: BookingStep;
  originCity?: string;
  destinationCity?: string;
  transportMethod?: 'flight' | 'bus' | null;
  departureDate?: string;
  passengerCount?: number;
  bookingResults?: BookingOption[];
}

// Hotel search types
export type HotelSearchType = 'quick' | 'smart' | 'detailed' | null;
export type HotelLocation = 'beach' | 'city' | 'quiet' | 'budget' | null;
export type PriceRange = 'budget' | 'mid' | 'luxury' | null;

export interface HotelSearchState {
  searchType: HotelSearchType;
  location?: HotelLocation;
  priceRange?: PriceRange;
  city?: string;
  step: 'idle' | 'asking_type' | 'asking_location' | 'asking_price' | 'searching';
}

export interface HotelOption {
  id: string;
  name: string;
  city: string;
  url: string;
  pricePerNight: string;
  rating: number;
  location: HotelLocation;
}
