import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import alertRoutes from './routes/alertRoutes';
import issueRoutes from './routes/issueRoutes';
import vaultRoutes from './routes/vaultRoutes';
import claimRoutes from './routes/claimRoutes';
import paymentRoutes from './routes/paymentRoutes';
import searchRoutes from './routes/searchRoutes';
import plusRoutes from './routes/plusRoutes';
import guardRoutes from './routes/guardRoutes';

dotenv.config();

const app: Application = express();

// Middleware
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cors());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/plus', plusRoutes);
app.use('/api/guard', guardRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to SkyRight API' });
});

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

export default app;
