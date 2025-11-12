const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
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