import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getTravelRequirements, trackBaggage, getFlightWeatherForecast } from '../services/extraServices';

// @desc    Get travel requirements (BorderReady)
// @route   GET /api/plus/compliance
export const getCompliance = async (req: AuthRequest, res: Response) => {
  try {
    const { origin, destination } = req.query;
    const requirements = await getTravelRequirements(origin as string, destination as string);
    res.json(requirements);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Track baggage (BagTrack)
// @route   GET /api/plus/baggage/:tag
export const getBaggage = async (req: AuthRequest, res: Response) => {
  try {
    const baggage = await trackBaggage(req.params.tag as string);
    res.json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get weather-based delay forecast
// @route   GET /api/plus/weather/:airport
export const getWeather = async (req: AuthRequest, res: Response) => {
  try {
    const forecast = await getFlightWeatherForecast(req.params.airport as string);
    res.json(forecast);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
