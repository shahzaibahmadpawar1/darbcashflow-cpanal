import jwt from 'jsonwebtoken';
import db, { getLastInsertId } from '../config/database';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Fix the JWT type error by ensuring options are typed correctly
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (userId: number): string => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const createUser = async (data: {
  employeeId: string;
  password: string;
  name: string;
  role: 'SM' | 'AM' | 'Admin';
  stationId?: number | null;
  areaManagerId?: number | null;
}) => {
  // Store password as plain text (NOT RECOMMENDED FOR PRODUCTION)
  await db.insert(users).values({
    ...data,
    password: data.password, // Plain text password
    stationId: data.stationId || null,
    areaManagerId: data.areaManagerId || null,
  });
  
  const userId: number = await getLastInsertId();
  
  // Fetch the created user
  const newUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      employeeId: true,
      name: true,
      role: true,
      stationId: true,
      areaManagerId: true,
      createdAt: true,
    },
  });

  return newUser!;
};

export const loginUser = async (name: string, password: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.name, name),
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Plain text password comparison
  if (password !== user.password) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id as number);

  return {
    token,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      stationId: user.stationId,
      areaManagerId: user.areaManagerId,
    },
  };
};

export const getUserById = async (userId: number | string) => {
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  return db.query.users.findFirst({
    where: eq(users.id, userIdNum),
    columns: {
      id: true,
      employeeId: true,
      name: true,
      role: true,
      stationId: true,
      areaManagerId: true,
      createdAt: true,
    },
  });
};
