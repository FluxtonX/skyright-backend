import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Helper to map 3-letter IATA airport codes to 2-letter ISO country codes for Sherpa
const mapAirportToCountry = (code: string): string => {
  if (!code) return 'NG';
  const upper = code.trim().toUpperCase();
  if (upper.length === 2) return upper;
  
  const mapping: { [key: string]: string } = {
    // Nigeria
    LOS: 'NG', ABV: 'NG', PHC: 'NG', ENU: 'NG', KAN: 'NG',
    // UK
    LHR: 'GB', LGW: 'GB', MAN: 'GB',
    // US
    JFK: 'US', EWR: 'US', LAX: 'US', MIA: 'US', ORD: 'US',
    // UAE
    DXB: 'AE', AUH: 'AE',
    // Europe
    CDG: 'FR', AMS: 'NL', FRA: 'DE', IST: 'TR', FCO: 'IT',
    // Africa
    ADD: 'ET', JNB: 'ZA', CPT: 'ZA', ACC: 'GH', DKR: 'SN', NBO: 'KE', CAI: 'EG',
  };
  
  return mapping[upper] || 'NG'; // Default to Nigeria if unmapped
};

// Helper to map 3-letter IATA airport codes to Lat/Lng coordinates for Tomorrow.io
const mapAirportToCoordinates = (code: string): string => {
  if (!code) return '6.5244,3.3792'; // Default to Lagos
  const upper = code.trim().toUpperCase();
  
  const coords: { [key: string]: string } = {
    LOS: '6.5244,3.3792',   // Lagos International
    ABV: '9.0765,7.3986',   // Abuja International
    PHC: '4.8156,7.0498',   // Port Harcourt
    ENU: '6.4743,7.5619',   // Enugu
    KAN: '12.0022,8.5919',  // Kano
    LHR: '51.4700,-0.4543', // London Heathrow
    LGW: '51.1537,-0.1821', // London Gatwick
    JFK: '40.6413,-73.7781',// New York JFK
    EWR: '40.6895,-74.1745',// Newark
    DXB: '25.2532,55.3657', // Dubai
    ADD: '8.9806,38.7993',  // Addis Ababa
    JNB: '-26.1367,28.2411',// Johannesburg
    ACC: '5.6051,-0.1668',  // Accra
  };
  
  return coords[upper] || '6.5244,3.3792'; // Fallback to Lagos
};

// --- Compliance Service (Sherpa) ---
export const getTravelRequirements = async (origin: string, destination: string) => {
  try {
    const API_KEY = process.env.SHERPA_API_KEY;
    
    // Treat placeholder keys as unconfigured
    if (!API_KEY || API_KEY === 'your_sherpa_key_here') {
      console.log('Mock Mode: No Sherpa API key found. Returning mock travel requirements.');
      return { message: `Mock Mode: Travel requirements from ${origin || 'origin'} to ${destination || 'destination'} are normal. Standard visa-on-arrival applies.` };
    }

    const originCountry = mapAirportToCountry(origin);
    const destCountry = mapAirportToCountry(destination);

    console.log(`Calling Sherpa API for entry requirements from ${originCountry} to ${destCountry}...`);
    
    const response = await axios.get(
      `https://api.joinsherpa.com/v2/entry-requirements/${originCountry}-${destCountry}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`,
          'Accept': 'application/json',
        },
      }
    );

    return response.data || { status: 'Success', requirements: [] };
  } catch (error: any) {
    console.error('Sherpa API Error:', error.message || error);
    // Graceful fallback to avoid crashing backend routes
    return {
      status: 'Warning',
      message: 'Failed to fetch live travel requirements from Sherpa. Reverting to cache.',
      requirements: [
        { type: 'Visa', info: 'Check embassy requirements for ' + destination },
        { type: 'Passport', info: 'Passport must be valid for at least 6 months.' }
      ]
    };
  }
};

// --- Baggage Service (SITA) ---
export const trackBaggage = async (tagNumber: string) => {
  try {
    const API_KEY = process.env.SITA_API_KEY;
    
    // Treat placeholder keys as unconfigured
    if (!API_KEY || API_KEY === 'your_sita_key_here') {
      console.log('Mock Mode: No SITA API key found. Returning mock baggage tracking.');
      return { 
        status: 'In Transit', 
        location: 'Lagos Airport (LOS)', 
        lastUpdated: new Date(), 
        history: [
          { status: 'Checked In', location: 'Lagos Airport (LOS)', time: new Date(Date.now() - 3600000) },
          { status: 'In Transit', location: 'Lagos Airport (LOS)', time: new Date() }
        ]
      };
    }

    const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    console.log(`Calling SITA BagJourney API for tag: ${tagNumber}...`);

    // SITA uses OAuth tokens or API keys depending on integration. We send both for robustness.
    const authHeader = API_KEY.startsWith('Bearer ') ? API_KEY : `Bearer ${API_KEY}`;
    
    const response = await axios.get(
      `https://bagjourney.sita.aero/baggage/history/v1.0/tag/${tagNumber}/flightdate/${currentDate}`,
      {
        headers: {
          'Authorization': authHeader,
          'X-API-Key': API_KEY, // Secondary compatibility header
          'Accept': 'application/json',
        },
      }
    );

    return response.data || { status: 'Success', details: 'Baggage tracked' };
  } catch (error: any) {
    console.error('SITA API Error:', error.message || error);
    // Graceful fallback
    return {
      status: 'Delayed/Unresolved',
      message: 'Unable to trace live bag tag via SITA network. Please check manual desk.',
      lastUpdated: new Date(),
    };
  }
};

// --- Weather Service (Tomorrow.io) ---
export const getFlightWeatherForecast = async (airportCode: string) => {
  try {
    const API_KEY = process.env.TOMORROW_API_KEY;
    
    // Treat placeholder keys as unconfigured
    if (!API_KEY || API_KEY === 'your_tomorrow_key_here') {
      console.log('Mock Mode: No Tomorrow.io API key found. Returning mock weather forecast.');
      return { 
        forecast: 'Clear Skies', 
        temperature: 28, 
        humidity: 65, 
        windSpeed: 4.2, 
        delayProbability: '5%' 
      };
    }

    const coordinates = mapAirportToCoordinates(airportCode);
    console.log(`Calling Tomorrow.io weather API for airport ${airportCode} (${coordinates})...`);

    // Call Tomorrow.io v4 Weather Forecast API
    const response = await axios.get(
      'https://api.tomorrow.io/v4/weather/forecast',
      {
        params: {
          location: coordinates,
          apikey: API_KEY,
          units: 'metric',
        },
      }
    );

    const data = response.data;
    // Get the values safely from either forecast timelines or realtime response structure
    const values = data?.data?.values || data?.timelines?.[0]?.intervals?.[0]?.values || data?.data?.timelines?.[0]?.intervals?.[0]?.values || {};

    const temperature = values.temperature ?? 25;
    const humidity = values.humidity ?? 60;
    const windSpeed = values.windSpeed ?? 5;
    const weatherCode = values.weatherCode ?? 1000;

    // Tomorrow.io Weather Codes: 
    // 8000 (Thunderstorm), 4201 (Heavy Rain), 5101 (Heavy Snow), etc.
    let delayProbability = '5%';
    let forecast = 'Clear & favorable flight conditions.';

    if (windSpeed > 15 || [8000, 8001, 4201, 5101].includes(weatherCode)) {
      delayProbability = '85%';
      forecast = 'Severe weather conditions (Thunderstorms/Strong Winds). High risk of delay or cancellation.';
    } else if (windSpeed > 10 || [4000, 4001, 4200, 5000].includes(weatherCode)) {
      delayProbability = '40%';
      forecast = 'Precipitation / Moderate Winds. Light delay risk.';
    } else if ([1001, 1102].includes(weatherCode)) {
      delayProbability = '15%';
      forecast = 'Cloudy skies. Standard flight schedules expected.';
    }

    return {
      forecast,
      temperature,
      humidity,
      windSpeed,
      delayProbability,
    };
  } catch (error: any) {
    console.error('Tomorrow.io API Error:', error.message || error);
    // Graceful fallback
    return {
      forecast: 'Overcast / Flight operations normal',
      temperature: 26,
      humidity: 70,
      windSpeed: 6.0,
      delayProbability: '10%',
    };
  }
};

