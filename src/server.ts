import app from './app';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { monitorFlightsAndCreateAlerts } from './services/flightService';

dotenv.config();

const PORT = process.env.PORT || 5000;
let server: ReturnType<typeof app.listen> | undefined;

const startServer = async () => {
  try {
    server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      
      // Initialize Sentinel Cron Job
      console.log('Initializing Sentinel monitoring cron job (runs every 2 hours)...');
      cron.schedule('0 */2 * * *', () => {
        monitorFlightsAndCreateAlerts();
      });
    });
    server.on('error', (error) => {
      console.error('Server listener error:', error);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
  }
};

startServer();
