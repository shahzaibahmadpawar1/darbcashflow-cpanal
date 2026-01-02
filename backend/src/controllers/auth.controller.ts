import { Request, Response } from 'express';
import { createUser, loginUser, getUserById } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, password, name, role, stationId, areaManagerId } = req.body;

    if (!employeeId || !password || !name || !role) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['SM', 'AM', 'Admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const user = await createUser({
      employeeId,
      password,
      name,
      role,
      stationId: stationId || null,
      areaManagerId: areaManagerId || null,
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error: any) {
    // MySQL error code 1062 is duplicate entry (unique constraint violation)
    // Also check for error messages that indicate duplicate entry
    if (error.code === '1062' || error.code === 'ER_DUP_ENTRY' || 
        error.message?.includes('Duplicate entry') || 
        error.message?.includes('employee_id')) {
      res.status(400).json({ error: 'Employee ID already exists' });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      res.status(400).json({ error: 'Name and password are required' });
      return;
    }

    const result = await loginUser(name, password);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Invalid credentials' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

