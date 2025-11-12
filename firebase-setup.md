# Firebase Admin SDK Setup

## 1. Get Service Account Key
1. Go to Firebase Console → Project Settings
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file

## 2. Add to .env file
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

## 3. Install Dependencies
```bash
npm install firebase-admin sqlite axios
```

## 4. Start Server
```bash
npm start
```

Your backend will now send FCM push notifications to Android devices!