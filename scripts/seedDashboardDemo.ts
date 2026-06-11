import dotenv from 'dotenv';
import admin from '../src/config/firebase';
import Alert from '../src/models/alertModel';
import Claim from '../src/models/claimModel';
import User from '../src/models/userModel';

dotenv.config();

const DEMO_SOURCE = 'dashboard-demo-seed';

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
};

const printUsageAndExit = () => {
  console.error(
    [
      'Usage:',
      '  npm run seed:dashboard -- --firebase-id=<logged-in-firebase-uid>',
      '  npm run seed:dashboard -- --email=<logged-in-user-email>',
      '',
      'This script is development-only and refuses to run with NODE_ENV=production.',
    ].join('\n')
  );
  process.exit(1);
};

const getDashboardSummaryForUser = async (userId: string) => {
  const [alertsCount, casesCount, completedClaims] = await Promise.all([
    Alert.countDocuments({ user: userId, isRead: false }),
    Claim.countDocuments({
      user: userId,
      status: { $in: ['PENDING', 'IN PROGRESS'] },
    }),
    Claim.find({ user: userId, status: 'COMPLETED' }),
  ]);

  const totalSaved = completedClaims.reduce((sum: number, claim: any) => {
    const amount = parseInt(String(claim.compensationAmount || '').replace(/[^0-9]/g, ''), 10) || 0;
    return sum + amount;
  }, 0);

  return {
    alertsCount,
    casesCount,
    totalSavings: `₦${totalSaved.toLocaleString()}`,
  };
};

const main = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed dashboard demo data in production.');
  }

  const firebaseId = getArgValue('firebase-id');
  const email = getArgValue('email');

  if (!firebaseId && !email) {
    printUsageAndExit();
  }

  const user = firebaseId
    ? await User.findById(firebaseId)
    : await User.findOne({ email });

  if (!user) {
    throw new Error(
      `User not found. Log in once first so the backend creates the user profile. Lookup: ${
        firebaseId ? `firebase-id=${firebaseId}` : `email=${email}`
      }`
    );
  }

  const userId = user._id;
  const userFirebaseId = user.firebaseId || user.id || userId;

  console.log('Dashboard demo seed target:', {
    user: userId,
    firebaseId: userFirebaseId,
    email: user.email || '',
  });

  console.log('Before:', await getDashboardSummaryForUser(userId));

  await Promise.all([
    Alert.deleteMany({ user: userId, source: DEMO_SOURCE }),
    Claim.deleteMany({ user: userId, source: DEMO_SOURCE }),
  ]);

  await Promise.all([
    Alert.create({
      user: userId,
      userId: userFirebaseId,
      flightCode: 'UA 2847',
      airline: 'United Airlines',
      priority: 'HIGH',
      eventType: 'Delay Risk Increased',
      message: 'UA 2847 has a higher disruption risk based on Sentinel monitoring.',
      isRead: false,
      source: DEMO_SOURCE,
    }),
    Alert.create({
      user: userId,
      userId: userFirebaseId,
      flightCode: 'BA 075',
      airline: 'British Airways',
      priority: 'CRITICAL',
      eventType: 'Compensation Window Open',
      message: 'Your delayed BA 075 trip may qualify for compensation.',
      isRead: false,
      source: DEMO_SOURCE,
    }),
    Claim.create({
      user: userId,
      userId: userFirebaseId,
      flightCode: 'UA 2847',
      airline: 'United Airlines',
      disruptionType: 'Delay',
      passenger: user.displayName || user.email || 'Demo Traveller',
      booking: 'FLY-DEMO-PENDING',
      documents: [],
      status: 'PENDING',
      currentStep: 2,
      totalSteps: 6,
      progress: 0.33,
      compensationAmount: '₦0',
      source: DEMO_SOURCE,
    }),
    Claim.create({
      user: userId,
      userId: userFirebaseId,
      flightCode: 'BA 075',
      airline: 'British Airways',
      disruptionType: 'Long Delay',
      passenger: user.displayName || user.email || 'Demo Traveller',
      booking: 'FLY-DEMO-COMPLETE',
      documents: [],
      status: 'COMPLETED',
      currentStep: 6,
      totalSteps: 6,
      progress: 1,
      compensationAmount: '₦68,000',
      source: DEMO_SOURCE,
    }),
  ]);

  console.log('After:', await getDashboardSummaryForUser(userId));
};

main()
  .catch((error) => {
    console.error('Dashboard demo seed failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await admin.app().delete().catch(() => undefined);
  });
