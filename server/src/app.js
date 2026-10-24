// src/app.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express      = require('express');
const cors         = require('cors');

const chatRoutes   = require('./routes/chatRoutes');
const eventRoutes  = require('./routes/eventRoutes');
const triggerRoutes = require('./routes/triggerRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/local-file-save', require('./routes/localFileSave').createLocalFileSaveRouter());

app.use('/api', chatRoutes);
app.use('/api', eventRoutes);
app.use('/api', triggerRoutes);
// 헬스 체크 엔드포인트 (모니터링용)
app.get('/health', (_, res) => res.send('OK'));

module.exports = app;
