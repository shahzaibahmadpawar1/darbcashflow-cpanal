import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes';
import cashRoutes from './routes/cash.routes';
import inventoryRoutes from './routes/inventory.routes';
import stationsRoutes from './routes/stations.routes';
import shiftsRoutes from './routes/shifts.routes';
import usersRoutes from './routes/users.routes';
import fuelRoutes from './routes/fuel.routes';

dotenv.config();

const app = express();

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000']);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
const uploadsPath = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/fuel', fuelRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Petroleum Station Management System API' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start the server
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.UPLOAD_DIR) {
      console.log(`Upload directory: ${process.env.UPLOAD_DIR}`);
    }
  });
}

export default app;

