import db, { getLastInsertId } from '../config/database';
import { nozzles, tanks, shifts, nozzleReadings, tankerDeliveries } from '../db/schema';
import { eq, and, desc, inArray, gte, lt, ne, sql } from 'drizzle-orm';

export const getNozzlesByStation = async (stationId: number | string) => {
  const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
  
  return db.query.nozzles.findMany({
    where: eq(nozzles.stationId, stationIdNum),
    with: {
      tank: true,
    },
    orderBy: sql`${nozzles.name} asc`,
  });
};

export const getTanksByStation = async (stationId: number | string) => {
  const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
  
  // Doing a manual join count or fetching all nozzles 
  // Drizzle doesn't have a simple _count relation yet, so we'll fetch relation
  const result = await db.query.tanks.findMany({
    where: eq(tanks.stationId, stationIdNum),
    with: {
      nozzles: true,
    },
  });

  return result.map(tank => ({
    ...tank,
    _count: { nozzles: tank.nozzles.length }
  }));
};

export const getCurrentShift = async (stationId: number | string) => {
  const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
  
  const now = new Date();
  const hour = now.getHours();
  // shiftType is an enum 'DAY' | 'NIGHT'
  const shiftType = hour >= 0 && hour < 12 ? 'DAY' : 'NIGHT';

  // Calculate shift start time (midnight for DAY, noon for NIGHT)
  const shiftStart = new Date(now);
  shiftStart.setHours(shiftType === 'DAY' ? 0 : 12, 0, 0, 0);

  // Find or create current shift
  let shift = await db.query.shifts.findFirst({
    where: and(
      eq(shifts.stationId, stationIdNum),
      eq(shifts.shiftType, shiftType),
      gte(shifts.startTime, shiftStart),
      lt(shifts.startTime, new Date(shiftStart.getTime() + 12 * 60 * 60 * 1000)),
      inArray(shifts.status, ['OPEN', 'CLOSED'])
    ),
  });

  if (!shift) {
    // Create new shift
    await db.insert(shifts).values({
      stationId: stationIdNum,
      shiftType,
      startTime: shiftStart,
      status: 'OPEN',
    });
    
    const shiftId: number = await getLastInsertId();

    shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    })!;

    // Initialize nozzle sales for this shift
    const { initializeNozzleSales } = await import('./fuel.service');
    await initializeNozzleSales(shiftId, stationIdNum);
  }

  return shift!;
};

export const getShiftReadings = async (shiftId: number | string) => {
  const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
  
  return db.query.nozzleReadings.findMany({
    where: eq(nozzleReadings.shiftId, shiftIdNum),
    with: {
      nozzle: {
        with: {
          tank: true
        }
      },
    },
  });
};

export const createShiftReadings = async (
  shiftId: number | string,
  stationId: number | string,
  readings: Array<{ nozzleId: number | string; closingReading: number }>
) => {
  const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
  const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
  
  const shift = await db.query.shifts.findFirst({
    where: eq(shifts.id, shiftIdNum),
    with: { nozzleReadings: true },
  });

  if (!shift) {
    throw new Error('Shift not found');
  }

  if (shift.locked) {
    throw new Error('Shift is locked');
  }

  // Get all nozzles for the station
  const allNozzles = await db.query.nozzles.findMany({
    where: eq(nozzles.stationId, stationIdNum),
  });

  // Get previous shift's closing readings as opening readings
  const previousShift = await db.query.shifts.findFirst({
    where: and(
      eq(shifts.stationId, stationIdNum),
      ne(shifts.id, shiftIdNum)
    ),
    orderBy: desc(shifts.startTime),
    with: { nozzleReadings: true },
  });

  const openingReadingsMap = new Map<number, number>();
  if (previousShift) {
    previousShift.nozzleReadings.forEach((reading) => {
      if (reading.closingReading !== null) {
        openingReadingsMap.set(reading.nozzleId as number, Number(reading.closingReading));
      }
    });
  }

  // Process readings and calculate consumption
  const tankConsumptionMap = new Map<number, number>();

  for (const reading of readings) {
    const nozzleIdNum = typeof reading.nozzleId === 'string' ? parseInt(reading.nozzleId, 10) : reading.nozzleId;
    const nozzle = allNozzles.find((n) => n.id === nozzleIdNum);
    if (!nozzle) {
      throw new Error(`Nozzle ${nozzleIdNum} not found`);
    }

    const openingReading = openingReadingsMap.get(nozzleIdNum) || 0;
    const consumption = reading.closingReading - openingReading;

    if (consumption < 0) {
      throw new Error(`Invalid reading for nozzle ${nozzle.name}`);
    }

    // Track consumption per tank
    const tankId = nozzle.tankId as number;
    const currentTankConsumption = tankConsumptionMap.get(tankId) || 0;
    tankConsumptionMap.set(tankId, currentTankConsumption + consumption);

    // Check if reading already exists
    const existingReading = await db.query.nozzleReadings.findFirst({
      where: and(
        eq(nozzleReadings.shiftId, shiftIdNum),
        eq(nozzleReadings.nozzleId, nozzleIdNum)
      ),
    });

    if (existingReading) {
      // Update existing reading
      await db.update(nozzleReadings)
        .set({
          closingReading: reading.closingReading,
          consumption,
          updatedAt: new Date(),
        })
        .where(eq(nozzleReadings.id, existingReading.id));
    } else {
      // Insert new reading
      await db.insert(nozzleReadings).values({
        shiftId: shiftIdNum,
        nozzleId: nozzleIdNum,
        openingReading,
        closingReading: reading.closingReading,
        consumption,
      });
    }
  }

  // Update tank levels (subtract consumption)
  for (const [tankId, consumption] of tankConsumptionMap.entries()) {
    await db.update(tanks)
      .set({ currentLevel: sql`${tanks.currentLevel} - ${consumption}` })
      .where(eq(tanks.id, tankId));
  }

  return db.query.nozzleReadings.findMany({ where: eq(nozzleReadings.shiftId, shiftIdNum) });
};

export const lockShift = async (shiftId: number | string) => {
  const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
  
  return db.update(shifts)
    .set({
      locked: true,
      status: 'LOCKED',
    })
    .where(eq(shifts.id, shiftIdNum));
};

export const unlockShift = async (shiftId: number | string, userId: number | string) => {
  const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
  const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
  
  return db.update(shifts)
    .set({
      locked: false,
      status: 'CLOSED',
      lockedBy: userIdStr,
    })
    .where(eq(shifts.id, shiftIdNum));
};

export const updateShiftReading = async (
  shiftId: number | string,
  readingId: number | string,
  closingReading: number
) => {
  const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
  const readingIdNum = typeof readingId === 'string' ? parseInt(readingId, 10) : readingId;
  
  const reading = await db.query.nozzleReadings.findFirst({
    where: eq(nozzleReadings.id, readingIdNum),
    with: {
      shift: true,
      nozzle: true
    }
  });

  if (!reading) {
    throw new Error('Reading not found');
  }

  if (reading.shiftId !== shiftIdNum) {
    throw new Error('Reading does not belong to this shift');
  }

  if (reading.shift.locked) {
    throw new Error('Shift is locked');
  }

  const oldConsumption = reading.consumption || 0;
  const newConsumption = closingReading - (reading.openingReading as number);

  if (newConsumption < 0) {
    throw new Error('Invalid reading');
  }

  const consumptionDiff = newConsumption - oldConsumption;

  // Update reading
  await db.update(nozzleReadings)
    .set({
      closingReading,
      consumption: newConsumption,
    })
    .where(eq(nozzleReadings.id, readingIdNum));

  const updatedReading = await db.query.nozzleReadings.findFirst({
    where: eq(nozzleReadings.id, readingIdNum),
  });

  // Adjust tank level
  const tankId = reading.nozzle.tankId as number;
  await db.update(tanks)
    .set({ currentLevel: sql`${tanks.currentLevel} - ${consumptionDiff}` })
    .where(eq(tanks.id, tankId));

  return updatedReading!;
};

export const recordTankerDelivery = async (data: {
  tankId: number | string;
  litersDelivered: number;
  deliveryDate: Date;
  deliveredBy: number | string;
  aramcoTicket?: string;
  notes?: string;
}) => {
  const tankId = typeof data.tankId === 'string' ? parseInt(data.tankId, 10) : data.tankId;
  const deliveredBy = typeof data.deliveredBy === 'string' ? parseInt(data.deliveredBy, 10) : data.deliveredBy;
  
  const tank = await db.query.tanks.findFirst({
    where: eq(tanks.id, tankId),
  });

  if (!tank) {
    throw new Error('Tank not found');
  }

  const currentLevel = tank.currentLevel || 0;
  const newLevel = currentLevel + data.litersDelivered;

  // Check capacity if set
  if (tank.capacity && newLevel > tank.capacity) {
    throw new Error(
      `Delivery exceeds tank capacity. ` +
      `Capacity: ${tank.capacity}L, Current: ${currentLevel}L, ` +
      `Delivery: ${data.litersDelivered}L, New Total: ${newLevel}L`
    );
  }

  return db.transaction(async (tx) => {
    await tx.insert(tankerDeliveries).values({
      tankId: tankId,
      litersDelivered: data.litersDelivered,
      deliveryDate: data.deliveryDate,
      deliveredBy: deliveredBy,
      aramcoTicket: data.aramcoTicket,
      notes: data.notes,
    });
    
    const deliveryId: number = await getLastInsertId(tx);

    await tx.update(tanks)
      .set({ currentLevel: newLevel, updatedAt: new Date() })
      .where(eq(tanks.id, tankId));

    const delivery = await tx.query.tankerDeliveries.findFirst({
      where: eq(tankerDeliveries.id, deliveryId),
    });

    const updatedTank = await tx.query.tanks.findFirst({
      where: eq(tanks.id, tankId),
    });

    return { delivery: delivery!, tank: updatedTank! };
  });
};

export const getTankerDeliveries = async (tankId?: number | string) => {
  if (tankId) {
    const tankIdNum = typeof tankId === 'string' ? parseInt(tankId, 10) : tankId;
    
    return db.query.tankerDeliveries.findMany({
      where: eq(tankerDeliveries.tankId, tankIdNum),
      with: {
        tank: true,
        deliveredBy: {
          columns: { id: true, name: true, employeeId: true },
        },
      },
      orderBy: [desc(tankerDeliveries.deliveryDate)],
    });
  }

  return db.query.tankerDeliveries.findMany({
    with: {
      tank: {
        with: {
          station: true,
        },
      },
      deliveredBy: {
        columns: { id: true, name: true, employeeId: true },
      },
    },
    orderBy: [desc(tankerDeliveries.deliveryDate)],
  });
};
