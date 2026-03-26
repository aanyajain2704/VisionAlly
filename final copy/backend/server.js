const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5001;

// Enable CORS
app.use(cors());

// Use JSON body parsing
app.use(express.json());

const dataFile = path.join(__dirname, 'contacts.json');

// Load contacts from file permanently
let contacts = [];
if (fs.existsSync(dataFile)) {
  try {
    contacts = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch (err) {
    console.error("Error reading contacts file:", err);
  }
}

// Save Contact API
app.post('/save-contact', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "Name and phone are required" });
  }
  
  // Add to array if it doesn't already exist
  if (!contacts.some(c => c.phone === phone)) {
    contacts.push({ name, phone });
    // Save to file permanently
    fs.writeFileSync(dataFile, JSON.stringify(contacts, null, 2));
  }
  
  console.log(`Contact saved: ${name} (${phone})`);
  res.status(201).json({ message: "Contact saved successfully!" });
});

// Get Contacts API
app.get('/contacts', (req, res) => {
  res.json(contacts);
});

// Test route
app.get('/test', (req, res) => {
  res.json({
    message: "Backend is working"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
