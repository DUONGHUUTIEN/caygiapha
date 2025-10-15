const express = require('express');
const router = express.Router();
const familyTree = require('../data/sampleFamilyTree');

// Example route for fetching family tree data
router.get('/data', (req, res) => {
    res.json(familyTree);
});

module.exports = router;