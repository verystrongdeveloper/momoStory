// src/routes/chatRoutes.js
const router                = require('express').Router();
const { sendChat, resetChat } = require('../controllers/chatController');

router.post('/chat',   sendChat);
router.post('/chat/reset', resetChat);

module.exports = router;
