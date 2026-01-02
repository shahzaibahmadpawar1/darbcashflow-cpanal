import { mysqlTable, int, varchar, text, datetime, double, boolean, mysqlEnum, decimal, unique } from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';

// --- Tables ---

export const stations = mysqlTable('stations', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const users = mysqlTable('users', {
    id: int('id').primaryKey().autoincrement(),
    employeeId: varchar('employee_id', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: mysqlEnum('role', ['SM', 'AM', 'Admin']).notNull(),
    stationId: int('station_id'),
    areaManagerId: int('area_manager_id'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const tanks = mysqlTable('tanks', {
    id: int('id').primaryKey().autoincrement(),
    stationId: int('station_id').notNull(),
    fuelType: mysqlEnum('fuel_type', ['91_GASOLINE', '95_GASOLINE', 'DIESEL']).notNull(),
    capacity: double('capacity'),
    currentLevel: double('current_level').default(0),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const nozzles = mysqlTable('nozzles', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    stationId: int('station_id').notNull(),
    tankId: int('tank_id').notNull(),
    fuelType: mysqlEnum('fuel_type', ['91_GASOLINE', '95_GASOLINE', 'DIESEL']).notNull(),
    meterLimit: decimal('meter_limit', { precision: 12, scale: 2 }).default('999999'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const shifts = mysqlTable('shifts', {
    id: int('id').primaryKey().autoincrement(),
    stationId: int('station_id').notNull(),
    shiftType: mysqlEnum('shift_type', ['DAY', 'NIGHT']).notNull(),
    startTime: datetime('start_time').notNull(),
    endTime: datetime('end_time'),
    status: mysqlEnum('status', ['OPEN', 'CLOSED', 'LOCKED']).default('OPEN'),
    locked: boolean('locked').default(false),
    lockedBy: varchar('locked_by', { length: 255 }),
    lockedAt: datetime('locked_at'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const nozzleReadings = mysqlTable('nozzle_readings', {
    id: int('id').primaryKey().autoincrement(),
    shiftId: int('shift_id').notNull(),
    nozzleId: int('nozzle_id').notNull(),
    openingReading: double('opening_reading').notNull(),
    closingReading: double('closing_reading'),
    consumption: double('consumption'),
    isRollover: boolean('is_rollover').default(false),
    pricePerLiter: decimal('price_per_liter', { precision: 10, scale: 2 }),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    uniqueShiftNozzle: unique().on(table.shiftId, table.nozzleId),
}));

export const cashTransactions = mysqlTable('cash_transactions', {
    id: int('id').primaryKey().autoincrement(),
    shiftId: int('shift_id').notNull().unique(),
    stationId: int('station_id').notNull(),
    litersSold: double('liters_sold').notNull(),
    ratePerLiter: double('rate_per_liter').notNull(),
    totalRevenue: double('total_revenue').notNull(),
    cardPayments: double('card_payments').default(0),
    cashOnHand: double('cash_on_hand').notNull(),
    bankDeposit: double('bank_deposit').default(0),
    cashToAM: double('cash_to_am').notNull(),
    status: mysqlEnum('status', ['PENDING_ACCEPTANCE', 'WITH_AM', 'DEPOSITED']).default('PENDING_ACCEPTANCE'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const cashTransfers = mysqlTable('cash_transfers', {
    id: int('id').primaryKey().autoincrement(),
    cashTransactionId: int('cash_transaction_id').notNull().unique(),
    fromUserId: int('from_user_id').notNull(),
    toUserId: int('to_user_id').notNull(),
    status: mysqlEnum('status', ['PENDING_ACCEPTANCE', 'WITH_AM', 'DEPOSITED']).default('PENDING_ACCEPTANCE'),
    receiptUrl: text('receipt_url'),
    depositedAt: datetime('deposited_at'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

export const tankerDeliveries = mysqlTable('tanker_deliveries', {
    id: int('id').primaryKey().autoincrement(),
    tankId: int('tank_id').notNull(),
    litersDelivered: double('liters_delivered').notNull(),
    deliveryDate: datetime('delivery_date').notNull().default(sql`CURRENT_TIMESTAMP`),
    deliveredBy: int('delivered_by').notNull(),
    aramcoTicket: text('aramco_ticket'),
    notes: text('notes'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
});

// Fuel Prices (Admin-managed)
export const fuelPrices = mysqlTable('fuel_prices', {
    id: int('id').primaryKey().autoincrement(),
    stationId: int('station_id').notNull(),
    fuelType: mysqlEnum('fuel_type', ['91_GASOLINE', '95_GASOLINE', 'DIESEL']).notNull(),
    pricePerLiter: decimal('price_per_liter', { precision: 10, scale: 2 }).notNull(),
    effectiveFrom: datetime('effective_from').notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: int('created_by'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    uniqueStationFuelEffective: unique().on(table.stationId, table.fuelType, table.effectiveFrom),
}));

// Nozzle Sales (Station Manager input)
export const nozzleSales = mysqlTable('nozzle_sales', {
    id: int('id').primaryKey().autoincrement(),
    shiftId: int('shift_id').notNull(),
    nozzleId: int('nozzle_id').notNull(),
    quantityLiters: decimal('quantity_liters', { precision: 12, scale: 2 }).notNull().default('0'),
    pricePerLiter: decimal('price_per_liter', { precision: 10, scale: 2 }).notNull(),
    // Note: Generated columns in MySQL need to be defined in the database schema
    // totalAmount is generated as (quantity_liters * price_per_liter) in the database
    cardAmount: decimal('card_amount', { precision: 12, scale: 2 }).default('0'),
    cashAmount: decimal('cash_amount', { precision: 12, scale: 2 }).default('0'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    uniqueShiftNozzleSales: unique().on(table.shiftId, table.nozzleId),
}));

// --- Relations ---

export const stationsRelations = relations(stations, ({ one, many }) => ({
    users: many(users, { relationName: 'stationUsers' }),
    tanks: many(tanks),
    nozzles: many(nozzles),
    shifts: many(shifts),
    cashTransactions: many(cashTransactions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    station: one(stations, {
        fields: [users.stationId],
        references: [stations.id],
        relationName: 'stationUsers'
    }),
    areaManager: one(users, {
        fields: [users.areaManagerId],
        references: [users.id],
        relationName: 'areaManagerRelation'
    }),
    subordinates: many(users, { relationName: 'areaManagerRelation' }),
}));

export const tanksRelations = relations(tanks, ({ one, many }) => ({
    station: one(stations, { fields: [tanks.stationId], references: [stations.id] }),
    nozzles: many(nozzles),
    tankerDeliveries: many(tankerDeliveries),
}));

export const nozzlesRelations = relations(nozzles, ({ one, many }) => ({
    station: one(stations, { fields: [nozzles.stationId], references: [stations.id] }),
    tank: one(tanks, { fields: [nozzles.tankId], references: [tanks.id] }),
    nozzleReadings: many(nozzleReadings),
    nozzleSales: many(nozzleSales),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
    station: one(stations, { fields: [shifts.stationId], references: [stations.id] }),
    nozzleReadings: many(nozzleReadings),
    nozzleSales: many(nozzleSales),
    cashTransactions: many(cashTransactions),
}));

export const nozzleReadingsRelations = relations(nozzleReadings, ({ one }) => ({
    shift: one(shifts, { fields: [nozzleReadings.shiftId], references: [shifts.id] }),
    nozzle: one(nozzles, { fields: [nozzleReadings.nozzleId], references: [nozzles.id] }),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
    station: one(stations, { fields: [cashTransactions.stationId], references: [stations.id] }),
    shift: one(shifts, { fields: [cashTransactions.shiftId], references: [shifts.id] }),
    cashTransfer: one(cashTransfers),
}));

export const cashTransfersRelations = relations(cashTransfers, ({ one }) => ({
    cashTransaction: one(cashTransactions, { fields: [cashTransfers.cashTransactionId], references: [cashTransactions.id] }),
    fromUser: one(users, { fields: [cashTransfers.fromUserId], references: [users.id] }),
    toUser: one(users, { fields: [cashTransfers.toUserId], references: [users.id] }),
}));

export const tankerDeliveriesRelations = relations(tankerDeliveries, ({ one }) => ({
    tank: one(tanks, { fields: [tankerDeliveries.tankId], references: [tanks.id] }),
    deliveredBy: one(users, { fields: [tankerDeliveries.deliveredBy], references: [users.id] }),
}));

export const fuelPricesRelations = relations(fuelPrices, ({ one }) => ({
    station: one(stations, { fields: [fuelPrices.stationId], references: [stations.id] }),
    createdByUser: one(users, { fields: [fuelPrices.createdBy], references: [users.id] }),
}));

export const nozzleSalesRelations = relations(nozzleSales, ({ one }) => ({
    shift: one(shifts, { fields: [nozzleSales.shiftId], references: [shifts.id] }),
    nozzle: one(nozzles, { fields: [nozzleSales.nozzleId], references: [nozzles.id] }),
}));

// Export type helpers if needed
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
