const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Home page route - redirect to listings
router.get('/', (req, res) => {
    res.redirect('/listings');
});

// About page route - require authentication
router.get('/about', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('about', { 
        title: 'About Dwelly',
        user: req.session.user 
    });
});

// Contact page route - require authentication
router.get('/contact', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('contact', { 
        title: 'Contact Us',
        user: req.session.user 
    });
});

module.exports = router; 