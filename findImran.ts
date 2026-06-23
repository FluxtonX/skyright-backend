import admin from './src/config/firebase';

async function findUsersWithFCM() {
  try {
    const db = admin.firestore();
    const usersRef = db.collection('users');
    
    console.log('Fetching all users to find one with an FCM token...');
    const snapshot = await usersRef.get();
    
    let found = false;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        console.log(`FOUND USER WITH TOKEN: ID=${doc.id}, Name=${data.displayName || 'Unknown'}, fcmToken=${data.fcmToken}`);
        found = true;
      }
    });
    
    if (!found) {
      console.log('NO USERS HAVE AN FCM TOKEN SAVED IN THE DATABASE.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

findUsersWithFCM();
