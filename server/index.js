const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/analyze', require('./routes/analyze'));
const roles = require('./data/roles.json');
app.get('/api/roles', (req, res) => {
  res.json(roles.map((r) => r.name));
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));