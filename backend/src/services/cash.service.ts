import db, { getLastInsertId } from '../config/database';
import { cashTransactions, cashTransfers, shifts, users } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

// Helper function to determine current shift type based on time
const getCurrentShiftType = (): 'DAY' | 'NIGHT' => {
  const hour = new Date().getHours();
  // DAY shift: 6 AM to 6 PM, NIGHT shift: 6 PM to 6 AM
  return (hour >= 6 && hour < 18) ? 'DAY' : 'NIGHT';
};

export const createCashTransaction = async (data: {
  stationId: number | string;
  litersSold: number;
  ratePerLiter: number;
  cardPayments: number;
  bankDeposit: number;
  userId: number | string;
}) => {
  const stationId = typeof data.stationId === 'string' ? parseInt(data.stationId, 10) : data.stationId;
  
  // 1. Find or create current open shift for the station
  let shift = await db.query.shifts.findFirst({
    where: and(
      eq(shifts.stationId, stationId),
      eq(shifts.status, 'OPEN')
    )
  });

  if (!shift) {
    // Create new shift
    await db.insert(shifts).values({
      stationId: stationId,
      shiftType: getCurrentShiftType(),
      startTime: new Date(),
      status: 'OPEN',
      locked: false,
    });
    
    const shiftId: number = await getLastInsertId();
    shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    })!;
  }

  if (!shift) {
    throw new Error('Failed to create or find shift');
  }

  // 2. Create transaction
  const totalRevenue = data.litersSold * data.ratePerLiter;
  const cashOnHand = totalRevenue - data.cardPayments;
  const cashToAM = cashOnHand - data.bankDeposit;

  await db.insert(cashTransactions).values({
    shiftId: shift.id,
    stationId: stationId,
    litersSold: data.litersSold,
    ratePerLiter: data.ratePerLiter,
    totalRevenue,
    cardPayments: data.cardPayments,
    cashOnHand,
    bankDeposit: data.bankDeposit,
    cashToAM,
    status: 'PENDING_ACCEPTANCE',
  });
  
  const transactionId: number = await getLastInsertId();

  // Fetch transaction with relations
  return db.query.cashTransactions.findFirst({
    where: eq(cashTransactions.id, transactionId),
    with: {
      station: true,
      shift: true,
      cashTransfer: {
        with: {
          fromUser: { columns: { id: true, name: true, employeeId: true } },
          toUser: { columns: { id: true, name: true, employeeId: true } },
        },
      },
    },
  });
};

export const getCashTransactions = async (userId: number | string, userRole: string, stationId?: number | string | null) => {
  let whereClause = undefined;

  if (userRole === 'SM' && stationId) {
    const stationIdNum = typeof stationId === 'string' ? parseInt(stationId, 10) : stationId;
    whereClause = eq(cashTransactions.stationId, stationIdNum);
  } else if (userRole === 'AM') {
    // AM can see transactions from stations in their area
    // This would need areaId mapping - simplified to status for now as per original code
    whereClause = inArray(cashTransactions.status, ['PENDING_ACCEPTANCE', 'WITH_AM']);
  }

  return db.query.cashTransactions.findMany({
    where: whereClause,
    with: {
      station: true,
      shift: true,
      cashTransfer: {
        with: {
          fromUser: { columns: { id: true, name: true, employeeId: true } },
          toUser: { columns: { id: true, name: true, employeeId: true } },
        },
      },
    },
    orderBy: desc(cashTransactions.createdAt),
  });
};

export const initiateTransfer = async (transactionId: number | string, fromUserId: number | string) => {
  const transactionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
  const fromUserIdNum = typeof fromUserId === 'string' ? parseInt(fromUserId, 10) : fromUserId;
  
  const transaction = await db.query.cashTransactions.findFirst({
    where: eq(cashTransactions.id, transactionIdNum),
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status !== 'PENDING_ACCEPTANCE') {
    throw new Error('Transaction already processed');
  }

  // Get the user's assigned area manager
  const user = await db.query.users.findFirst({
    where: eq(users.id, fromUserIdNum),
    columns: { id: true, areaManagerId: true }
  });

  if (!user?.areaManagerId) {
    throw new Error('No area manager assigned to this user');
  }

  await db.insert(cashTransfers).values({
    cashTransactionId: transactionIdNum,
    fromUserId: fromUserIdNum,
    toUserId: user.areaManagerId,
    status: 'PENDING_ACCEPTANCE',
  });
  
  const transferId: number = await getLastInsertId();

  return db.query.cashTransfers.findFirst({
    where: eq(cashTransfers.id, transferId),
  });
};

export const acceptCash = async (transactionId: number | string, userId: number | string) => {
  const transactionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  
  const transaction = await db.query.cashTransactions.findFirst({
    where: eq(cashTransactions.id, transactionIdNum),
    with: { cashTransfer: true },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (!transaction.cashTransfer) {
    throw new Error('Transfer not initiated');
  }

  if (transaction.cashTransfer.toUserId !== userIdNum) {
    throw new Error('Unauthorized');
  }

  if (transaction.cashTransfer.status !== 'PENDING_ACCEPTANCE') {
    throw new Error('Transfer already processed');
  }

  return db.transaction(async (tx) => {
    await tx.update(cashTransfers)
      .set({ status: 'WITH_AM' })
      .where(eq(cashTransfers.id, transaction.cashTransfer!.id));

    await tx.update(cashTransactions)
      .set({ status: 'WITH_AM' })
      .where(eq(cashTransactions.id, transactionIdNum));
  });
};

export const depositCash = async (transactionId: number | string, receiptUrl: string) => {
  const transactionIdNum = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
  
  const transaction = await db.query.cashTransactions.findFirst({
    where: eq(cashTransactions.id, transactionIdNum),
    with: { cashTransfer: true },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (!transaction.cashTransfer) {
    throw new Error('Transfer not found');
  }

  if (transaction.cashTransfer.status !== 'WITH_AM') {
    throw new Error('Cash must be accepted before deposit');
  }

  return db.transaction(async (tx) => {
    await tx.update(cashTransfers)
      .set({
        status: 'DEPOSITED',
        receiptUrl,
        depositedAt: new Date(),
      })
      .where(eq(cashTransfers.id, transaction.cashTransfer!.id));

    await tx.update(cashTransactions)
      .set({ status: 'DEPOSITED' })
      .where(eq(cashTransactions.id, transactionIdNum));
  });
};

export const getFloatingCash = async () => {
  // Get all transactions that haven't been deposited yet
  const transactions = await db.query.cashTransactions.findMany({
    where: inArray(cashTransactions.status, ['PENDING_ACCEPTANCE', 'WITH_AM']),
    with: {
      station: true,
      cashTransfer: {
        with: {
          fromUser: { columns: { name: true, employeeId: true } },
          toUser: { columns: { name: true, employeeId: true } },
        },
      },
    },
    orderBy: desc(cashTransactions.createdAt),
  });

  const totalFloating = transactions.reduce((sum, t) => sum + Number(t.cashToAM || 0), 0);
  const pendingAcceptance = transactions
    .filter((t) => t.status === 'PENDING_ACCEPTANCE')
    .reduce((sum, t) => sum + Number(t.cashToAM || 0), 0);
  const withAM = transactions
    .filter((t) => t.status === 'WITH_AM')
    .reduce((sum, t) => sum + Number(t.cashToAM || 0), 0);

  return {
    totalFloating,
    transactions,
    breakdown: {
      pendingAcceptance,
      withAM,
    },
  };
};
