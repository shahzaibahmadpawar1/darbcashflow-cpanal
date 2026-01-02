import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import db, { getLastInsertId } from '../config/database';
import { stations } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getStations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let result: any[] = [];

    if (req.user.role === 'SM' && req.user.stationId) {
      // SM can only see their own station
      const stationId = typeof req.user.stationId === 'string' ? parseInt(req.user.stationId, 10) : req.user.stationId;
      result = await db.query.stations.findMany({
        where: eq(stations.id, stationId),
      });
    } else if (req.user.role === 'AM') {
      // AM can see stations in their area (simplified - would need area mapping)
      result = await db.query.stations.findMany();
    } else if (req.user.role === 'Admin') {
      // Admin can see all stations
      result = await db.query.stations.findMany();
    } else {
      result = [];
    }

    res.json({ stations: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getStation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const stationId = parseInt(id, 10);

    const station = await db.query.stations.findFirst({
      where: eq(stations.id, stationId),
      with: {
        tanks: true,
        nozzles: true,
      },
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    res.json({ station });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createStation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, address } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Station name is required' });
      return;
    }

    await db.insert(stations).values({
      name,
      address,
    });
    
    const stationId: number = await getLastInsertId();

    const station = await db.query.stations.findFirst({
      where: eq(stations.id, stationId),
    });

    res.status(201).json({ message: 'Station created successfully', station });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateStation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const stationId = parseInt(id, 10);
    const { name, address } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;

    await db.update(stations)
      .set(updateData)
      .where(eq(stations.id, stationId));

    const updatedStation = await db.query.stations.findFirst({
      where: eq(stations.id, stationId),
    });

    if (!updatedStation) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    res.json({ message: 'Station updated successfully', station: updatedStation });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

