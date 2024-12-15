import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDb from '../connectDb.js'; // Assuming you have a database connection utility
import { error } from '../middlewares/errorMiddleware.js'; // Global error handling middleware
import userRouter from '../routes/userRouter.js'; // Import userRouter
import devKeyRouter from '../routes/devKeyRouter.js';
import hotelRouter from "../routes/hotelRouter.js";
import authRouter from "../routes/authRouter.js"
import tableRouter from "../routes/tableRouter.js"
import qrRouter from "../routes/qrRouter.js"
import ingredientRouter from "../routes/ingredientRouter.js"
import categoryRouter from "../routes/categoryRouter.js"
import dishRouter from "../routes/dishRouter.js"
import orderRouter from "../routes/orderRouter.js"
import billRouter from "../routes/billRouter.js"
import offerRouter from "../routes/offerRouter.js";
import imageUploadService from '../services/imageUploadService.js';
import utilsRouter from '../routes/utilsRouter.js';


const app = express();

const corsOptions = {
  origin: [
    "https://orm-frontend-eight.vercel.app", // Production frontend URL
    "http://localhost:3000" // Local development URL
  ],
  methods: ["POST", "GET", "PUT", "DELETE", "PATCH"], // Allowed methods
  credentials: true, // Enable cookies and authentication headers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicitly handle preflight requests
app.options('*', cors(corsOptions)); 

dotenv.config();

// Middleware setup
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Database connection
const DB_URL = process.env.DATABASE_URL;
connectDb(DB_URL);

// Routes setup
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Hotel Order Management System' });
});

app.use('/api/v1/uploads', utilsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/devkey', devKeyRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/hotels', hotelRouter);
app.use('/api/v1/tables', tableRouter);
app.use('/api/v1/qrs', qrRouter);
app.use('/api/v1/ingredients', ingredientRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/dishes/', dishRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/bills', billRouter);
app.use('/api/v1/offers', offerRouter);

app.use(error); // This will catch any errors from previous routes and middleware

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}...`);
});
