// src/routes/index.js
const express = require('express');
const router = express.Router();
const videoRoutes = require('./videoRoutes');
const chunkRoutes = require('./chunkRoutes');

router.use('/', videoRoutes);
router.use('/chunks', chunkRoutes);

module.exports = router;