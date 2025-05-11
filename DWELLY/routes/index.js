const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Home page route - require authentication
// router.get('/', isAuthenticated, (req, res) => {
//     res.redirect('/listings');
// });

// About page route - require authentication
router.get('/about', isAuthenticated, (req, res) => {
    res.render('about', { 
        title: 'About Dwelly',
        user: req.session.user 
    });
});

// Contact page route - require authentication
router.get('/contact', isAuthenticated, (req, res) => {
    res.render('contact', { 
        title: 'Contact Us',
        user: req.session.user 
    });
});

module.exports = router; 