const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'hostelpro-notifications';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@hostelpro-notifications.iam.gserviceaccount.com';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCKiU6QYRruxSTo\nycGbqaVBTjWPXzCBwRcBMeKwkEYe5u1Yxnz3HIb6sKQ5tfuImrNik/w9h/AzhTtr\n8CNRe9e/DZWE5PZVDBCUdurbOyyVc+8Ve7C5drc6XQ7QzIqepnrT4OYRBfySbKdp\nShMb4myLE3tCRtmiUmxfUdc08l9/UMTrUBmnwA9o2YDyYKB3AVc4fRN/I0LyV8c0\n9sRAWXICwkpaNTPx3TRsqIe0t/HLfgjJEA5kWaM9CMwA/l9u5TlhZ2XQBuJKj9xQ\nYyyBP3I3IVbJsEs3nf4Uoaz7W34zJvh2bLDtidowIhfWxHd/5VyL1c0xJUol7/PY\ngP/ZBHa/AgMBAAECggEAAoasaw+KOS5ZFPGQ2TDHtaAic+HNdaA6tifdtVB8JtYZ\nH9RGtQ7NG0cbR34c/wmrGbIPGGQhKh9UzQwM6NB0R6SMxGaUY0qcBskAUU0L7BG4\nG1EtEMSsZKELwxznrirk9HYWW9sbFuRqTQ4vuQNw7TxGtBesojwUg8xvOyTsPtsI\nTfsifKpHN1coqPTBwNW95Fxw5Mz9MENo/kXTpWsWZiVaKLiD9wVIXcgOCqoyC2C1\n/ethhQLAwv0cjyBgjnngwwpNI2HH5ZG7ihk8jQ7qVsFp5T4xO8vrYHdsPBp1ME4i\n5+PqNBOZgYbJcFiyCF6BK18iWr+SX7FVlYoY+u+1yQKBgQC9fSU2rEHs/tltc5zz\nq7Jz3TFzV2IGJuv6wTPD0At8skhPjsB8xCt2OHU0f54DyAP0phProlwhbIYeYbs7\nYjcJrXiEKfgn3UaqOC7lG6bLa99aWTP4FjvNRXNhv6MRqz7Qm0zv4pmMGFcY1ZLo\no5qKlSczQYnaXM4ZocChebAc6wKBgQC7Kbw+7Z5LMt0oQB7/W837ishAIVppTK9w\nZyk0cW7GInihBLlVzhiz6EY2/VoLqw3QvBObSHc8deuIFOLOmtVWtaIme6h7lWzy\nuEdribNYPlmgLnw4/0nyLDKkc+nY+uBl+cv4vkm6CSmw/3N1WpIKwo9iDFRJmMea\nnaXoU50IfQKBgQCq0RDl+10mzwqkT0+Snhottp2oc4KLNzUNhHMstvRUAceL6Iz/\nLDxdw0FtBQomMH3YYoqcpW1WOCWjZ8jIHJ6u27FDuy3YifH06tbjdAzlXiYnpThj\nEW/xeQUtffr7p5rlpMoziduPXjXNzmIz06AyA4kl/JPPxE+K7bTgG/m15wKBgQCg\nh4x5YO97SjYcNtsfZQuIa6GUN8dHN8nmG+VgoMZFVP2oBdg8+1d+v4Ox2J2qEl34\nIcijUIVMq0uIXXmngW/oPkPExB1fWmumx14io2nbDydqV1SewoAXIceR/AWf4JYl\ngRps0DGGSiOjN4c9KaDHb9bxXufQdCUHvZ22ZjjzNQKBgBuJ1WyGp9dOQA6WKXSu\nvNjmuCpEN5v8uqyM0tFVRJOV1iLZZFpO0tnWvt0zTnZAw0wNXAP58urzUHSeAx1d\njq5kMMVVwAzy2/tSc1uhEyGjMcR9m6lQM61J5HttNFDkI3knMajJ46R10/dlgRw3\nLVMdZFhpv4uY/4/9WW8b0LR8\n-----END PRIVATE KEY-----`;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    })
  });
}

// Save FCM token
router.post('/save-token', async (req, res) => {
  try {
    const { userId, token, hostelId, userType } = req.body;
    
    // Save to SQLite database
    const db = req.db;
    await db.run(`
      INSERT OR REPLACE INTO fcm_tokens (userId, token, hostelId, userType, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [userId, token, hostelId, userType]);
    
    console.log('✅ FCM token saved:', { userId, userType, hostelId });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Save token error:', error);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// Send push notification to single token
async function sendPushNotification(token, title, body, data = {}) {
  try {
    const message = {
      token,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'default'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Push notification sent:', response);
    return true;
  } catch (error) {
    console.error('❌ Push notification error:', error);
    return false;
  }
}

// Send to multiple tokens
async function sendToMultipleTokens(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return null;
  
  const message = {
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    android: {
      notification: {
        sound: 'default',
        priority: 'high',
        channelId: 'default'
      }
    },
    tokens
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`✅ Sent to ${response.successCount}/${tokens.length} devices`);
    return response;
  } catch (error) {
    console.error('❌ Multicast error:', error);
    return null;
  }
}

// Get tokens by role and hostel
async function getTokensByRole(db, hostelId, role) {
  try {
    const rows = await db.all(`
      SELECT token FROM fcm_tokens 
      WHERE hostelId = ? AND userType = ? AND token IS NOT NULL
    `, [hostelId, role]);
    
    return rows.map(row => row.token);
  } catch (error) {
    console.error('❌ Get tokens error:', error);
    return [];
  }
}

// New complaint notification
router.post('/complaint-created', async (req, res) => {
  try {
    const { complaintId, title, tenantName, hostelId } = req.body;
    
    const adminTokens = await getTokensByRole(req.db, hostelId, 'admin');
    
    if (adminTokens.length > 0) {
      await sendToMultipleTokens(
        adminTokens,
        'New Complaint Submitted',
        `${tenantName} submitted: "${title}"`,
        {
          type: 'complaint',
          complaintId,
          action: 'view_complaint'
        }
      );
    }
    
    res.json({ success: true, sent: adminTokens.length });
  } catch (error) {
    console.error('❌ Complaint notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Comment added notification
router.post('/comment-added', async (req, res) => {
  try {
    const { complaintId, commenterName, hostelId } = req.body;
    
    const adminTokens = await getTokensByRole(req.db, hostelId, 'admin');
    
    if (adminTokens.length > 0) {
      await sendToMultipleTokens(
        adminTokens,
        'New Comment Added',
        `${commenterName} commented on complaint #${complaintId}`,
        {
          type: 'comment',
          complaintId,
          action: 'view_comments'
        }
      );
    }
    
    res.json({ success: true, sent: adminTokens.length });
  } catch (error) {
    console.error('❌ Comment notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Status change notification
router.post('/status-changed', async (req, res) => {
  try {
    const { complaintId, oldStatus, newStatus, hostelId, tenantId } = req.body;
    
    const tenantTokens = await getTokensByRole(req.db, hostelId, 'tenant');
    
    if (tenantTokens.length > 0) {
      await sendToMultipleTokens(
        tenantTokens,
        'Complaint Status Updated',
        `Complaint #${complaintId} changed from ${oldStatus} to ${newStatus}`,
        {
          type: 'status_change',
          complaintId,
          action: 'view_complaint'
        }
      );
    }
    
    res.json({ success: true, sent: tenantTokens.length });
  } catch (error) {
    console.error('❌ Status notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;