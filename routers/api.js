const express = require('express'); 
const router = express.Router(); 
const controller = require('../controllers/api'); 

router 
.route('/')
.get(controller.getData);

module.exports = router;