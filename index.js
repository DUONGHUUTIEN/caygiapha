const express = require('express');
const app = express();
const path = require('path');

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Define the homepage route
app.get('/', (req, res) => {
    res.render('index');
});

// Define the family tree visualization route
app.get('/tree', (req, res) => {
    res.render('tree');
});

// Import and use the tree routes
const treeRoutes = require('./routes/tree');
app.use('/api/tree', treeRoutes);

// Update routes for login and register
app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});