import db, { getLastInsertId } from '../config/database';
import { fuelPrices, nozzleSales, nozzles, tanks, shifts } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ==================== FUEL PRICES (Admin) ====================

export const setFuelPrice = async (data: {
    stationId: number | string;
    fuelType: string;
    pricePerLiter: number;
    createdBy: number | string;
}) => {
    const stationId = typeof data.stationId === 'string' ? parseInt(data.stationId, 10) : data.stationId;
    const createdBy = typeof data.createdBy === 'string' ? parseInt(data.createdBy, 10) : data.createdBy;
    
    await db.insert(fuelPrices).values({
        stationId: stationId,
        fuelType: data.fuelType as any,
        pricePerLiter: data.pricePerLiter.toString(),
        createdBy: createdBy,
    });
    
    const priceId: number = await getLastInsertId();

    return db.query.fuelPrices.findFirst({
        where: eq(fuelPrices.id, priceId),
    });
};

export const getCurrentFuelPrices = async (stationId: number | string) => {
    const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
    
    // Get latest price for each fuel type
    const prices = await db.query.fuelPrices.findMany({
        where: eq(fuelPrices.stationId, stationIdNum),
        orderBy: [desc(fuelPrices.effectiveFrom)],
    });

    // Group by fuel type and get the most recent
    const latestPrices: Record<string, any> = {};
    prices.forEach(price => {
        if (!latestPrices[price.fuelType]) {
            latestPrices[price.fuelType] = price;
        }
    });

    return Object.values(latestPrices);
};

export const getAllStationPrices = async () => {
    return db.query.fuelPrices.findMany({
        with: {
            station: true,
        },
        orderBy: [desc(fuelPrices.effectiveFrom)],
    });
};

// ==================== NOZZLE SALES (Station Manager) ====================

export const initializeNozzleSales = async (shiftId: number | string, stationId: number | string) => {
    const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
    const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
    
    // Get all nozzles for this station
    const stationNozzles = await db.query.nozzles.findMany({
        where: eq(nozzles.stationId, stationIdNum),
        with: {
            tank: true,
        },
    });

    // Get current fuel prices for the station
    const currentPrices = await getCurrentFuelPrices(stationIdNum);
    const priceMap: Record<string, number> = {};
    currentPrices.forEach(p => {
        priceMap[p.fuelType] = parseFloat(p.pricePerLiter.toString());
    });

    // Create nozzle sales records
    const salesToCreate = stationNozzles.map(nozzle => ({
        shiftId: shiftIdNum,
        nozzleId: nozzle.id,
        quantityLiters: '0',
        pricePerLiter: (priceMap[nozzle.fuelType] || 100).toString(), // Default to 100 if no price set
        cardAmount: '0',
        cashAmount: '0',
    }));

    if (salesToCreate.length > 0) {
        await db.insert(nozzleSales).values(salesToCreate);
    }

    return salesToCreate;
};

export const getNozzleSales = async (shiftId: number | string) => {
    const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
    
    return db.query.nozzleSales.findMany({
        where: eq(nozzleSales.shiftId, shiftIdNum),
        with: {
            nozzle: {
                with: {
                    tank: true,
                },
            },
        },
    });
};

export const updateNozzleSale = async (
    saleId: number | string,
    data: {
        quantityLiters?: number;
        cardAmount?: number;
        cashAmount?: number;
    }
) => {
    const saleIdNum = typeof saleId === 'string' ? parseInt(saleId, 10) : saleId;
    
    await db.update(nozzleSales)
        .set({
            quantityLiters: data.quantityLiters?.toString(),
            cardAmount: data.cardAmount?.toString(),
            cashAmount: data.cashAmount?.toString(),
            updatedAt: new Date(),
        })
        .where(eq(nozzleSales.id, saleIdNum));

    return db.query.nozzleSales.findFirst({
        where: eq(nozzleSales.id, saleIdNum),
    });
};

export const submitNozzleSales = async (shiftId: number | string) => {
    const shiftIdNum = typeof shiftId === 'string' ? parseInt(shiftId, 10) : shiftId;
    
    // Get all sales for this shift
    const sales = await getNozzleSales(shiftIdNum);

    // Update tank levels
    for (const sale of sales) {
        const quantityLiters = parseFloat(sale.quantityLiters.toString());
        const currentLevel = sale.nozzle.tank.currentLevel || 0;
        const newLevel = currentLevel - quantityLiters;

        if (newLevel < 0) {
            throw new Error(
                `Insufficient fuel in ${sale.nozzle.tank.fuelType} tank. ` +
                `Current: ${currentLevel}L, Needed: ${quantityLiters}L`
            );
        }

        await db.update(tanks)
            .set({ currentLevel: newLevel, updatedAt: new Date() })
            .where(eq(tanks.id, sale.nozzle.tank.id));
    }

    // Lock the shift
    await db.update(shifts)
        .set({
            status: 'CLOSED',
            locked: true,
            lockedAt: new Date(),
            endTime: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(shifts.id, shiftIdNum));

    return { success: true, sales };
};
