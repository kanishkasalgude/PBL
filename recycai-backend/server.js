const express = require('express');
const cors = require('cors');
const { db, admin } = require('./firebase');

const app = express();
const PORT = 5000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Scoring system for green credits (credits per kg) — matches README spec
const SCORES = {
  plastic:      8,
  paper:        5,
  metal:        15,
  glass:        6,
  ewaste:       20,
  fabric:       7,
  wood:         4,
  food:         3,
  rubber:       5,
  batteries:    25,
  chemicals:    35,
  medical:      30,
  construction: 3
};

/**
 * 1. POST /society/register
 * Register a new society
 */
app.post('/society/register', async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: "Name and location are required." });
    }

    const societyRef = db.collection('societies').doc();
    const societyData = {
      id: societyRef.id,
      name,
      location,
      totalCredits: 0
    };

    await societyRef.set(societyData);
    res.status(201).json(societyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. POST /pickup/request
 * Request a pickup for a society
 */
app.post('/pickup/request', async (req, res) => {
  try {
    const { societyId, societyName, location, wasteType } = req.body;
    if (!societyId || !wasteType) {
      return res.status(400).json({ error: "societyId and wasteType are required." });
    }

    // Randomly assign to a Recycling Collector to ensure distribution
    const collectorsSnapshot = await db.collection('collectors').get();
    let assignedCollectorId = 'UNASSIGNED';
    let assignedCollectorName = 'Unassigned Collector';

    if (!collectorsSnapshot.empty) {
      const recyclingCollectors = collectorsSnapshot.docs;
      const randomDoc = recyclingCollectors[Math.floor(Math.random() * recyclingCollectors.length)];
      assignedCollectorId = randomDoc.id;
      assignedCollectorName = randomDoc.data().name;
    }

    const pickupRef = db.collection('pickups').doc();
    const pickupData = {
      id: pickupRef.id,
      societyId,
      societyName: societyName || "Unknown Society",
      location: location || "No location provided",
      wasteType,
      weight: 0,
      status: "requested",
      collectorId: assignedCollectorId,
      collectorName: assignedCollectorName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await pickupRef.set(pickupData);
    res.status(201).json(pickupData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2b. POST /pickup/accept
 * Recycling Collector accepts a requested pickup (sets status → "accepted")
 */
app.post('/pickup/accept', async (req, res) => {
  try {
    const { pickupId } = req.body;
    if (!pickupId) {
      return res.status(400).json({ error: "pickupId is required." });
    }

    const pickupRef = db.collection('pickups').doc(pickupId);
    const pickupDoc = await pickupRef.get();

    if (!pickupDoc.exists) {
      return res.status(404).json({ error: "Pickup not found." });
    }

    await pickupRef.update({ status: 'accepted' });
    res.status(200).json({ message: "Pickup accepted.", pickupId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. POST /pickup/confirm
 * Recycling Collector confirms pickup, updates weight, and calculates credits
 */
app.post('/pickup/confirm', async (req, res) => {
  try {
    const { pickupId, weight } = req.body;
    if (!pickupId || weight === undefined) {
      return res.status(400).json({ error: "pickupId and weight are required." });
    }

    const pickupRef = db.collection('pickups').doc(pickupId);
    const pickupDoc = await pickupRef.get();

    if (!pickupDoc.exists) {
      return res.status(404).json({ error: "Pickup not found." });
    }

    const pickupData = pickupDoc.data();
    const wasteType = pickupData.wasteType.toLowerCase();
    
    // Calculate credits
    const scorePerKg = SCORES[wasteType] || 0;
    const credits = weight * scorePerKg;

    // Update pickup status
    await pickupRef.update({
      status: "completed",
      weight: weight,
      creditsAwarded: credits
    });

    // Update society total credits
    const societyId = pickupData.societyId;
    const societyRef = db.collection('societies').doc(societyId);
    
    await societyRef.update({
      totalCredits: admin.firestore.FieldValue.increment(credits)
    });

    res.status(200).json({
      message: "Pickup confirmed",
      creditsGenerated: credits
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. GET /pickups
 * Get all pickups (for Recycling Collector dashboard). Can be filtered by collectorId.
 */
app.get('/pickups', async (req, res) => {
  try {
    const { collectorId } = req.query;
    const pickupsSnapshot = await db.collection('pickups')
      .orderBy('createdAt', 'desc')
      .get();

    let pickups = pickupsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (collectorId) {
      pickups = pickups.filter(p => p.collectorId === collectorId);
    }

    res.status(200).json(pickups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4b. GET /pickup/list
 * Alias for /pickups (used by society dashboard)
 */
app.get('/pickup/list', async (req, res) => {
  try {
    const pickupsSnapshot = await db.collection('pickups')
      .orderBy('createdAt', 'desc')
      .get();

    const pickups = pickupsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(pickups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 5. GET /leaderboard
 * Get societies sorted by totalCredits descending
 */
app.get('/leaderboard', async (req, res) => {
  try {
    const societiesSnapshot = await db.collection('societies')
      .orderBy('totalCredits', 'desc')
      .get();

    const leaderboard = societiesSnapshot.docs.map(doc => ({
      name: doc.data().name,
      totalCredits: doc.data().totalCredits
    }));

    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 5b. GET /stats/citywide
 * Get aggregated municipal statistics
 */
app.get('/stats/citywide', async (req, res) => {
  try {
    // 1. Total waste diverted (sum of weight from completed pickups)
    const pickupsSnapshot = await db.collection('pickups')
      .where('status', '==', 'completed')
      .get();
    
    let totalWaste = 0;
    pickupsSnapshot.forEach(doc => {
      totalWaste += (doc.data().weight || 0);
    });

    // 2. Active societies (count)
    const societiesSnapshot = await db.collection('societies').get();
    const activeSocieties = societiesSnapshot.size;

    // 3. Green credits generated (sum of totalCredits from all societies)
    let totalCredits = 0;
    societiesSnapshot.forEach(doc => {
      totalCredits += (doc.data().totalCredits || 0);
    });

    res.status(200).json({
      wasteDiverted: totalWaste,
      activeSocieties: activeSocieties,
      greenCredits: totalCredits
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── EcoBot: AI Chat via Ollama (local LLM, no API key needed) ──

const ECOLOOP_SYSTEM_PROMPT = `
You are EcoBot, the intelligent recycling assistant embedded inside EcoLoop —
a smart municipal recycling platform used by housing societies in India.

YOUR PERSONALITY:
- Friendly, concise, and encouraging. Never preachy or lecture-y.
- You speak like a knowledgeable friend, not a textbook.
- Use "your society", "your pickup", "your credits" — make it personal.
- Keep answers under 4 sentences unless the user asks for detail.
- Occasionally use a single relevant emoji at the end of a message (not every message).

YOUR KNOWLEDGE DOMAIN:
1. Waste disposal rules — what goes in which category (plastic, metal, paper,
   e-waste, glass, batteries, textiles, organic, medical, chemicals, rubber)
2. Green Credits system — explain how credits are earned per kg per waste type:
   Plastic=8, Paper=5, Metal=15, E-Waste=20, Glass=6, Batteries=25,
   Textiles=7, Organic=3, Rubber=5, Medical=30, Chemicals=35
3. Environmental impact — CO₂ savings, why recycling each material matters
4. EcoLoop features — how to request a pickup, track history, read the leaderboard,
   earn badges (First Step, Consistent, Green Champion, E-Warrior, Century Club)
5. Indian recycling context — local kabadiwala system, municipal rules,
   Swachh Bharat guidelines, common Indian household waste patterns

STRICT RULES:
- If asked something outside recycling, waste, environment, or EcoLoop features,
  say: "I'm specialized in recycling and EcoLoop — ask me anything about that!"
- Never make up credit values or statistics. Use only the values listed above.
- Never give medical advice even if "medical waste" is mentioned.
- If unsure, say "I'm not certain — I'd recommend checking with your local
  municipal authority for that specific item."

EXAMPLE GOOD RESPONSES:
User: "Can I recycle a broken phone?"
You: "Yes! Broken phones are e-waste and earn you 20 credits/kg — the highest
standard rate. Just schedule an e-waste pickup from your dashboard. ♻️"

User: "What's the point of recycling paper?"
You: "Recycling 1 kg of paper saves 0.9 kg of CO₂ and reduces deforestation.
Your society gets 5 credits/kg too — small weight adds up fast over a month."
`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        stream: true,
        messages: [
          { role: 'system', content: ECOLOOP_SYSTEM_PROMPT },
          ...(messages || [])
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `Ollama error: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
          }
        } catch (_) { /* ignore parse errors on partial chunks */ }
      }
    }
  } catch (err) {
    console.error('EcoBot /api/chat error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Could not reach Ollama. Is it running on localhost:11434?' })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
