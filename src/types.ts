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

export type BookingStep = 'idle' | 'route_detected' | 'asking_transport' | 'asking_passengers' | 'searching';

export interface TravelBookingState {
  step: BookingStep;
  originCity?: string;
  destinationCity?: string;
  transportMethod?: 'flight' | 'bus' | null;
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

// Trip Planner types
export interface ItineraryDay {
  day: number;
  date: string;
  activities: string[];
  meals: string[];
  accommodation: string;
  notes: string;
}

export interface TripPlan {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  itinerary: ItineraryDay[];
  estimatedBudget: number;
}

// Price Comparison types
export interface FlightPrice {
  airline: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  rating: number;
}

export interface PriceComparisonResult {
  route: string;
  date: string;
  flights: FlightPrice[];
  cheapest: FlightPrice;
  bestValue: FlightPrice;
}

// Restaurant Recommendation types
export interface Restaurant {
  id: string;
  name: string;
  city: string;
  cuisine: string;
  price: string;
  rating: number;
  address: string;
  bookingUrl: string;
}

export interface RestaurantRecommendation {
  city: string;
  cuisineType: string;
  restaurants: Restaurant[];
}

// Local Transport types
export interface TransportOption {
  type: 'taxi' | 'grab' | 'bus' | 'motorbike' | 'bicycle';
  estimatedPrice: number;
  estimatedTime: number;
  description: string;
}

export interface LocalTransportGuide {
  origin: string;
  destination: string;
  distanceKm: number;
  options: TransportOption[];
}

// Activity Suggestion types
export interface Activity {
  id: string;
  name: string;
  city: string;
  type: string;
  price: number;
  rating: number;
  description: string;
  duration: string;
  bookingUrl: string;
}

export interface ActivitySuggestions {
  city: string;
  activities: Activity[];
  totalActivities: number;
}
